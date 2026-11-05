#!/usr/bin/env node
/**
 * Pull App Store Connect power-and-performance metrics — the same numbers the
 * Xcode Organizer shows, without an interactive Apple login.
 *
 * WHY THIS EXISTS
 * We needed iOS hang / launch / termination rates to test one hypothesis: 74%
 * of iOS new-user sessions end in under 3 seconds, and we cannot tell from
 * Amplitude whether that is people bouncing or the app dying. Pulling it by
 * hand needs an Apple login every time. See project_ios_carousel_dropoff.
 *
 * 🔴 WHAT THIS CANNOT DO: **crash counts are not exposed by the App Store
 * Connect API.** This endpoint carries HANG, LAUNCH, TERMINATION, MEMORY, DISK
 * and friends — which is the more diagnostic half for a frozen first paint —
 * but for crash counts you still need
 *   https://appstoreconnect.apple.com/analytics/app/1478144712/crashes
 * Do not read "no crashes reported here" as "no crashes".
 *
 * 🔑 A termination is the one to watch: a memory-limit kill produces NO crash
 * report at all, and would match our signature exactly (app opens, first
 * screen mounts, event flushes at ~1s, process gone).
 *
 * SETUP (once). The key is a credential: it is never printed by this script,
 * never committed, and is referenced by path only — same arrangement as the
 * Play service-account file in eas.json.
 *   1. App Store Connect → Users and Access → Integrations → App Store Connect
 *      API → generate a key. Download the .p8 ONCE (Apple will not re-serve it).
 *   2. Save it outside the repo, e.g. ~/.appstoreconnect/private_keys/
 *   3. export ASC_KEY_PATH=~/.appstoreconnect/private_keys/AuthKey_XXXX.p8
 *      export ASC_KEY_ID=XXXXXXXXXX        # the key's Key ID
 *      export ASC_ISSUER_ID=xxxxxxxx-....  # shown above the key list
 *
 * USAGE
 *   node scripts/asc-metrics.mjs                      # all iPhones, our app
 *   node scripts/asc-metrics.mjs --device all_ipads
 *   node scripts/asc-metrics.mjs --app 1478144712 --out /tmp/metrics.json
 *
 * Zero dependencies: ES256 signing uses Node's built-in crypto with
 * `dsaEncoding: "ieee-p1363"`, which is the raw r||s form a JWT requires (the
 * default DER encoding produces a token Apple rejects).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_APP_ID = "1478144712"; // Reset, from eas.json `ascAppId`

/** Minimal flag parsing — avoids a dependency for four options. */
function parseArgs(argv) {
  const out = { app: DEFAULT_APP_ID, device: "all_iphones", platform: null, out: null };
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i]?.replace(/^--/, "");
    const v = argv[i + 1];
    if (k && v && k in out) out[k] = v;
  }
  return out;
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * Mint a short-lived ES256 JWT for the App Store Connect API.
 *
 * Apple caps the lifetime at 20 minutes and rejects anything longer, so there
 * is no reason to cache this — mint one per run.
 */
export function mintToken({ keyPath, keyId, issuerId, scope }) {
  const expanded = keyPath.startsWith("~") ? path.join(os.homedir(), keyPath.slice(1)) : keyPath;
  if (!fs.existsSync(expanded)) {
    throw new Error(`ASC_KEY_PATH does not exist: ${expanded}`);
  }
  const pem = fs.readFileSync(expanded, "utf8");
  if (!pem.includes("PRIVATE KEY")) {
    // Guard against pointing at the wrong file. Deliberately does not echo
    // any of the file's contents.
    throw new Error("ASC_KEY_PATH is not a PEM private key (.p8 expected)");
  }

  const iat = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = {
    iss: issuerId,
    iat,
    exp: iat + 15 * 60,
    aud: "appstoreconnect-v1",
    // Some endpoints 403 unless the token is scoped to the exact request.
    // Opt-in via ASC_SCOPE because the unscoped token works for most reads and
    // an over-narrow scope is itself a source of 403s.
    ...(scope ? { scope: [scope] } : {}),
  };

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = crypto
    .createSign("SHA256")
    .update(signingInput)
    .sign({ key: pem, dsaEncoding: "ieee-p1363" });

  return `${signingInput}.${b64url(signature)}`;
}

/**
 * Walk the metrics payload and print what matters.
 *
 * Written defensively on purpose: Apple's response shape for this endpoint is
 * documented mostly through WWDC sessions, so anything unrecognised is still
 * written to the raw JSON file rather than dropped.
 */
export function summarise(data) {
  const lines = [];
  const insights = data?.insights;
  if (insights && Object.keys(insights).length) {
    lines.push("INSIGHTS (regressions Apple flagged itself):");
    lines.push(JSON.stringify(insights, null, 1));
    lines.push("");
  }

  const products = data?.productData ?? [];
  if (!products.length) {
    lines.push("No productData in the response.");
    lines.push(
      "That usually means too few opted-in users on the versions queried, not that the rates are zero.",
    );
    return lines.join("\n");
  }

  for (const product of products) {
    for (const cat of product?.metricCategories ?? []) {
      lines.push(`\n=== ${cat.identifier ?? "(unnamed category)"} ===`);
      for (const metric of cat?.metrics ?? []) {
        const unit = metric.unit ? ` ${metric.unit}` : "";
        lines.push(`  ${metric.identifier ?? "(metric)"}${unit}`);
        for (const ds of metric?.datasets ?? []) {
          const filter = ds?.filterCriteria
            ? Object.entries(ds.filterCriteria)
                .map(([k, v]) => `${k}=${v}`)
                .join(" ")
            : "";
          const points = (ds?.points ?? [])
            .map((p) => `${p.version ?? "?"}: ${p.value ?? "?"}`)
            .join("  ");
          if (points) lines.push(`    ${filter ? filter + " | " : ""}${points}`);
        }
      }
    }
  }
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const keyPath = process.env.ASC_KEY_PATH;
  const keyId = process.env.ASC_KEY_ID;
  const issuerId = process.env.ASC_ISSUER_ID;

  if (!keyPath || !keyId || !issuerId) {
    console.error(
      "Missing credentials. Set ASC_KEY_PATH, ASC_KEY_ID and ASC_ISSUER_ID\n" +
        "(see the SETUP block at the top of this file).",
    );
    process.exit(2);
  }

  const token = mintToken({ keyPath, keyId, issuerId, scope: process.env.ASC_SCOPE });

  const url = new URL(`https://api.appstoreconnect.apple.com/v1/apps/${args.app}/perfPowerMetrics`);
  url.searchParams.set("filter[deviceType]", args.device);
  // `filter[platform]` is NOT confirmed against Apple's reference docs, so it
  // is only sent when asked for — an unknown filter is a 400, and the request
  // works without it.
  if (args.platform) url.searchParams.set("filter[platform]", args.platform);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      // The vendor media type is required; plain application/json alone has
      // been observed to return the wrong representation.
      Accept: "application/vnd.apple.xcode-metrics+json,application/json",
    },
  });

  const body = await res.text();

  if (!res.ok) {
    console.error(`HTTP ${res.status} ${res.statusText}`);
    if (res.status === 401) {
      console.error("401 → the token was rejected. Check ASC_KEY_ID / ASC_ISSUER_ID pairing.");
    }
    if (res.status === 403) {
      console.error(
        "403 → known gotcha: this endpoint is sensitive to token SCOPE and key role.\n" +
          "Try an Admin or App Manager key, or set ASC_SCOPE to the exact request, e.g.\n" +
          `  export ASC_SCOPE='GET ${url.pathname}?${url.searchParams.toString()}'`,
      );
    }
    if (res.status === 409) {
      console.error("409 → Apple reports no metrics available for this app/filter combination.");
    }
    console.error(body.slice(0, 800));
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    console.error("Response was not JSON:");
    console.error(body.slice(0, 800));
    process.exit(1);
  }

  const outPath = args.out ?? path.join(os.tmpdir(), `asc-metrics-${args.app}-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));

  console.log(summarise(data));
  console.log(`\nRaw JSON: ${outPath}`);
  console.log(
    "\n🔴 Crash COUNTS are not in this API. For those:\n" +
      `   https://appstoreconnect.apple.com/analytics/app/${args.app}/crashes`,
  );
}

// Only run when invoked directly, so the functions above can be imported and
// tested without firing a request at Apple.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    // Message only — never the key, never the token.
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  });
}

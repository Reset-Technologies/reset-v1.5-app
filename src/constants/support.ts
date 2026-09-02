// Where "Contact Us" in Settings actually goes.
//
// 🔴 THIS IS THE ONLY SUPPORT CHANNEL INSIDE THE APP. Until this shipped, both
// SUPPORT rows in Settings were dead buttons — TouchableOpacity with no
// onPress — so a member had no way to reach anyone from the app at all. That
// mattered more than it looks: CS took cancellation and account-deletion
// requests through Intercom surveys in the LEGACY app, and those surveys are
// being turned off. Without this the intake channel closed with nothing behind
// it.
//
// `hello@reset.com` is the address already published in the reset.com footer,
// so it is known to be live and monitored. ⚠️ If CS wants a dedicated support
// address instead, this constant is the only place to change — but it must be
// changed BEFORE the build is submitted, since a wrong address is worse than a
// dead button: the member believes they have been in touch and then hears
// nothing.
export const SUPPORT_EMAIL = "hello@reset.com";

/**
 * Builds the mailto for a support request.
 *
 * The subject is prefilled and the body carries the app version, platform and
 * the user's account id when we have one. That is not decoration: CS's most
 * common first move is "which account is this?", and a legacy member's app
 * email often differs from the one their old subscription bills under. Handing
 * them the account id up front removes a whole round-trip.
 */
export function buildSupportMailto(params: {
  appVersion: string;
  platform: string;
  userId?: string | null;
}): string {
  const { appVersion, platform, userId } = params;
  const subject = "Reset app — support request";
  const body = [
    "",
    "",
    "———————————————",
    "Please keep the details below — they help us find your account.",
    `App version: ${appVersion}`,
    `Platform: ${platform}`,
    `Account ID: ${userId ?? "(not signed in)"}`,
  ].join("\n");

  return (
    `mailto:${SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`
  );
}

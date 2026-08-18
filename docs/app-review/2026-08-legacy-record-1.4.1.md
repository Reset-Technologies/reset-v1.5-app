# App Review — legacy record 1478144712, guideline 1.4.1 (Aug 2026)

Canonical record of the submission that finally cleared **Guideline 1.4.1 — Safety — Physical
Harm** on the legacy App Store record (`com.betterwell.reset`, Apple ID **1478144712**), after
three rejections.

**Why this file exists:** the winning text lived only inside App Store Connect. It was nearly lost
when the release was cancelled to swap in a corrected build. Every future submission should start
from this file, not from whatever is currently in the ASC text box — the round-3 rejection was
caused by exactly that drift (the legacy record's notes said "documentation available on request"
while the already-approved `.dev` record's notes carried the full package inline).

- **Submission ID:** `fd5eecf4-4c5f-4d0b-b881-d78551298dfa`
- **Outcome:** Review Completed — **Approved** 2026-08-17
- **Approved items (3):** iOS App 3.0.0 (build **4**) · Reset Pro Monthly · Reset Pro Yearly

> ⚠️ **Build 4 must never be released.** It predates `1b8b4fe` (RES-207 welcome-back) and has no
> legacy flags, no paywall bypass, and no `WelcomeBackScreen`. A returning BetterWell member is
> dropped into the subscription gate and asked to pay again for a subscription they already own.
> The value of this approval is the *precedent*, not the binary.

> ⚠️ **Never claim FDA clearance or a CE mark for Reset.** Reset integrates the vendor's
> **Wellness SDK**. The vendor's separate **Medical SDK** received CE Class IIa marking on
> 2026-07-30 — that is a different product requiring separate integration, and it is not what
> Reset ships. Never write "conformity assessment in progress." The correct position is that
> clearance is **not applicable**, not pending.

---

## Timeline

| date | event | build | device |
|---|---|---|---|
| 2026-08-03 | Rejected — 1.4.1, plus "description must include a disclaimer" | 3.0.0 (3) | iPhone 17 Pro Max |
| 2026-08-06 | Rejected — narrowed to "score based on health measurements" | 3.0.0 (3) | iPad Air 11" (M3) |
| 2026-08-11 | Cole's first reply (below) | — | — |
| 2026-08-12 | Rejected — reverted to generic 1.4.1 boilerplate | 3.0.0 (4) | iPad Air 11" (M3) |
| 2026-08-12 | **Cole's round-4 reply (below) — this is the one that worked** | — | — |
| 2026-08-17 | **Approved** (all 3 items) | 3.0.0 (4) | — |

🔑 The Aug-6 message is the most specific Apple ever got: *"The app provides score based on health
measurements without the appropriate regulatory clearance."* When they reverted to boilerplate on
Aug-12, that was the signal the disclaimer and tile-level changes were an exhausted lever — the
missing piece was the **evidence package in the Notes field**.

---

## ✅ Round-4 reply — 2026-08-12 1:36 PM (the one that cleared it)

Posted to Resolution Center **before** hitting Resubmit. (Resubmitting first locks the thread —
that mistake was made in round 2.)

> Hello, and thank you for the continued review.
>
> We want to respond directly to the request to attach regulatory approval documentation, because we believe our previous notes did not give you enough to work with.
>
> We do not hold FDA clearance or a CE mark, and we do not claim either one anywhere in the app or its metadata. There is no clearance document for us to attach. Reset is a general wellness and lifestyle app: it makes no diagnostic claims, provides no measurements for clinical use, and gives no diagnoses or treatment advice. Our understanding is that clearance is therefore not applicable, rather than pending.
>
> What we can supply is the methodology and accuracy evidence behind the scan, and we recognize that in previous submissions we described this as "available on request" rather than providing it. That was our error. We have now placed the full package directly in the App Review Information notes for this version, including:
>
> - The Clinical Validation Report from Wroclaw Medical University (September 2023, protocol MDF-01-008-01; n=130 subjects, 944 measurements; reference ECG plus Finapres Nova), with a direct link to the PDF.
> - Peer-reviewed validation published in Bioengineering (MDPI), 2026, DOI 10.3390/bioengineering13020246, with a direct link.
> - An explicit statement of regulatory status: Reset integrates the vendor's self-service Wellness SDK. It does not use the vendor's Medical SDK, a separate product that received CE Class IIa marking on July 30, 2026 and requires separate integration. Reset itself holds no FDA clearance or CE marking and claims none.
>
> We have also made the following product changes in response to this guideline:
>
> - Blood pressure has been removed from the app entirely.
> - Stress is no longer shown as a numeric or clinical value. It appears only as a qualitative wellness range labeled "Stress Balance" (Calm / Balanced / Elevated).
> - This build adds an in-app wellness disclaimer on five separate surfaces (scan introduction, scan capture, scan results, score reveal, and the home score card), not only in the App Store description. It reads: "Reset provides general wellness information and is not intended to diagnose or treat any medical condition. Do not use Reset to make medical decisions. Talk with a healthcare professional before making decisions about your health."
>
> On the Reset Score, which your August 6 message identified specifically: it is a general wellness score rather than a health assessment or risk score. It combines signals from the scan with the user's self-reported daily check-in answers, and the app produces a score from those check-in answers alone when no scan is taken. It carries no diagnostic thresholds and no medical categories.
>
> For context, this same app was reviewed and approved on our other App Store listing, "Reset: Lasting Health" (Apple ID 6760977260), on July 23, 2026, under this same guideline. The submission we are making here is the same product with additional wellness safeguards added since then. We mention this only to show the position we are taking is one your team has already assessed, not to substitute for your review of this submission.
>
> If any specific element in the app still reads as a medical measurement, diagnosis, or treatment recommendation, please tell us which one and we will change or remove it. We would also welcome a call with App Review if that would be a faster way to resolve this.
>
> Thank you.

### Why it worked — the elements to preserve

1. **Owns the prior error explicitly** — "we described this as 'available on request' … That was our error."
2. **Answers the actual question**: there is no document because clearance is *not applicable*, not pending.
3. **Direct links, inline** — Wroclaw PDF and the MDPI DOI, in the Notes field, not offered on request.
4. **Names the SDK distinction** — Wellness SDK, not the CE Class IIa Medical SDK.
5. **Lists concrete product removals** — BP gone entirely; stress qualitative only.
6. **Cites the sibling approval** — `.dev` record 6760977260, approved 2026-07-23 under the same guideline.
7. **Invites them to name the offending element**, and offers a call.

---

## Earlier reply — 2026-08-11 2:05 AM (insufficient on its own)

Kept because it shows what was *not* enough: the same argument without the evidence package
inline. Apple responded with generic boilerplate.

> Thank you for the additional detail in the second review — the narrower framing was helpful.
>
> REGARDING REGULATORY CLEARANCE
>
> Reset is not a medical device and does not have, or require, regulatory clearance. It is a general wellness product. It is not intended to diagnose, treat, cure, or prevent any disease, and it does not provide diagnoses, medical advice, or treatment recommendations. We have not made and do not make any medical claim.
>
> WHAT THE SCORE IS
>
> The Reset Score is a lifestyle score for weight management. It combines general wellness signals from an optional camera-based scan — pulse rate, heart-rate variability, and breathing rate — with the user's own self-reported daily check-in about energy, sleep, and stress. It is presented as day-to-day feedback on habits, alongside meal suggestions. It is not a clinical assessment and is never presented as one.
>
> This is the same category as the readiness and recovery scores offered by widely available consumer wellness products, which combine heart-rate variability and resting heart rate into a daily score.
>
> CHANGES MADE IN THIS BUILD
>
> We have added a persistent on-screen wellness disclaimer to every surface that presents the scan or the score — the onboarding scan introduction, the scan screen itself, the scan results, the daily score screen, and the home screen. It reads:
>
> "Reset provides general wellness information and is not intended to diagnose or treat any medical condition. Do not use Reset to make medical decisions. Talk with a healthcare professional before making decisions about your health."
>
> The same disclaimer appears in the App Store description.
>
> STEPS ALREADY TAKEN BEFORE THIS SUBMISSION
>
> We use the Shen.AI SDK for the optional scan, and we adopted its general wellness interface, which uses wellness terminology rather than clinical terminology. We then went further than that interface provides: we removed the blood-pressure estimate and the stress index from display entirely, and we display only pulse rate, heart-rate variability, and breathing rate — the three measurements with published clinical validation. Blood pressure is not shown anywhere in the app.
>
> SUPPORTING EVIDENCE
>
> For those three measurements the SDK vendor has published a clinical validation study (Wroclaw Medical University, n=130, reference ECG and Finapres Nova) and peer-reviewed validation in MDPI Bioengineering (DOI 10.3390/bioengineering13020246). We include these for transparency about accuracy, not as a claim of regulatory status.
>
> If any part of the app still reads as a medical claim, we would genuinely welcome a call to understand which specific element concerns you, so we can address it precisely rather than by guesswork.

---

## Apple's rejection messages (verbatim, abridged to the substantive parts)

### 2026-08-03 — build 3, iPhone 17 Pro Max

> **Guideline 1.4.1 - Safety - Physical Harm**
>
> The app provides medical related data, health related measurements, diagnoses or treatment advice without the appropriate regulatory clearance. Please note that the app is subject to all of the local regulatory laws where the app is available.
>
> To ensure that the information provided by the app is accurate, please attach your regulatory approval documentation in the App Review Information section of App Store Connect. Once you have posted this documentation, we will continue the review.
>
> Your app's description must also include a disclaimer reminding users to seek a doctor's advice in addition to using this app and before making any medical decisions.

Both subscriptions were returned with: *"This In-App Purchase … has been returned because the
associated app was rejected. It will have the 'Rejected' status until it is resubmitted for
review."* ⇒ **IAP review status is coupled to the app version's outcome.**

Rejection attachment: `Screenshot-0803-162840.png` (not archived here — download from ASC if needed).

### 2026-08-06 — build 3, iPad Air 11" (M3)

> The app provides **score based on health measurements** without the appropriate regulatory clearance.

### 2026-08-12 — build 4, iPad Air 11" (M3)

> The app provides medical related data, health related measurements, diagnoses or treatment advice without the appropriate regulatory clearance.

(Back to the generic wording — no engagement with the Aug-11 reply.)

---

## 🔴 STILL NOT ARCHIVED

The **App Review Information → Notes** field itself (~3,991 chars) is *not* in this file. The
Aug-12 reply references it — *"We have now placed the full package directly in the App Review
Information notes"* — so the Notes field contains the actual Wroclaw/MDPI links and the regulatory
statement. **Copy it out of ASC and add it here.** Until then the packet that won this approval
still exists in exactly one place.

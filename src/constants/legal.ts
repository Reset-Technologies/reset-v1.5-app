// Legal document URLs surfaced in-app. Apple requires functional links to a
// privacy policy and Terms of Use (EULA) in the subscription purchase flow
// (Guideline 3.1.2) and in Settings.
//
// Terms of Use points at Apple's Standard EULA — the app ships the default
// Apple licensed-application agreement rather than a custom one, so this is the
// canonical link Apple expects. If we later host our own terms page, swap this.
export const PRIVACY_POLICY_URL = "https://www.reset.com/privacy-policy";
export const TERMS_OF_USE_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

// RES-188 — the third-party-AI disclosure surfaced on the consent screen and in
// Settings → Data & Privacy. TODO: point at the dedicated AI-disclosure section
// once the privacy policy is updated + hosted (currently the policy root).
export const AI_DISCLOSURE_URL = "https://www.reset.com/privacy-policy";

import { Platform } from "react-native";

// Where a share points someone who doesn't have the app yet.
//
// www.reset.com is the right target rather than a store URL: the site already
// serves platform-aware download CTAs, so one link works on iOS, Android and
// desktop, and it keeps working if the store records ever change.
//
// 🔴 Do NOT use "reset.app" — it is not ours. It resolved to an unrelated host
// (216.150.1.1, serverhostgroup.com nameservers) while our site is on Vercel.
// It shipped in the onboarding share text and was corrected 2026-09-12.
export const SHARE_URL = "https://www.reset.com";

/** Host shown in UI copy where a bare domain reads better than a full URL. */
export const SHARE_HOST = "reset.com";

/**
 * Share payload that carries the link on both platforms: iOS renders `url` as
 * a link attachment alongside the text, Android ignores `url` entirely — so
 * there the URL has to live inside the message or it is silently dropped.
 */
export function shareWithLink(message: string): { message: string; url?: string } {
  return Platform.OS === "ios"
    ? { message, url: SHARE_URL }
    : { message: `${message} ${SHARE_URL}` };
}

// Shared layout constraints for large-screen (iPad) support.
//
// The app renders as a universal build on the legacy App Store record, where
// iPad is a real slice of the base. Most screens size their main content to the
// full screen width, which is fine on a phone but stretches to ~1000pt on a
// 13" iPad — long line lengths, oversized cards, a "blown-up phone app" look.
//
// CONTENT_MAX_WIDTH caps the primary content column so it reads like a centered
// phone-width layout on iPad. It intentionally has NO effect on phones: a phone
// window (~360–430pt) is already narrower than this cap, and `maxWidth` only
// constrains, never expands — so applying it is safe everywhere without a
// Platform/device check. Pair it with `alignSelf: "center"` (or a centered
// parent) to center the capped content.
export const CONTENT_MAX_WIDTH = 520;

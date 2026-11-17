// Sentry's Expo Metro config. `getSentryExpoConfig` wraps `getDefaultConfig`
// and adds the serializer that emits Debug IDs, which is what lets Sentry map
// a minified production stack trace back to our source.
//
// 🔴 Without this file, crash reports still arrive but the stack frames are
// unreadable minified bundle offsets — i.e. the reports exist and tell you
// nothing, which is the failure mode this whole change exists to avoid.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);

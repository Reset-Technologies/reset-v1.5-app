import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

export type LiveActivityPhase = "eating" | "reset";

export interface LiveActivityContent {
  phase: LiveActivityPhase;
  /** Scheduled Reset start for "eating"; actual start for "reset". */
  startAt: Date;
  /** When the eating window opens. */
  openAt: Date;
  /** The member's Window, e.g. "14:10". */
  windowLabel: string;
}

export type LiveActivityResult =
  | "started"
  | "updated"
  | "unchanged"
  | "ended"
  | "disabled"
  | "unavailable"
  | "failed";

type NativeModule = {
  isSupported(): boolean;
  sync(
    phase: string,
    startAtMs: number,
    openAtMs: number,
    windowLabel: string,
  ): Promise<LiveActivityResult>;
  end(): Promise<void>;
};

// Both platforms implement the same native surface — iOS with ActivityKit,
// Android with a promoted ongoing notification. Load it defensively (same
// pattern as modules/build-env) so importing never throws in Expo Go, on the
// web, or in an older dev client built before this module existed: every call
// just becomes a no-op.
let native: NativeModule | null = null;
if (Platform.OS === "ios" || Platform.OS === "android") {
  try {
    native = requireNativeModule<NativeModule>("ResetLiveActivity");
  } catch {
    native = null;
  }
}

/**
 * True when this device can show the card and the member allows it. On iOS
 * that is ActivityKit's own switch; on Android it is the notification
 * permission, which Android 13+ requires before anything appears at all.
 */
export function isLiveActivitySupported(): boolean {
  try {
    return native?.isSupported() === true;
  } catch {
    return false;
  }
}

/**
 * Makes the lock screen match `content`: starts the activity if there isn't
 * one, updates it if it changed, or ends it when `content` is null.
 */
export async function syncLiveActivity(
  content: LiveActivityContent | null,
): Promise<LiveActivityResult> {
  if (!native) return "unavailable";
  try {
    if (!content) {
      await native.end();
      return "ended";
    }
    return await native.sync(
      content.phase,
      content.startAt.getTime(),
      content.openAt.getTime(),
      content.windowLabel,
    );
  } catch {
    return "failed";
  }
}

/** Removes the activity immediately (sign-out, account switch). */
export async function endLiveActivity(): Promise<void> {
  try {
    await native?.end();
  } catch {
    // noop — the next sync reconciles it.
  }
}

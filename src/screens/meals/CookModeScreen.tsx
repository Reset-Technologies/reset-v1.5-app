import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { startAlarmBuzz } from "../../utils/alarmHaptics";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { BookmarkIcon } from "../../components/BookmarkIcon";
import {
  CookModeSession,
  CookModeStep,
  addFavorite,
  getFavorites,
  removeFavorite,
  completeCookMode,
  openCookMode,
  setCookStep,
  startCookTimer,
} from "../../services/meals";
import type { MainStackParamList } from "../../navigation/MainNavigator";

/**
 * P0 #13 — Cook Mode. Lang's frames `5062:56622` (step), `5062:58206`
 * (completion) and `5062:56948` (timer).
 *
 * ## 🔴 Cook Mode never claims the member ate
 * COOK MODE's header: opening or finishing *"never proves the member ate the
 * meal"*; r9: *"Do not auto-mark meal On plan"*; TEST CASES M25: *"prep-intent
 * signals only… no FT auto-credit"*. ▶ Finishing calls `complete`, which emits
 * one prep-intent event. It writes no follow-through, no Fit signal, no plan
 * change — and this screen offers no control that could.
 *
 * ## Navigation is SWIPE, from her own annotation
 * On the completion frame: *"When user swipes past the final step in cook
 * mode, it will bring them to a completion page."* So the steps and the
 * completion screen are one paged list, and the completion page is simply the
 * last page — not a separate route. That is why there are no next/previous
 * buttons: she drew none.
 */

type Nav = NativeStackNavigationProp<MainStackParamList>;
type CookRoute = RouteProp<MainStackParamList, "CookMode">;

const { width: SCREEN_W } = Dimensions.get("window");

/**
 * Format seconds as Lang's ring does: `HH:MM:SS`.
 *
 * 🔑 Her timer reads `00:05:00` — hours, minutes, seconds — which is what
 * makes long durations representable at all. The catalogue holds 98 timers
 * over an hour and 30 over four (slow cookers, overnight soaks, bagel
 * proofing, a 24-hour cod soak), so an `MM:SS` field would have silently
 * mangled every one of them.
 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

/**
 * A run of step text, and the timer it names if it names one.
 *
 * Lang's annotation on `5062:58199`: *"If a time is included in the recipe
 * step, highlight it in blue. Clicking on the time should open a timer preset
 * to the time included in the recipe step."*
 */
export interface StepSegment {
  text: string;
  /** Present only on a segment that IS a duration. */
  seconds?: number;
}

/**
 * 🔑 Parsed from the TEXT, not from `step.timerSeconds`.
 *
 * The backend reads `timerSeconds` off the provider's structured `length`
 * field (`cook-steps.ts`), which gives ONE duration for the whole step and
 * says nothing about where it sits in the sentence — and the sentence is
 * exactly what has to be highlighted. A step can also name two ("boil for 2
 * minutes… then roast for 3 hours"), and her annotation highlights each.
 * `timerSeconds` still drives the header clock button; this drives the ink.
 */
const TIME_RE =
  /(\d+(?:\.\d+)?(?:\s+\d\/\d)?|\d\/\d)\s*(?:(?:[-–—]|\s+to\s+)\s*(\d+(?:\.\d+)?(?:\s+\d\/\d)?|\d\/\d)\s*)?(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/gi;

/** `"1 1/2"` → 1.5, `"1/2"` → 0.5, `"2.5"` → 2.5. */
function parseAmount(raw: string): number {
  const m = raw.trim().match(/^(\d+)\s+(\d)\/(\d)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  const f = raw.trim().match(/^(\d)\/(\d)$/);
  if (f) return Number(f[1]) / Number(f[2]);
  return Number(raw);
}

function unitSeconds(unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith("s")) return 1;
  if (u.startsWith("m")) return 60;
  return 3600;
}

/**
 * Split a step into plain runs and tappable durations.
 *
 * 🔑 `metaSeconds` (the step's own `timerSeconds`) WINS when the text names
 * exactly one time. The header clock button is already preset from it, and
 * two controls on one screen that disagree about the same duration is worse
 * than either value being wrong.
 *
 * I only learned this was needed by running the parser over all 506 catalogue
 * steps: on a RANGE the provider is not even self-consistent — it takes the
 * upper bound of "25-30 minutes" (1800s) and the LOWER of "1 to 2 mins"
 * (60s). No rule of mine reproduces that, so on a single-time step I defer to
 * it rather than guess. Ranges still highlight whole ("25-30 minutes"), so
 * what you tapped reads as what the recipe said.
 *
 * 📌 When a step names SEVERAL times ("boil for 1 hour, preferably 2 hours")
 * the parsed values stand: one `timerSeconds` cannot describe them, and her
 * annotation highlights each.
 */
export function splitStepTimes(text: string, metaSeconds?: number): StepSegment[] {
  const out: StepSegment[] = [];
  let last = 0;
  TIME_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TIME_RE.exec(text)) !== null) {
    const seconds = Math.round(parseAmount(m[2] ?? m[1]) * unitSeconds(m[3]));
    // A "0 minutes" or a four-day soak the dial cannot hold is not a timer.
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_TIMER) continue;
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], seconds });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  if (metaSeconds !== undefined && metaSeconds > 0 && metaSeconds <= MAX_TIMER) {
    const times = out.filter((seg) => seg.seconds !== undefined);
    if (times.length === 1) times[0].seconds = metaSeconds;
  }
  return out.length ? out : [{ text }];
}

/**
 * Her idle chips ADD to the dial — `+1 min`, `+3 min`, `+10 min` (`5062:56766`).
 *
 * 🔑 They are the whole reason the sheet can reach an arbitrary duration. The
 * four FIXED chips this shipped with (1/3/10/15 min) *replaced* the value, so
 * those four were the only times a member could ever set — a 7-minute simmer
 * was unreachable, and so was every one of the 98 catalogue timers over an
 * hour. Increments compose; tapping the dial (`5062:56948`) types an exact
 * one. Lang drew both, and we had built neither.
 */
const BUMPS = [60, 180, 600];

/**
 * `brown-surface/on-brown-strong` — the near-white she sets on brown.
 *
 * 📌 NOT `K.bone` (#F3EFE3). Bone is the warm surface colour; this is the
 * cooler ink that sits on top of it, and the Start label and play mark are
 * both drawn in it.
 */
const ON_BROWN = "#fafdfe";

/** 99:59:59 — six digits is all the dial can show. */
const MAX_TIMER = 359999;

/**
 * ✅ Lang's chime, her Option 1 — *"cheerful, warm… a 'ding ding' letting you
 * know something's ready"* — picked by Bryan on 2026-10-23. It replaces the
 * two-note beep I had synthesised to stand in.
 *
 * 📌 Her file is untouched in sound and level (mean -25.1 dB, max -6.0 dB,
 * 1.672s): the ONLY change is that its 395ms of leading dead air was moved to
 * the tail. The asset loops, so that silence was inaudible between rings but
 * delayed the FIRST one by 395ms after the timer hit zero. Rotating it keeps
 * the loop period, and therefore the cadence, exactly as she drew it —
 * 1.237s of ring, then a 435ms rest.
 * ▶ If she ever sends a replacement, rotate its lead the same way or the
 * first ring lags; everything else is just dropping the file at this path.
 */
const ALARM_SOUND = require("../../../assets/audio/timer-complete.wav");

/** Her `alarm` glyph from the toast (`5062:58143`). */
const ALARM_ICON =
  "M12.75 12.6963V8.75C12.75 8.53717 12.6782 8.359 12.5345 8.2155C12.391 8.07183 12.2128 8 12 8C11.7872 8 11.609 8.07183 11.4655 8.2155C11.3218 8.359 11.25 8.53717 11.25 8.75V12.927C11.25 13.0475 11.2718 13.1623 11.3155 13.2713C11.359 13.3801 11.4276 13.4813 11.5212 13.575L14.4462 16.5C14.5846 16.6385 14.7586 16.7093 14.9683 16.7125C15.1779 16.7157 15.3552 16.6448 15.5 16.5C15.6448 16.3552 15.7173 16.1795 15.7173 15.973C15.7173 15.7667 15.6448 15.5911 15.5 15.4463L12.75 12.6963ZM8.68475 20.8307C7.65392 20.3846 6.75517 19.7782 5.9885 19.0115C5.22183 18.2448 4.61542 17.3461 4.16925 16.3152C3.72308 15.2846 3.5 14.1795 3.5 13C3.5 11.8205 3.72308 10.7154 4.16925 9.68475C4.61542 8.65392 5.22183 7.75517 5.9885 6.9885C6.75517 6.22183 7.65392 5.61542 8.68475 5.16925C9.71542 4.72308 10.8205 4.5 12 4.5C13.1795 4.5 14.2846 4.72308 15.3153 5.16925C16.3461 5.61542 17.2448 6.22183 18.0115 6.9885C18.7782 7.75517 19.3846 8.65392 19.8307 9.68475C20.2769 10.7154 20.5 11.8205 20.5 13C20.5 14.1795 20.2769 15.2846 19.8307 16.3152C19.3846 17.3461 18.7782 18.2448 18.0115 19.0115C17.2448 19.7782 16.3461 20.3846 15.3153 20.8307C14.2846 21.2769 13.1795 21.5 12 21.5C10.8205 21.5 9.71542 21.2769 8.68475 20.8307ZM2.4155 7.28075C2.2705 7.13592 2.198 6.96025 2.198 6.75375C2.198 6.54742 2.2705 6.37183 2.4155 6.227L5.227 3.4155C5.3655 3.277 5.5395 3.20617 5.749 3.203C5.95867 3.19967 6.13592 3.2705 6.28075 3.4155C6.42558 3.56033 6.498 3.73592 6.498 3.94225C6.498 4.14875 6.42558 4.32442 6.28075 4.46925L3.46925 7.28075C3.33075 7.41925 3.15675 7.49008 2.94725 7.49325C2.73758 7.49642 2.56033 7.42558 2.4155 7.28075ZM21.5845 7.28075C21.4397 7.42558 21.2641 7.498 21.0578 7.498C20.8513 7.498 20.6756 7.42558 20.5308 7.28075L17.7193 4.46925C17.5808 4.33075 17.5099 4.15675 17.5068 3.94725C17.5036 3.73758 17.5744 3.56033 17.7193 3.4155C17.8641 3.2705 18.0397 3.198 18.2462 3.198C18.4526 3.198 18.6282 3.2705 18.773 3.4155L21.5845 6.227C21.723 6.3655 21.7938 6.5395 21.797 6.749C21.8003 6.95867 21.7295 7.13592 21.5845 7.28075ZM12 20C13.9437 20 15.5963 19.3192 16.9578 17.9577C18.3192 16.5963 19 14.9437 19 13C19 11.0563 18.3192 9.40375 16.9578 8.04225C15.5963 6.68075 13.9437 6 12 6C10.0563 6 8.40375 6.68075 7.04225 8.04225C5.68075 9.40375 5 11.0563 5 13C5 14.9437 5.68075 16.5963 7.04225 17.9577C8.40375 19.3192 10.0563 20 12 20Z";

/**
 * Keypad digits fill from the RIGHT, the way every phone timer behaves:
 * `7` → `00:00:07`, `730` → `00:07:30`.
 *
 * Each pair is read on its own and then summed, so `00:99:00` resolves to an
 * hour and thirty-nine minutes rather than being rejected mid-type.
 */
function digitsToSeconds(digits: string): number {
  const d = digits.padStart(6, "0");
  const hh = Number(d.slice(0, 2));
  const mm = Number(d.slice(2, 4));
  const ss = Number(d.slice(4, 6));
  return Math.min(MAX_TIMER, hh * 3600 + mm * 60 + ss);
}

/**
 * What the dial shows WHILE typing: the raw digit groups, not the normalised
 * total. Type `9`,`9` into the minutes and you see `00:99:00`; normalising to
 * `01:39:00` under your thumb reads like the field fighting you. It is
 * normalised on commit.
 */
function formatDigits(digits: string): string {
  const d = digits.padStart(6, "0");
  return `${d.slice(0, 2)}:${d.slice(2, 4)}:${d.slice(4, 6)}`;
}

export function CookModeScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<CookRoute>();
  const { recipeVersionId, plannedMealId, imageUrl, mealId } = route.params ?? ({} as any);

  const [session, setSession] = useState<CookModeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);

  const listRef = useRef<FlatList<CookModeStep | null>>(null);
  /** Guards the one-time scroll to a resumed position. */
  const restored = useRef(false);

  // --- timer ---
  /**
   * 🔑 DEADLINE-based, not decrement-based.
   *
   * The old loop subtracted one per `setInterval`, which drifts, cannot say
   * when the timer will actually finish, and silently loses time whenever the
   * interval is throttled. A deadline is the truth: remaining is derived from
   * it, and Lang's *"⏰ 10:01 PM"* finish line falls straight out of it.
   *
   * 📌 `remaining` holds the paused value when `deadline` is null, so pause and
   * resume are just "forget the deadline" and "make a new one".
   */
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerTotal, setTimerTotal] = useState(300);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const alarm = useAudioPlayer(ALARM_SOUND);

  const timerRunning = deadline !== null;
  const timerActive = remaining !== null;

  // Derive `remaining` from the deadline rather than counting down by hand.
  useEffect(() => {
    if (deadline === null) return;
    const sync = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setDeadline(null);
    };
    sync();
    const id = setInterval(sync, 250);
    return () => clearInterval(id);
  }, [deadline]);

  useEffect(() => {
    let cancelled = false;
    openCookMode(recipeVersionId, plannedMealId ?? null)
      .then((s) => {
        if (cancelled) return;
        setSession(s);
        setPage(s.currentStep);
      })
      .catch(() => {
        // A recipe with no steps 400s — 20 of 520 are genuinely no-cook. The
        // caller should not have offered Cook Mode, but if it did, say so
        // plainly rather than showing an empty screen.
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recipeVersionId, plannedMealId]);

  // Jump to the resumed step once the list has measured (COOK MODE r5).
  useEffect(() => {
    if (!session || restored.current || session.currentStep === 0) return;
    restored.current = true;
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: session.currentStep * SCREEN_W,
        animated: false,
      });
    }, 50);
    return () => clearTimeout(t);
  }, [session]);

  /**
   * "Save meal for next time" — the row Lang puts on `5062:58206`, between the
   * copy and Done. SAVED MEALS r7: one Save action owns the concept, so this
   * is the same favourite the bookmark on Recipe Details toggles, not a new
   * kind of save.
   */
  const [saved, setSaved] = useState(false);
  const [savePending, setSavePending] = useState(false);

  useEffect(() => {
    if (!mealId) return;
    let cancelled = false;
    getFavorites()
      .then((favs) => {
        if (!cancelled) setSaved(favs.some((f) => f.id === mealId));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mealId]);

  const toggleSaved = useCallback(async () => {
    if (!mealId || savePending) return;
    const next = !saved;
    setSaved(next);
    setSavePending(true);
    try {
      if (next) await addFavorite(mealId);
      else await removeFavorite(mealId);
    } catch {
      setSaved(!next);
    } finally {
      setSavePending(false);
    }
  }, [mealId, saved, savePending]);

  const steps = session?.steps ?? [];
  /** Steps plus one trailing page: the completion screen (her annotation). */
  const pages: Array<CookModeStep | null> = useMemo(
    () => [...steps, null],
    [steps],
  );
  const onCompletionPage = page >= steps.length && steps.length > 0;

  const persistStep = useCallback(
    (index: number) => {
      if (!session) return;
      // Fire-and-forget: losing one write costs only a resume position, and
      // blocking a swipe on a round trip would feel broken in a kitchen.
      setCookStep(session.sessionId, index).catch(() => {});
    },
    [session],
  );

  const onScrollEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
      if (next === page) return;
      setPage(next);
      if (next < steps.length) persistStep(next);
    },
    [page, steps.length, persistStep],
  );

  const finish = useCallback(async () => {
    if (session) {
      // 🔴 Emits cook_mode_completed — "moderate prep-intent signal only".
      // It does NOT mark the meal eaten or On plan.
      await completeCookMode(session.sessionId).catch(() => {});
    }
    navigation.goBack();
  }, [session, navigation]);

  /**
   * `override` is the duration the sheet has just been typed to.
   *
   * 🔑 It is passed rather than read back off `timerTotal` because the keypad
   * commits on blur and Start is a separate native event: whether React has
   * re-rendered in between is not something this screen should depend on. The
   * caller already knows the number, so it hands it over.
   */
  const beginTimer = useCallback(
    (override?: number) => {
      if (!session) return;
      const total = override ?? timerTotal;
      if (override !== undefined) setTimerTotal(override);
      setRemaining(total);
      setDeadline(Date.now() + total * 1000);
      setTimerOpen(false);
      startCookTimer(session.sessionId, page).catch(() => {});
    },
    [session, timerTotal, page],
  );

  /**
   * The controls Lang's running frame has and this screen had none of.
   *
   * 🔴 Before this you could start a timer and then do nothing to it. On a
   * recipe like Braised Short Ribs that means a THREE HOUR countdown with no
   * pause and no cancel — and reopening the sheet showed the *setup* state
   * with a Start button, offering to silently replace the running timer.
   */
  const pauseTimer = useCallback(() => setDeadline(null), []);

  const resumeTimer = useCallback(() => {
    setRemaining((r) => {
      if (r !== null && r > 0) setDeadline(Date.now() + r * 1000);
      return r;
    });
  }, []);

  const extendTimer = useCallback((bySeconds: number) => {
    setDeadline((d) => (d === null ? null : d + bySeconds * 1000));
    setRemaining((r) => (r === null ? null : r + bySeconds));
  }, []);

  const restartTimer = useCallback(() => {
    setRemaining(timerTotal);
    setDeadline(Date.now() + timerTotal * 1000);
  }, [timerTotal]);

  const cancelTimer = useCallback(() => {
    setDeadline(null);
    setRemaining(null);
    setTimerOpen(false);
  }, []);

  /** Her annotation's other half: a tap on the time opens the sheet AT it. */
  const openTimerAt = useCallback((seconds: number) => {
    setTimerTotal(seconds);
    setTimerOpen(true);
  }, []);

  /**
   * *"Rings (sound + vibration) until manually dismissed"* — her annotation on
   * the toast. So the alarm is tied to the STATE (a finished, uncleared
   * timer), not fired once as an event: it starts when `remaining` hits 0 and
   * stops only when something clears the timer.
   *
   * 📌 The sound loops rather than being re-triggered on a schedule, so the
   * cadence lives in the file and the two halves cannot drift apart.
   */
  const alarming = remaining === 0;
  useEffect(() => {
    if (!alarming) return;
    // The app already does this for Ester's voice call: without it iOS mutes
    // the ring on the hardware silent switch, which is exactly when someone
    // is relying on the buzz.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    try {
      alarm.loop = true;
      alarm.seekTo(0).catch(() => {});
      alarm.play();
    } catch {
      // A missing or unplayable asset must not take the timer down with it —
      // the buzz below is the half that always works.
    }
    const stopBuzz = startAlarmBuzz();
    return () => {
      try {
        alarm.pause();
      } catch {
        /* already released */
      }
      stopBuzz();
    };
  }, [alarming, alarm]);

  const openTimerFor = useCallback(
    (step?: CookModeStep) => {
      // Preselect the step's own duration when it has one, so the common case
      // is one tap: open, Start.
      setTimerTotal(step?.timerSeconds ?? 300);
      setTimerOpen(true);
    },
    [],
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={["top"]}>
        <ActivityIndicator color={K.bone} />
      </SafeAreaView>
    );
  }

  if (failed || !session) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={["top"]}>
        <Text style={styles.empty}>This recipe doesn't have cooking steps.</Text>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.emptyAction}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close cook mode"
          style={styles.iconButton}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M6 6l12 12M18 6L6 18" stroke={K.bone} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Pressable>

        <ProgressBars total={steps.length} current={page} />

        {/* Her frame hides the timer button on the completion page
            (opacity 0), so it is simply not rendered there. */}
        {onCompletionPage ? (
          <View style={styles.iconButtonPlaceholder} />
        ) : (
          <Pressable
            onPress={() => openTimerFor(steps[page])}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={
              timerActive ? "Cooking timer, running" : "Set cooking timer"
            }
            style={[styles.timerButton, timerActive && styles.timerButtonActive]}
          >
            {/* Her active state (`5062:56689`, annotated *"Indicates timer is
                active"*) is the blue surface with the same white sheen the
                Start button carries.
                📌 The Rect is rounded to `rx={20}` on a 40pt button rather
                than clipped with `overflow: "hidden"`, because the clip would
                also cut the glow this button casts. */}
            {timerActive ? (
              <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                <Defs>
                  <LinearGradient id="timerSheen" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#ffffff" stopOpacity={0.2} />
                    <Stop offset="0.63275" stopColor="#ffffff" stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" rx={20} fill="url(#timerSheen)" />
              </Svg>
            ) : null}
            {/* Her exported `timer` glyph. This was a hand-drawn circle with
                two hands, which read thinner and sat a touch low against the
                rest of her icon set. */}
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M9.94225 2.75C9.72942 2.75 9.55125 2.67817 9.40775 2.5345C9.26408 2.391 9.19225 2.21283 9.19225 2C9.19225 1.78717 9.26408 1.609 9.40775 1.4655C9.55125 1.32183 9.72942 1.25 9.94225 1.25H14.0577C14.2706 1.25 14.4487 1.32183 14.5922 1.4655C14.7359 1.609 14.8077 1.78717 14.8077 2C14.8077 2.21283 14.7359 2.391 14.5922 2.5345C14.4487 2.67817 14.2706 2.75 14.0577 2.75H9.94225ZM12.5345 13.5922C12.6782 13.4487 12.75 13.2706 12.75 13.0577V8.94225C12.75 8.72942 12.6782 8.55125 12.5345 8.40775C12.391 8.26408 12.2128 8.19225 12 8.19225C11.7872 8.19225 11.609 8.26408 11.4655 8.40775C11.3218 8.55125 11.25 8.72942 11.25 8.94225V13.0577C11.25 13.2706 11.3218 13.4487 11.4655 13.5922C11.609 13.7359 11.7872 13.8077 12 13.8077C12.2128 13.8077 12.391 13.7359 12.5345 13.5922ZM8.7 20.8307C7.66917 20.3846 6.76792 19.7756 5.99625 19.0038C5.22442 18.2321 4.61542 17.3308 4.16925 16.3C3.72308 15.2692 3.5 14.1692 3.5 13C3.5 11.8308 3.72308 10.7308 4.16925 9.7C4.61542 8.66917 5.22442 7.76792 5.99625 6.99625C6.76792 6.22442 7.66917 5.61542 8.7 5.16925C9.73083 4.72308 10.8308 4.5 12 4.5C13.0013 4.5 13.9657 4.66992 14.8932 5.00975C15.8207 5.34942 16.682 5.83592 17.477 6.46925L18.1962 5.75C18.3346 5.6115 18.5086 5.54067 18.7182 5.5375C18.9279 5.53433 19.1052 5.60517 19.25 5.75C19.3948 5.89483 19.4672 6.0705 19.4672 6.277C19.4672 6.48333 19.3948 6.65892 19.25 6.80375L18.5307 7.523C19.1641 8.318 19.6506 9.17925 19.9902 10.1068C20.3301 11.0343 20.5 11.9987 20.5 13C20.5 14.1692 20.2769 15.2692 19.8307 16.3C19.3846 17.3308 18.7756 18.2321 18.0038 19.0038C17.2321 19.7756 16.3308 20.3846 15.3 20.8307C14.2692 21.2769 13.1692 21.5 12 21.5C10.8308 21.5 9.73083 21.2769 8.7 20.8307ZM16.95 17.95C18.3167 16.5833 19 14.9333 19 13C19 11.0667 18.3167 9.41667 16.95 8.05C15.5833 6.68333 13.9333 6 12 6C10.0667 6 8.41667 6.68333 7.05 8.05C5.68333 9.41667 5 11.0667 5 13C5 14.9333 5.68333 16.5833 7.05 17.95C8.41667 19.3167 10.0667 20 12 20C13.9333 20 15.5833 19.3167 16.95 17.95Z" fill={timerActive ? K.brown : ON_BROWN} />
            </Svg>
          </Pressable>
        )}
      </View>

      {/* Her toast sits at the TOP (`5062:58141` is at y=43 of an 874 frame),
          which is over this screen's own header. That is what she drew, and
          the alarm is transient — its Done hands the header straight back.
          It is suppressed while the sheet is open, because the sheet's own
          "Timer complete" face is already the dismissal there. */}
      {alarming && !timerOpen ? <TimerToast onDismiss={cancelTimer} /> : null}

      {remaining !== null ? (
        <Pressable style={styles.runningTimer} onPress={() => setTimerOpen(true)}>
          <Text style={styles.runningTimerText}>
            {remaining === 0 ? "Timer done" : formatDuration(remaining)}
          </Text>
        </Pressable>
      ) : null}

      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(item, i) => (item ? `step-${item.index}` : `done-${i}`)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
        renderItem={({ item }) =>
          item ? (
            <StepPage step={item} onPickTime={openTimerAt} />
          ) : (
            <CompletionPage
              title={session.title}
              imageUrl={imageUrl}
              canSave={!!mealId}
              saved={saved}
              onToggleSave={toggleSaved}
              onDone={finish}
            />
          )
        }
      />

      <TimerSheet
        visible={timerOpen}
        seconds={timerTotal}
        active={timerActive}
        running={timerRunning}
        remaining={remaining}
        deadline={deadline}
        onPick={setTimerTotal}
        onStart={beginTimer}
        onPause={pauseTimer}
        onResume={resumeTimer}
        onExtend={extendTimer}
        onRestart={restartTimer}
        onCancel={cancelTimer}
        onClose={() => setTimerOpen(false)}
      />
    </SafeAreaView>
  );
}

/**
 * Her 160pt segmented bar.
 *
 * 🔴 She drew FIVE segments; real recipes run to 22 steps, which at her gap
 * would need more width than the bar has. Above the threshold the segments
 * become one continuous bar with a proportional fill — the same visual
 * language at a size it still reads at, rather than 22 slivers.
 */
function ProgressBars({ total, current }: { total: number; current: number }) {
  const MAX_SEGMENTS = 8;
  if (total <= MAX_SEGMENTS) {
    return (
      <View style={styles.progress}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[styles.segment, i <= current ? styles.segmentFull : styles.segmentEmpty]}
          />
        ))}
      </View>
    );
  }
  const pct = total > 0 ? Math.min(1, (current + 1) / total) : 0;
  return (
    <View style={styles.progress}>
      <View style={[styles.segment, styles.segmentEmpty]}>
        <View style={[styles.continuousFill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

function StepPage({
  step,
  onPickTime,
}: {
  step: CookModeStep;
  onPickTime: (seconds: number) => void;
}) {
  const segments = useMemo(
    () => splitStepTimes(step.text, step.timerSeconds),
    [step.text, step.timerSeconds],
  );
  return (
    <ScrollView style={{ width: SCREEN_W }} contentContainerStyle={styles.page}>
      <Text style={styles.stepLabel}>Step {step.index + 1}</Text>
      {/* Her `5062:58199`: the duration is inked blue and is the control that
          opens the timer, already set to it. The nested <Text> is what makes a
          run of a paragraph tappable without breaking the line wrapping. */}
      <Text style={styles.stepText}>
        {segments.map((seg, i) =>
          seg.seconds === undefined ? (
            <Text key={i}>{seg.text}</Text>
          ) : (
            <Text
              key={i}
              style={styles.stepTime}
              onPress={() => onPickTime(seg.seconds as number)}
              suppressHighlighting
              accessibilityRole="button"
              accessibilityLabel={`Set a timer for ${seg.text}`}
            >
              {seg.text}
            </Text>
          ),
        )}
      </Text>

      {step.ingredients.length > 0 ? (
        <View style={styles.ingredients}>
          {step.ingredients.map((ing, i) => (
            <View
              key={`${ing.name}-${i}`}
              style={[
                styles.ingredientRow,
                i === step.ingredients.length - 1 && styles.ingredientRowLast,
              ]}
            >
              {/* Her annotation: "If ingredients are 'to taste,' show only in
                  quantity section" — so a row with no quantity puts its text
                  in the quantity column and leaves the name column empty. */}
              {ing.quantity ? (
                <>
                  <Text style={styles.ingredientQty}>{ing.quantity}</Text>
                  <Text style={styles.ingredientName}>{ing.name}</Text>
                </>
              ) : (
                <Text style={styles.ingredientToTaste}>{ing.name}</Text>
              )}
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function CompletionPage({
  title,
  imageUrl,
  canSave,
  saved,
  onToggleSave,
  onDone,
}: {
  title: string;
  imageUrl?: string;
  /** False when Cook Mode was opened without a meal id — no row rather than a
   *  dead one. */
  canSave: boolean;
  saved: boolean;
  onToggleSave: () => void;
  onDone: () => void;
}) {
  return (
    <View style={[styles.page, styles.completion, { width: SCREEN_W }]}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.completionImage} /> : null}
      <Text style={styles.completionLabel}>All steps complete</Text>
      <Text style={styles.completionTitle}>{title} is ready!</Text>
      <Text style={styles.completionSub}>Nice work, chef.</Text>
      <View style={styles.completionSpacer} />

      {canSave ? (
        <Pressable
          style={styles.saveRow}
          onPress={onToggleSave}
          accessibilityRole="switch"
          accessibilityState={{ checked: saved }}
          accessibilityLabel="Save meal for next time"
        >
          <Text style={styles.saveRowText}>Save meal for next time</Text>
          <BookmarkIcon filled={saved} color={K.bone} />
        </Pressable>
      ) : null}
      <Pressable
        style={styles.doneButton}
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel="Done"
      >
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
    </View>
  );
}

/**
 * Her "Timer complete" toast (`5062:58141`).
 *
 * 📌 Catalogue, not DM Sans — her node names `Style/Sans serif` = Catalogue,
 * and 35 other screens already use it. ⚠️ The REST of this screen is still
 * `fonts.dmSans`, which is a pre-existing miss against the same token on her
 * Step node (`5062:58199` is Catalogue at 32px too); flagged, not fixed here.
 */
function TimerToast({ onDismiss }: { onDismiss: () => void }) {
  /**
   * 🔴 The inset has to be applied here, not inherited. This is an
   * ABSOLUTELY positioned child, and in RN those are placed against the
   * parent's border box — the enclosing `SafeAreaView`'s padding does not
   * move them. Without this the toast drew under the status bar, with the
   * clock sitting on top of "Timer complete".
   */
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.toast, { top: insets.top + 8 }]} accessibilityLiveRegion="assertive">
      <View style={styles.toastLeft}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d={ALARM_ICON} fill="#B0A3A4" />
        </Svg>
        <Text style={styles.toastText}>Timer complete</Text>
      </View>
      <Pressable
        style={styles.toastDone}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss the timer"
      >
        <Text style={styles.toastDoneText}>Done</Text>
      </Pressable>
    </View>
  );
}

/** Her "Set cooking timer" sheet (`5062:56948`) — a LIGHT surface. */
/** "10:01 PM" — Lang puts the finish time under the countdown. */
function clockAt(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function TimerSheet({
  visible,
  seconds,
  active,
  running,
  remaining,
  deadline,
  onPick,
  onStart,
  onPause,
  onResume,
  onExtend,
  onRestart,
  onCancel,
  onClose,
}: {
  visible: boolean;
  seconds: number;
  /** A timer exists — running or paused. Decides which face the sheet shows. */
  active: boolean;
  running: boolean;
  remaining: number | null;
  deadline: number | null;
  onPick: (s: number) => void;
  onStart: (seconds?: number) => void;
  onPause: () => void;
  onResume: () => void;
  onExtend: (bySeconds: number) => void;
  onRestart: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const done = active && remaining === 0;

  /**
   * Tapping the dial types an exact time (`5062:56948`). The keypad is the
   * OS number pad, owned by a 1pt invisible input; the dial above is what the
   * member actually reads.
   */
  const [editing, setEditing] = useState(false);
  const [digits, setDigits] = useState("");
  const [caretOn, setCaretOn] = useState(true);
  const input = useRef<TextInput>(null);

  /**
   * How much of the screen the keypad is eating.
   *
   * 🔴 Found on a device pass, not in review: with the keypad up the dial sat
   * BEHIND it, so you could not see the number you were typing — the one
   * thing the whole edit state exists to show. A `Modal` is its own window
   * and does not resize for the keyboard, so the sheet has to move itself.
   */
  const [keyboardH, setKeyboardH] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, (e) => setKeyboardH(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  /**
   * The seconds currently ON THE DIAL, whenever that differs from what the
   * parent last rendered; null means "the prop is right".
   *
   * 🔑 A ref, not state, and deliberately NOT cleared on commit. Pressing
   * Start while the keypad is up fires a blur and a press as two separate
   * native events, and nothing guarantees a re-render between them — so Start
   * reads this and hands the number to `beginTimer` outright instead of
   * trusting `seconds` to have caught up. The old sheet could not hit this
   * because there was nothing to type.
   */
  const typedRef = useRef<number | null>(null);

  // The sheet is a Modal: closing it must not strand the keypad or carry a
  // half-typed duration into the next step's timer.
  useEffect(() => {
    if (visible) return;
    typedRef.current = null;
    setDigits("");
    setEditing(false);
  }, [visible]);

  useEffect(() => {
    if (!editing) return;
    setCaretOn(true);
    const t = setInterval(() => setCaretOn((c) => !c), 530);
    return () => clearInterval(t);
  }, [editing]);

  const commit = useCallback(() => {
    setDigits("");
    setEditing(false);
    if (typedRef.current !== null) onPick(typedRef.current);
  }, [onPick]);

  /** `+1 min` and friends add to whatever the dial reads right now. */
  const bump = useCallback(
    (by: number) => {
      const next = Math.min(MAX_TIMER, (typedRef.current ?? seconds) + by);
      typedRef.current = next;
      setDigits("");
      setEditing(false);
      input.current?.blur();
      onPick(next);
    },
    [seconds, onPick],
  );

  // Fraction elapsed, for Lang's progress ring.
  const elapsed =
    active && remaining !== null && seconds > 0
      ? Math.min(1, Math.max(0, 1 - remaining / seconds))
      : 0;
  /**
   * The dial shrinks while the keypad is up.
   *
   * 🔴 Found on the S24 (360x780dp), NOT on the sim. Lifting the sheet clear
   * of the keypad leaves only 438dp, and the sheet at its resting height
   * wants ~440 — so it ran to y=0, under the 34dp status bar, and lost its
   * grabber and rounded top. iOS had just enough room to hide this. A
   * narrower dial buys the ~40dp back on every phone.
   */
  const ringSize = keyboardH > 0 ? 168 : 212;
  const R = ringSize / 2 - 6;
  const C = 2 * Math.PI * R;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      /**
       * 🔴 Android's hardware back used to close the WHOLE sheet while the
       * keypad was up, throwing away a half-typed duration. Back should
       * dismiss the keypad first, the way it does everywhere else on the
       * platform — the second press then closes the sheet.
       */
      onRequestClose={() => {
        if (editing) {
          commit();
          return;
        }
        onClose();
      }}
    >
      <View style={styles.sheetBackdrop}>
        <View
          style={[
            styles.sheet,
            // Lift clear of the keypad, and let the sheet shrink to fit what
            // is left rather than keeping its full resting height.
            /**
             * 🔴 `paddingBottom` STAYS at the resting 32. I trimmed it to 12 to
             * claw back height and the S24 ate the difference: Android's
             * reported keyboard height runs ~14dp short of what the IME
             * actually occupies (its toolbar strip), so the sheet sat that far
             * below the keypad's top edge and the Start button lost its bottom
             * corners. The padding is the slack that absorbs it. Only the top
             * is trimmed.
             */
            keyboardH > 0 && { marginBottom: keyboardH, minHeight: 0, paddingTop: 8 },
          ]}
        >
          <View style={styles.sheetGrabber} />
          <Pressable style={styles.sheetClose} onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M6 6l12 12M18 6L6 18" stroke={K.brown} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Pressable>
          <Text style={styles.sheetTitle}>
            {done ? "Timer complete" : active ? "Cooking timer" : "Set cooking timer"}
          </Text>

          <View style={[styles.ring, { width: ringSize, height: ringSize }]}>
            {/* The ring fills as the timer runs — her running frame draws the
                arc rather than a bare circle. */}
            <Svg width={ringSize} height={ringSize} style={styles.ringSvg}>
              {/* Idle: Lang draws a solid dark circle. Running: the track goes
                  faint so the progress arc is what reads. */}
              <Circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={R}
                stroke={active ? "rgba(54,20,22,0.18)" : K.brown}
                strokeWidth={3}
                fill="none"
              />
              {active ? (
                <Circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={R}
                  stroke={K.brown}
                  strokeWidth={2.5}
                  fill="none"
                  strokeDasharray={`${C}`}
                  strokeDashoffset={C * elapsed}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                />
              ) : null}
            </Svg>
            {active ? (
              <Text style={[styles.ringText, keyboardH > 0 && styles.ringTextCompact]}>
                {formatDuration(remaining !== null ? remaining : seconds)}
              </Text>
            ) : (
              <Pressable
                style={styles.ringTap}
                hitSlop={10}
                onPress={() => {
                  setEditing(true);
                  setDigits("");
                  input.current?.focus();
                }}
                accessibilityRole="button"
                /* 🔴 Was `formatDuration(seconds)`, i.e. the PROP — so while
                   you typed, VoiceOver kept reading the old duration back
                   while the dial showed the new one. It has to announce what
                   is on the dial. */
                accessibilityLabel={
                  editing
                    ? `Typing a time: ${digits ? formatDigits(digits) : formatDuration(seconds)}`
                    : `Timer set to ${formatDuration(seconds)}. Tap to type a time.`
                }
              >
                <Text
                  style={[
                    styles.ringText,
                    keyboardH > 0 && styles.ringTextCompact,
                    editing && styles.ringTextEditing,
                  ]}
                >
                  {editing && digits ? formatDigits(digits) : formatDuration(seconds)}
                </Text>
                {editing ? <View style={[styles.caret, !caretOn && styles.caretOff]} /> : null}
              </Pressable>
            )}
            {running && deadline !== null ? (
              <View style={styles.ringFinishRow}>
                {/* 🔴 NOT the character ⏰ (U+23F0). I used it, and it shipped
                    to the simulator as a RED EMOJI — the third time this
                    exact trap has bitten this screen after ▶ twice. Any
                    pictograph in this range has emoji presentation on iOS;
                    draw it. */}
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Circle cx={12} cy={13} r={8} stroke="#8a7a74" strokeWidth={1.8} />
                  <Path
                    d="M12 9.5V13l2.2 1.6M9 2.8h6"
                    stroke="#8a7a74"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                  />
                </Svg>
                <Text style={styles.ringFinish}>{clockAt(deadline)}</Text>
              </View>
            ) : null}
            {active && !running && !done ? (
              <Text style={styles.ringFinish}>Paused</Text>
            ) : null}
          </View>

          {active ? (
            /* Running: add time, as Lang's +0:30 / +1:00. */
            !done ? (
              <View style={styles.presets}>
                <Pressable style={styles.preset} onPress={() => onExtend(30)} accessibilityRole="button">
                  <Text style={styles.presetText}>+ 0:30</Text>
                </Pressable>
                <Pressable style={styles.preset} onPress={() => onExtend(60)} accessibilityRole="button">
                  <Text style={styles.presetText}>+ 1:00</Text>
                </Pressable>
              </View>
            ) : null
          ) : (
            <View style={[styles.presets, keyboardH > 0 && styles.presetsTight]}>
              {BUMPS.map((b) => (
                <Pressable
                  key={b}
                  style={styles.preset}
                  onPress={() => bump(b)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${b / 60} ${b === 60 ? "minute" : "minutes"}`}
                >
                  <Text style={styles.presetText}>+{b / 60} min</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* 🔑 Android's number pad has NO return key, so tapping the empty
              middle of the sheet is the way out of the keypad there. */}
          <Pressable
            style={[styles.sheetSpacer, keyboardH > 0 && styles.sheetSpacerTight]}
            onPress={editing ? commit : undefined}
            accessible={false}
          />
          {active ? (
            /* Restart · pause/resume · cancel — her three running controls. */
            <View style={styles.timerControls}>
              <Pressable
                style={styles.controlSecondary}
                onPress={onRestart}
                accessibilityRole="button"
                accessibilityLabel="Restart timer"
              >
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5"
                    stroke={K.brown}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>

              <Pressable
                style={styles.controlPrimary}
                onPress={done ? onCancel : running ? onPause : onResume}
                accessibilityRole="button"
                accessibilityLabel={done ? "Dismiss timer" : running ? "Pause timer" : "Resume timer"}
              >
                {/* The same sheen the Start button carries — her Rounded
                    Icon button is the same surface (`5062:57971`). */}
                <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                  <Defs>
                    <LinearGradient id="controlSheen" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor="#ffffff" stopOpacity={0.2} />
                      <Stop offset="0.63275" stopColor="#ffffff" stopOpacity={0} />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="100%" height="100%" fill="url(#controlSheen)" />
                </Svg>
                {done ? (
                  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                    <Path d="M5 13l4 4L19 7" stroke={ON_BROWN} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                ) : running ? (
                  /* 🔴 Was two 2.4pt hairlines (`M9 5v14M15 5v14`). Her `pause`
                     is a FILLED pair of bars with rounded corners, which is
                     why this read as spindly next to her frame. */
                  <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
                    <Path d="M18.0833 21.5833C17.6062 21.5833 17.1952 21.411 16.8505 21.0662C16.5057 20.7215 16.3333 20.3105 16.3333 19.8333V8.16667C16.3333 7.6895 16.5057 7.27854 16.8505 6.93379C17.1952 6.58904 17.6062 6.41667 18.0833 6.41667H18.9583C19.4355 6.41667 19.8465 6.58904 20.1912 6.93379C20.536 7.27854 20.7083 7.6895 20.7083 8.16667V19.8333C20.7083 20.3105 20.536 20.7215 20.1912 21.0662C19.8465 21.411 19.4355 21.5833 18.9583 21.5833H18.0833ZM9.04167 21.5833C8.5645 21.5833 8.15354 21.411 7.80879 21.0662C7.46404 20.7215 7.29167 20.3105 7.29167 19.8333V8.16667C7.29167 7.6895 7.46404 7.27854 7.80879 6.93379C8.15354 6.58904 8.5645 6.41667 9.04167 6.41667H9.91667C10.3938 6.41667 10.8048 6.58904 11.1495 6.93379C11.4943 7.27854 11.6667 7.6895 11.6667 8.16667V19.8333C11.6667 20.3105 11.4943 20.7215 11.1495 21.0662C10.8048 21.411 10.3938 21.5833 9.91667 21.5833H9.04167Z" fill={ON_BROWN} />
                  </Svg>
                ) : (
                  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                    <Path d="M8 19V5L19 12L8 19Z" fill={ON_BROWN} />
                  </Svg>
                )}
              </Pressable>

              <Pressable
                style={styles.controlSecondary}
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel timer"
              >
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path d="M6 6l12 12M18 6L6 18" stroke={K.brown} strokeWidth={2} strokeLinecap="round" />
                </Svg>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.startButton, (typedRef.current ?? seconds) === 0 && styles.startDisabled]}
              disabled={(typedRef.current ?? seconds) === 0}
              onPress={() => {
                const typed = typedRef.current;
                typedRef.current = null;
                setDigits("");
                setEditing(false);
                onStart(typed ?? undefined);
              }}
              accessibilityRole="button"
            >
              {/* Her white sheen over the brown: 20% at the top, gone by 63%
                  (`5062:56792`). Drawn rather than approximated with a flat
                  fill, which is what this was. */}
              <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                <Defs>
                  <LinearGradient id="startSheen" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#ffffff" stopOpacity={0.2} />
                    <Stop offset="0.63275" stopColor="#ffffff" stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#startSheen)" />
              </Svg>
              {/* 🔴 Was the character ▶ (U+25B6) inline in the label. On iOS that
                  has EMOJI presentation by default, so the button rendered a blue
                  colour emoji against a brown pill — caught on a device pass, not
                  by tsc, because it is a perfectly valid string. Drawn as SVG
                  instead, the way every other icon in this file is, so it
                  inherits the label's colour. The pause/resume glyphs above are
                  drawn for the same reason. */}
              <View style={styles.startRow}>
                {/* Her `play` mark, at its own 24pt box so the 12pt gap to the
                    label lands where she set it. */}
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d="M8 19V5L19 12L8 19Z" fill={ON_BROWN} />
                </Svg>
                <Text style={styles.startText}>Start</Text>
              </View>
            </Pressable>
          )}

          {!active ? (
            <TextInput
              ref={input}
              style={styles.keypadInput}
              value={digits}
              onChangeText={(t) => {
                const next = t.replace(/[^0-9]/g, "").slice(0, 6);
                typedRef.current = next ? digitsToSeconds(next) : null;
                setDigits(next);
              }}
              onBlur={commit}
              onSubmitEditing={commit}
              keyboardType="number-pad"
              returnKeyType="done"
              caretHidden
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.brown },
  centered: { alignItems: "center", justifyContent: "center", gap: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
  },
  iconButton: { padding: 8 },
  iconButtonPlaceholder: { width: 40, height: 40 },
  timerButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: "#513436",
    alignItems: "center",
    justifyContent: "center",
  },
  /**
   * *"Indicates timer is active"* — her `5062:56689`.
   *
   * 🔑 The GLOW is the signal, not just the fill: `0 0 8.3px #92b4bd`, which
   * is the blue bleeding past its own edge. `boxShadow` lands on both
   * platforms from RN 0.76 (this repo is 0.83) and `PaywallScreen` already
   * marks the chosen plan the same way.
   * 📌 Active, not RUNNING: a paused timer still exists, and a member who
   * paused one needs to see that it is still there.
   */
  timerButtonActive: {
    backgroundColor: K.blue,
    boxShadow: "0px 0px 8.3px 0px #92b4bd",
  },
  progress: { flexDirection: "row", gap: 4, width: 160 },
  segment: { flex: 1, height: 2, borderRadius: 999, overflow: "hidden" },
  segmentFull: { backgroundColor: K.bone },
  segmentEmpty: { backgroundColor: "rgba(250,253,254,0.24)" },
  continuousFill: { height: 2, backgroundColor: K.bone },
  /**
   * `5062:58141`: 380 wide on a 402 frame ⇒ 11 either side, radius 16.
   *
   * 🔴🔴 This is a DARK card, and I built it white. `get_design_context`
   * returns colours as `var(--page-surface, #fafdfe)` and I read those hexes
   * as the values — they are only the generator's FALLBACKS, and this node
   * resolves almost every one of them to something else. Measured off the
   * actual render: the surface is K.brown and `#fafdfe` is the TEXT. I had
   * the two exactly backwards.
   * ▶ Trust a `var()` fallback for nothing. Sample the render.
   */
  toast: {
    position: "absolute",
    left: 11,
    right: 11,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    paddingBottom: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    // A hairline highlight, not a bone rule: measured (79,50,52) over the
    // brown, which is the near-white at ~12%.
    borderColor: "rgba(250,253,254,0.12)",
    backgroundColor: K.brown,
    // Her drop shadow, then the three insets that weight its bottom edge.
    boxShadow:
      "0px 2px 3px 0px rgba(34,10,10,0.38), inset 0px 0px 1px 0px rgba(0,0,0,0.07), inset 0px -9px 4px 0px rgba(54,20,22,0.44), inset 0px -5px 10px 0px rgba(54,20,22,0.38)",
  },
  toastLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  toastText: {
    fontFamily: fonts.catalogue,
    fontSize: 24,
    letterSpacing: -0.24,
    color: ON_BROWN,
  },
  toastDone: {
    width: 73,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    // Measured (101,76,78) over the brown ⇒ the near-white at 24%.
    backgroundColor: "rgba(250,253,254,0.24)",
  },
  toastDoneText: { fontFamily: fonts.catalogueMedium, fontSize: 14, color: ON_BROWN },
  runningTimer: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#513436",
    marginBottom: 8,
  },
  runningTimerText: { fontFamily: fonts.catalogue, fontSize: 16, color: ON_BROWN, letterSpacing: -0.16 },
  page: { paddingHorizontal: 24, paddingBottom: 40, gap: 24 },
  stepLabel: {
    fontFamily: fonts.quadrant,
    fontSize: 16,
    letterSpacing: -0.16,
    color: "#b0a3a4",
  },
  /* Her Title 1 — "Big type" is COOK MODE r6's own words, and it is the
     point of the screen: readable at arm's length with wet hands. */
  stepText: {
    fontFamily: fonts.catalogue,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.32,
    color: ON_BROWN,
    marginTop: -16,
  },
  /**
   * Lang's blue for a duration (`5062:58199`).
   *
   * 📌 `#a2ccd7`, a lighter tint of `K.blue` (#92B4BD) — the spans she puts
   * either side of the phrase carry K.blue exactly, but the glyphs themselves
   * are the lighter one, which is what holds up against the brown page.
   */
  stepTime: { color: "#a2ccd7" },
  ingredients: { gap: 8 },
  /**
   * 🔑 The rule goes ABOVE each row, with one more closing the list — four
   * rules for three ingredients on her frame (`5062:56622`, measured at
   * y=326/366/405/444pt). We ruled only BELOW each, so the list had nothing
   * separating it from the step text above it.
   */
  ingredientRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#7e6869",
  },
  /** The rule that closes the list. */
  ingredientRowLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#7e6869",
  },
  ingredientQty: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    letterSpacing: -0.16,
    color: "#b0a3a4",
    width: 72,
  },
  ingredientName: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 16,
    letterSpacing: -0.16,
    color: ON_BROWN,
  },
  ingredientToTaste: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    letterSpacing: -0.16,
    color: "#b0a3a4",
  },
  completion: { alignItems: "center", paddingTop: 24 },
  completionImage: {
    width: 120,
    height: 120,
    borderRadius: 4,
    borderTopLeftRadius: 8,
    borderBottomRightRadius: 16,
  },
  completionLabel: { fontFamily: fonts.quadrant, fontSize: 16, color: "#b0a3a4", letterSpacing: -0.16 },
  completionTitle: {
    fontFamily: fonts.catalogue,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.32,
    color: ON_BROWN,
    textAlign: "center",
    marginTop: -16,
  },
  completionSub: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    letterSpacing: -0.2,
    color: "#b0a3a4",
    textAlign: "center",
  },
  completionSpacer: { flex: 1, minHeight: 24 },
  doneButton: {
    width: "100%",
    height: 56,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(250,253,254,0.24)",
  },
  doneText: { fontFamily: fonts.catalogue, fontSize: 20, letterSpacing: -0.2, color: ON_BROWN },
  empty: {
    fontFamily: fonts.catalogue,
    fontSize: 18,
    color: "#b0a3a4",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  emptyAction: { fontFamily: fonts.catalogue, fontSize: 16, color: ON_BROWN, textDecorationLine: "underline" },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(24,10,10,0.6)", justifyContent: "flex-end" },
  /* Her sheet is the LIGHT surface — bone, not the screen's brown. */
  sheet: {
    backgroundColor: K.bone,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    minHeight: 520,
    alignItems: "center",
  },
  sheetGrabber: {
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(54,20,22,0.25)",
    marginBottom: 12,
  },
  sheetClose: { position: "absolute", right: 20, top: 20, padding: 6 },
  sheetTitle: {
    fontFamily: fonts.catalogue,
    fontSize: 24,
    letterSpacing: -0.24,
    color: K.brown,
    marginBottom: 24,
  },
  ring: {
    width: 212,
    height: 212,
    borderRadius: 999,
    // 🔑 No border here any more — the SVG below draws both the track and the
    // progress arc. Leaving the border on would double the outline.
    alignItems: "center",
    justifyContent: "center",
  },
  ringFinishRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  ringFinish: {
    fontFamily: fonts.catalogue,
    fontSize: 14,
    letterSpacing: -0.14,
    color: "#8a7a74",
  },
  /** Restart · pause/resume · cancel, as Lang lays them out. */
  timerControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingBottom: 4,
  },
  /**
   * 56pt, not 68 — measured off her running frame, where the primary is 56
   * and the two secondaries are 40. Ours were 68/52, which made all three
   * near enough the same size that the row lost its centre.
   */
  controlPrimary: {
    width: 56,
    height: 56,
    borderRadius: 999,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: K.brown,
  },
  controlSecondary: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(54,20,22,0.10)",
  },
  ringSvg: { position: "absolute", top: 0, left: 0 },
  /**
   * 🔴 Was `#8a7a74`, the same muted tone as the finish time under it. In
   * Lang's frames the dial is full-strength brown and only the `10:01 PM`
   * line is muted — and with both grey there is no shade left to say
   * "being edited", which is exactly what `5062:56948` needs.
   */
  ringText: {
    fontFamily: fonts.catalogue,
    fontSize: 38,
    letterSpacing: -0.38,
    color: K.brown,
  },
  /** Her edit state greys the dial while the keypad owns it. */
  ringTextEditing: { color: "rgba(54,20,22,0.45)" },
  ringTextCompact: { fontSize: 30, letterSpacing: -0.3 },
  ringTap: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  caret: { width: 2, height: 26, marginLeft: 3, borderRadius: 1, backgroundColor: K.brown },
  caretOff: { opacity: 0 },
  /**
   * 1pt, not zero — iOS will not raise the keyboard for an input with no
   * layout, and a zero-size one fails silently.
   */
  keypadInput: { position: "absolute", top: 0, left: 0, width: 1, height: 1, opacity: 0 },
  presets: { flexDirection: "row", gap: 12, marginTop: 28 },
  presetsTight: { marginTop: 14 },
  preset: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
    backgroundColor: "rgba(250,253,254,0.75)",
  },
  presetText: { fontFamily: fonts.catalogue, fontSize: 14, color: K.brown, letterSpacing: -0.14 },
  sheetSpacer: { flex: 1, minHeight: 24, width: "100%" },
  sheetSpacerTight: { flex: 0, minHeight: 16 },
  saveRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(243,239,227,0.18)",
  },
  saveRowText: {
    fontFamily: fonts.catalogue,
    fontSize: 17,
    letterSpacing: -0.17,
    color: ON_BROWN,
  },
  /**
   * 🔴 Was `borderRadius: 999`, a full pill. Her button is a near-square
   * rectangle with ONE large corner — 4pt on three and 24pt on the top right
   * (`5062:56792`). That single swept corner is the shape of the thing, and a
   * pill threw it away.
   */
  startButton: {
    width: "100%",
    height: 56,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: K.brown,
  },
  startDisabled: { opacity: 0.4 },
  startRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  startText: { fontFamily: fonts.catalogue, fontSize: 20, letterSpacing: -0.2, color: ON_BROWN },
});

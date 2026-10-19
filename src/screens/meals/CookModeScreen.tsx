import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Svg, { Circle, Path } from "react-native-svg";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import {
  CookModeSession,
  CookModeStep,
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

/** Her quick presets, in seconds. */
const PRESETS = [60, 180, 600, 900];

export function CookModeScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<CookRoute>();
  const { recipeVersionId, plannedMealId, imageUrl } = route.params ?? ({} as any);

  const [session, setSession] = useState<CookModeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);

  const listRef = useRef<FlatList<CookModeStep | null>>(null);
  /** Guards the one-time scroll to a resumed position. */
  const restored = useRef(false);

  // --- timer ---
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerTotal, setTimerTotal] = useState(300);
  const [remaining, setRemaining] = useState<number | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, []);

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

  const beginTimer = useCallback(() => {
    if (!session) return;
    setRemaining(timerTotal);
    setTimerOpen(false);
    startCookTimer(session.sessionId, page).catch(() => {});
    if (tick.current) clearInterval(tick.current);
    tick.current = setInterval(() => {
      setRemaining((r) => {
        if (r === null) return null;
        if (r <= 1) {
          if (tick.current) clearInterval(tick.current);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }, [session, timerTotal, page]);

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
            accessibilityLabel="Set cooking timer"
            style={styles.timerButton}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={13} r={8} stroke={K.bone} strokeWidth={1.8} />
              <Path d="M12 9.5V13l2.2 1.6M9 2.8h6" stroke={K.bone} strokeWidth={1.8} strokeLinecap="round" />
            </Svg>
          </Pressable>
        )}
      </View>

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
            <StepPage step={item} />
          ) : (
            <CompletionPage title={session.title} imageUrl={imageUrl} onDone={finish} />
          )
        }
      />

      <TimerSheet
        visible={timerOpen}
        seconds={timerTotal}
        onPick={setTimerTotal}
        onStart={beginTimer}
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

function StepPage({ step }: { step: CookModeStep }) {
  return (
    <ScrollView style={{ width: SCREEN_W }} contentContainerStyle={styles.page}>
      <Text style={styles.stepLabel}>Step {step.index + 1}</Text>
      <Text style={styles.stepText}>{step.text}</Text>

      {step.ingredients.length > 0 ? (
        <View style={styles.ingredients}>
          {step.ingredients.map((ing, i) => (
            <View key={`${ing.name}-${i}`} style={styles.ingredientRow}>
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
  onDone,
}: {
  title: string;
  imageUrl?: string;
  onDone: () => void;
}) {
  return (
    <View style={[styles.page, styles.completion, { width: SCREEN_W }]}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.completionImage} /> : null}
      <Text style={styles.completionLabel}>All steps complete</Text>
      <Text style={styles.completionTitle}>{title} is ready!</Text>
      <Text style={styles.completionSub}>Nice work, chef.</Text>
      <View style={styles.completionSpacer} />
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

/** Her "Set cooking timer" sheet (`5062:56948`) — a LIGHT surface. */
function TimerSheet({
  visible,
  seconds,
  onPick,
  onStart,
  onClose,
}: {
  visible: boolean;
  seconds: number;
  onPick: (s: number) => void;
  onStart: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetGrabber} />
          <Pressable style={styles.sheetClose} onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M6 6l12 12M18 6L6 18" stroke={K.brown} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Pressable>
          <Text style={styles.sheetTitle}>Set cooking timer</Text>

          <View style={styles.ring}>
            <Text style={styles.ringText}>{formatDuration(seconds)}</Text>
          </View>

          <View style={styles.presets}>
            {PRESETS.map((p) => (
              <Pressable
                key={p}
                style={[styles.preset, seconds === p && styles.presetActive]}
                onPress={() => onPick(p)}
                accessibilityRole="button"
              >
                <Text style={styles.presetText}>{p / 60} min</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.sheetSpacer} />
          <Pressable style={styles.startButton} onPress={onStart} accessibilityRole="button">
            <Text style={styles.startText}>▶  Start</Text>
          </Pressable>
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
  },
  progress: { flexDirection: "row", gap: 4, width: 160 },
  segment: { flex: 1, height: 2, borderRadius: 999, overflow: "hidden" },
  segmentFull: { backgroundColor: K.bone },
  segmentEmpty: { backgroundColor: "rgba(250,253,254,0.24)" },
  continuousFill: { height: 2, backgroundColor: K.bone },
  runningTimer: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#513436",
    marginBottom: 8,
  },
  runningTimerText: { fontFamily: fonts.dmSans, fontSize: 16, color: K.bone, letterSpacing: -0.16 },
  page: { paddingHorizontal: 24, paddingBottom: 40, gap: 24 },
  stepLabel: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    letterSpacing: -0.16,
    color: "#b0a3a4",
  },
  /* Her Title 1 — "Big type" is COOK MODE r6's own words, and it is the
     point of the screen: readable at arm's length with wet hands. */
  stepText: {
    fontFamily: fonts.dmSans,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.32,
    color: K.bone,
    marginTop: -16,
  },
  ingredients: { gap: 8 },
  ingredientRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 12,
    paddingTop: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#7e6869",
  },
  ingredientQty: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    letterSpacing: -0.16,
    color: "#b0a3a4",
    width: 72,
  },
  ingredientName: {
    flex: 1,
    fontFamily: fonts.dmSans,
    fontSize: 16,
    letterSpacing: -0.16,
    color: K.bone,
  },
  ingredientToTaste: {
    fontFamily: fonts.dmSans,
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
  completionLabel: { fontFamily: fonts.dmSans, fontSize: 16, color: "#b0a3a4", letterSpacing: -0.16 },
  completionTitle: {
    fontFamily: fonts.dmSans,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.32,
    color: K.bone,
    textAlign: "center",
    marginTop: -16,
  },
  completionSub: {
    fontFamily: fonts.dmSans,
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
  doneText: { fontFamily: fonts.dmSans, fontSize: 20, letterSpacing: -0.2, color: K.bone },
  empty: {
    fontFamily: fonts.dmSans,
    fontSize: 18,
    color: "#b0a3a4",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  emptyAction: { fontFamily: fonts.dmSans, fontSize: 16, color: K.bone, textDecorationLine: "underline" },
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
    fontFamily: fonts.dmSans,
    fontSize: 24,
    letterSpacing: -0.24,
    color: K.brown,
    marginBottom: 24,
  },
  ring: {
    width: 212,
    height: 212,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: K.brown,
    alignItems: "center",
    justifyContent: "center",
  },
  ringText: {
    fontFamily: fonts.dmSans,
    fontSize: 38,
    letterSpacing: -0.38,
    color: "#8a7a74",
  },
  presets: { flexDirection: "row", gap: 12, marginTop: 28 },
  preset: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
    backgroundColor: "rgba(250,253,254,0.75)",
  },
  presetActive: { backgroundColor: "#fafdfe" },
  presetText: { fontFamily: fonts.dmSans, fontSize: 14, color: K.brown, letterSpacing: -0.14 },
  sheetSpacer: { flex: 1, minHeight: 24 },
  startButton: {
    width: "100%",
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: K.brown,
  },
  startText: { fontFamily: fonts.dmSans, fontSize: 20, letterSpacing: -0.2, color: K.bone },
});

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { sendMessage } from "../../services/chat";
import { recordEsterOpened, EsterMealContext } from "../../services/meals";
import type { EsterEntryPoint } from "../../services/meals";

const ESTER_MARK = require("../../../assets/images/ester-avatar.png");

/**
 * Lang's "Ask Ester" sheet, frame `5062:56495`.
 *
 * ## What this is
 * ESTER CONTEXT r2: *"Ester should inherit the object the member is looking
 * at. Meals remains the source of truth for plan state; chat is an interface,
 * not the database."* So the sheet opens already knowing the recipe, the
 * serving multiplier and any substitutions in force, and says so to the model
 * rather than hoping it infers them.
 *
 * ## 🔴 It passes the context, and the server checks it
 * P0 #14's done-when is *"every Meals entry passes structured IDs/context"*.
 * `recordEsterOpened` 400s when an entry omits what ESTER CONTEXT r5-r10
 * requires of it, so a surface that opens Ester with nothing attached fails
 * loudly here instead of looking fine.
 *
 * ## 📌 Explains. Does not act.
 * r13-r16: explaining is automatic, **a proposed swap needs explicit member
 * confirmation before any plan mutation**, and executing one is FUTURE-READY.
 * Nothing in this sheet mutates a plan. The action payload type exists
 * server-side (`EsterProposedAction`) so proposing later is not a redesign —
 * r16's *"avoid architecture that traps Ester in advice-only mode"*.
 */

/**
 * Lang's wording, with the middle chip replaced by Bryan's own, 2026-10-20:
 * "Why is this good for recovery?" → *"Why did you recommend this meal?"*.
 * The other two he passed as written.
 */
const SUGGESTIONS = [
  "Can I swap something in this meal?",
  "Why did you recommend this meal?",
  "How tricky is this to cook?",
];

type Bubble = { id: string; role: "ester" | "member"; text: string };

export function AskEsterSheet({
  visible,
  onClose,
  title,
  openingMessage,
  openingLoading,
  mealId,
  context,
  renderRich,
}: {
  visible: boolean;
  onClose: () => void;
  /** Lang's sheet title — "Meal Details" on this entry. */
  title: string;
  /** The explanation the screen already has, so the sheet opens with content. */
  openingMessage: string | null;
  openingLoading: boolean;
  mealId: string;
  context: EsterMealContext;
  /** Renders `**bold**` the way the screen's own Ester block does. */
  renderRich: (text: string) => React.ReactNode;
}) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const sessionId = useRef<string | undefined>(undefined);
  const scroller = useRef<ScrollView | null>(null);
  const announced = useRef(false);

  // Tell the server this entry opened, with what it is looking at. Once per
  // open; a second mount of the same sheet is not a second entry.
  useEffect(() => {
    if (!visible || announced.current) return;
    announced.current = true;
    /**
     * 🔑 WHICH entry this is depends on what we are looking at, not on which
     * screen we are.
     *
     * ESTER CONTEXT r6 ("Planned meal") and r8 ("Recipe detail") are different
     * entries with different required context, and this one screen is both:
     * opened from My Plan it HAS a planned meal, opened from Explore it does
     * not. TEST CASES **M34** pins the first case to `ester_opened_from_meal`,
     * so sending `_recipe` for everything would have mislabelled every open
     * that came from the plan — which is most of them.
     */
    const entry: EsterEntryPoint = context.plannedMealId ? "meal" : "recipe";
    recordEsterOpened(entry, context).catch(() => {
      // Analytics must never block the member from asking a question.
    });
  }, [visible, context]);

  useEffect(() => {
    if (!visible) {
      announced.current = false;
      setBubbles([]);
      setDraft("");
      setFailed(false);
      sessionId.current = undefined;
    }
  }, [visible]);

  /**
   * What Ester is told about the object on screen.
   *
   * 🔑 States only what we actually know. A prompt that asks for a signal the
   * payload may not carry makes the model invent it — the Day One Deep Read
   * lesson — so there is no "the member likes X" here, only ids and the two
   * pieces of state r8 names: current servings and substitutions in force.
   */
  const systemContext = useCallback(() => {
    const lines = [
      `The member is looking at the recipe "${title}" in Reset's Meals tab.`,
      `recipe_version_id: ${context.recipeVersionId ?? "unknown"}`,
    ];
    if (context.plannedMealId) {
      lines.push(`It is planned for ${context.localDate ?? "a day"} / ${context.slotType ?? "a slot"}.`);
      lines.push(`planned_meal_id: ${context.plannedMealId}`);
    } else {
      lines.push("It is NOT on their plan — they are browsing it.");
    }
    if (context.servings != null) {
      lines.push(`Serving multiplier currently shown: ${context.servings}.`);
    }
    if (context.windowStatus) {
      lines.push(
        `Their Reset Window is "${context.windowStatus}"` +
          (context.windowOpensAt ? `, eating opens at ${context.windowOpensAt}.` : "."),
      );
    }
    if (context.substitutionIds?.length) {
      lines.push(
        `They have ${context.substitutionIds.length} ingredient substitution(s) in force on this meal.`,
      );
    }
    lines.push(
      "Answer about THIS recipe. Do not claim a health outcome the data does not support, " +
        "and do not state that anything has been changed — you cannot change their plan here.",
    );
    return lines.join("\n");
  }, [title, context]);

  const ask = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || sending) return;
      setDraft("");
      setFailed(false);
      setBubbles((b) => [...b, { id: `m-${Date.now()}`, role: "member", text: question }]);
      setSending(true);
      try {
        const reply = await sendMessage(
          question,
          sessionId.current,
          systemContext(),
          undefined,
          mealId,
        );
        sessionId.current = reply.chatSessionId;
        setBubbles((b) => [
          ...b,
          { id: reply.id, role: "ester", text: reply.content },
        ]);
      } catch {
        // 🔴 Say so. An empty catch here would read as Ester ignoring them.
        setFailed(true);
      } finally {
        setSending(false);
      }
    },
    [sending, systemContext, mealId],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetWrap}
        pointerEvents="box-none"
      >
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Image source={ESTER_MARK} style={styles.mark} resizeMode="contain" />
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>Ask Ester</Text>
              <Text style={styles.title}>{title}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M6 6l12 12M18 6L6 18" stroke={K.brown} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </Pressable>
          </View>
          <View style={styles.divider} />

          <ScrollView
            ref={scroller}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
          >
            {/* The explanation the screen already had — the sheet opens with
                something to read rather than an empty thread. */}
            <View style={styles.esterBubble}>
              {openingLoading && !openingMessage ? (
                <Text style={[styles.esterText, styles.muted]}>
                  Thinking through why this fits you today…
                </Text>
              ) : (
                <Text style={styles.esterText}>
                  {renderRich(openingMessage ?? "Here's the recipe you're looking at.")}
                </Text>
              )}
            </View>

            {bubbles.map((b) =>
              b.role === "ester" ? (
                <View key={b.id} style={styles.esterBubble}>
                  <Text style={styles.esterText}>{renderRich(b.text)}</Text>
                </View>
              ) : (
                <View key={b.id} style={styles.memberBubble}>
                  <Text style={styles.memberText}>{b.text}</Text>
                </View>
              ),
            )}

            {sending ? (
              <View style={[styles.esterBubble, styles.thinking]}>
                <ActivityIndicator size="small" color={K.brown} />
              </View>
            ) : null}

            {failed ? (
              <View style={styles.esterBubble}>
                <Text style={[styles.esterText, styles.muted]}>
                  That didn't go through. Try again.
                </Text>
              </View>
            ) : null}

            {/* Her follow-up prompt + the three staggered chips. Shown while
                the thread is still just the opening message. */}
            {bubbles.length === 0 && !sending ? (
              <>
                <View style={styles.followUpBubble}>
                  <Text style={styles.esterText}>What else can I help you with?</Text>
                </View>
                <View style={styles.suggestions}>
                  {SUGGESTIONS.map((s) => (
                    <Pressable
                      key={s}
                      style={styles.suggestion}
                      onPress={() => void ask(s)}
                      accessibilityRole="button"
                      accessibilityLabel={s}
                    >
                      <Text style={styles.suggestionText}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
          </ScrollView>

          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Or ask something else..."
              placeholderTextColor="rgba(54,20,22,0.45)"
              returnKeyType="send"
              onSubmitEditing={() => void ask(draft)}
              editable={!sending}
              accessibilityLabel="Ask Ester something else"
            />
            <Pressable
              style={[styles.send, (!draft.trim() || sending) && styles.sendOff]}
              onPress={() => void ask(draft)}
              disabled={!draft.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel="Send"
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 19V5M5 12l7-7 7 7"
                  stroke={K.bone}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(54,20,22,0.45)" },
  sheetWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    maxHeight: "82%",
    backgroundColor: K.bone,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(54,20,22,0.2)",
    marginBottom: 14,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  mark: { width: 42, height: 42 },
  headerText: { flex: 1 },
  /** Her eyebrow is the caption serif — "Quadrant" in the Figma tokens. */
  eyebrow: {
    fontFamily: fonts.quadrant,
    fontSize: 13,
    letterSpacing: 0.1,
    color: K.brown,
  },
  title: {
    fontFamily: fonts.dmSans,
    fontSize: 24,
    letterSpacing: -0.24,
    color: K.brown,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(54,20,22,0.12)",
    marginTop: 14,
  },
  scroll: { marginTop: 14 },
  scrollContent: { paddingBottom: 8, gap: 10 },
  esterBubble: {
    alignSelf: "flex-start",
    maxWidth: "92%",
    borderWidth: 1,
    borderColor: "rgba(54,20,22,0.18)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  followUpBubble: {
    alignSelf: "flex-start",
    maxWidth: "88%",
    borderWidth: 1,
    borderColor: "rgba(54,20,22,0.18)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  thinking: { paddingVertical: 14, paddingHorizontal: 18 },
  esterText: {
    fontFamily: fonts.dmSans,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.15,
    color: K.brown,
  },
  muted: { color: "rgba(54,20,22,0.55)" },
  /** Her member chips are right-aligned and staggered by width. */
  memberBubble: {
    alignSelf: "flex-end",
    maxWidth: "88%",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "rgba(54,20,22,0.12)",
  },
  memberText: {
    fontFamily: fonts.dmSans,
    fontSize: 15,
    letterSpacing: -0.15,
    color: K.brown,
  },
  suggestions: { gap: 8, alignItems: "flex-end" },
  suggestion: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "rgba(54,20,22,0.12)",
  },
  suggestionText: {
    fontFamily: fonts.dmSans,
    fontSize: 15,
    letterSpacing: -0.15,
    color: K.brown,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  input: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    paddingHorizontal: 18,
    backgroundColor: "#fdfcf8",
    fontFamily: fonts.dmSans,
    fontSize: 15,
    color: K.brown,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8a7a74",
  },
  sendOff: { opacity: 0.45 },
});

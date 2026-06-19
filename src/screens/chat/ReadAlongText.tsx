import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";

/**
 * RES-140 — the "voicemail" read-along text from the Ester design. While Ester
 * is speaking, her message is shown a phrase at a time (synced to the TTS via
 * `revealedCount`): the phrase being read is large and bright white, the
 * just-read phrase above and the upcoming phrase below are smaller and dimmed.
 * The window slides through the sentence as she talks. When she's idle the full
 * message is shown at a calm reading size.
 */

type Chunk = { text: string; end: number };

// Group the message into short phrases (~2 words, breaking on punctuation) and
// record each phrase's end character offset so we can map `revealedCount` —
// which advances char-by-char with the audio — onto the active phrase.
function buildChunks(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  const re = /\S+\s*/g;
  let m: RegExpExecArray | null;
  let cur = "";
  let count = 0;
  let end = 0;
  while ((m = re.exec(text)) !== null) {
    cur += m[0];
    end = m.index + m[0].length;
    count++;
    const endsClause = /[,.!?;:—]$/.test(m[0].trim());
    if (count >= 2 || endsClause) {
      chunks.push({ text: cur.trim(), end });
      cur = "";
      count = 0;
    }
  }
  if (cur.trim()) chunks.push({ text: cur.trim(), end });
  return chunks;
}

export function ReadAlongText({
  text,
  revealedCount,
  active,
}: {
  text: string;
  revealedCount: number;
  active: boolean;
}) {
  const chunks = useMemo(() => buildChunks(text), [text]);

  if (!active || chunks.length === 0) {
    return <Text style={styles.full}>{text}</Text>;
  }

  let activeIdx = chunks.findIndex((c) => revealedCount < c.end);
  if (activeIdx === -1) activeIdx = chunks.length - 1;

  const prev = chunks[activeIdx - 1];
  const curr = chunks[activeIdx];
  const next = chunks[activeIdx + 1];

  return (
    <View style={styles.wrap}>
      {prev ? (
        <Text style={styles.prev} numberOfLines={1}>
          {prev.text}
        </Text>
      ) : null}
      {curr ? <Text style={styles.curr}>{curr.text}</Text> : null}
      {next ? (
        <Text style={styles.next} numberOfLines={2}>
          {next.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  prev: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    color: "rgba(243, 239, 227, 0.4)",
    letterSpacing: -0.2,
  },
  curr: {
    fontFamily: fonts.dmSans,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "600",
    color: "#FAFDFE",
    letterSpacing: -0.4,
  },
  next: {
    fontFamily: fonts.dmSans,
    fontSize: 21,
    lineHeight: 25,
    color: "rgba(243, 239, 227, 0.5)",
    letterSpacing: -0.3,
  },
  full: {
    fontFamily: fonts.catalogue,
    fontSize: 17,
    lineHeight: 25,
    color: K.bone,
  },
});

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

/**
 * Ester's "typing" indicator — three pulsing dots.
 *
 * 🔑 BARE BY DESIGN: this renders the dots only. Wrap it in a bubble at the
 * call site, because the two surveys use different bubble treatments for the
 * same dots (the onboarding survey uses a left-tailed outline bubble).
 *
 * 🔴 ONE DEFINITION, SHARED. It lived inside `OnboardingSurveyScreen` where the
 * adaptive survey could not see it. The adaptive screen has to be visually
 * identical to the fixed one — Lang's layout is canonical and the two engines
 * are meant to be indistinguishable to a member — and the only way to keep that
 * true is for both to render the same component rather than two copies that
 * drift. Same failure this repo has already had with `TYPE_DISPLAY` (three
 * duplicate maps) and `dietLabel`.
 */
export function EsterTypingDots({ color = "#FAFDFE" }: { color?: string }) {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 150),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []);
  return (
    <View style={styles.dotsRow}>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: color },
            {
              opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [
                { translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

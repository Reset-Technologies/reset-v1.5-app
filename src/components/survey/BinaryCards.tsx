import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { K } from "../../constants/colors";
import { fonts, radius } from "../../constants/typography";

interface BinaryCardsProps {
  value: boolean | null;
  onChange: (value: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
}

export function BinaryCards({
  value,
  onChange,
  yesLabel = "Yes",
  noLabel = "No",
}: BinaryCardsProps) {
  const isNo = value === false;
  const isYes = value === true;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={() => onChange(false)}
        activeOpacity={0.85}
        style={[
          styles.card,
          styles.leftCard,
          isNo ? styles.leftSelected : styles.cardIdle,
        ]}
      >
        <Text style={styles.label}>{noLabel}</Text>
        {isNo ? <Text style={styles.check}>✓</Text> : null}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onChange(true)}
        activeOpacity={0.85}
        style={[
          styles.card,
          styles.rightCard,
          isYes ? styles.rightSelected : styles.cardIdle,
        ]}
      >
        <Text style={styles.label}>{yesLabel}</Text>
        {isYes ? <Text style={styles.check}>✓</Text> : null}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
    height: 160,
  },
  card: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 16,
    overflow: "hidden",
  },
  leftCard: {
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: 0,
  },
  rightCard: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 40,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 40,
  },
  cardIdle: {
    backgroundColor: K.bone,
  },
  leftSelected: {
    backgroundColor: K.blue,
  },
  rightSelected: {
    backgroundColor: K.blue,
  },
  label: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    letterSpacing: -0.2,
    color: K.brown,
    textAlign: "center",
  },
  check: {
    fontSize: 20,
    color: K.brown,
    marginTop: 8,
  },
});

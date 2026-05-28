import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { K, TC, toMetabolicType } from "../../constants/colors";
import { fonts, spacing } from "../../constants/typography";
import { useApp } from "../../context/AppContext";

export interface MultipleChoiceOption {
  id: string;
  label: string;
}

interface MultipleChoiceListProps {
  options: MultipleChoiceOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function MultipleChoiceList({
  options,
  selectedId,
  onSelect,
}: MultipleChoiceListProps) {
  const { state } = useApp();
  const metabolicType = toMetabolicType(state.user.metabolicType) ?? "Explorer";
  const selectedBg = TC[metabolicType].bg;
  return (
    <View style={styles.list}>
      {options.map((opt) => {
        const isSelected = opt.id === selectedId;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => onSelect(opt.id)}
            activeOpacity={0.85}
            style={[
              styles.row,
              isSelected
                ? [styles.rowSelected, { backgroundColor: selectedBg }]
                : styles.rowIdle,
            ]}
          >
            <Text style={styles.label}>{opt.label}</Text>
            {isSelected ? <Text style={styles.check}>✓</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
    minHeight: 56,
  },
  rowIdle: {
    backgroundColor: K.white,
    borderRadius: 4,
  },
  rowSelected: {
    backgroundColor: K.blue,
    borderRadius: 100,
  },
  label: {
    flex: 1,
    fontFamily: fonts.dmSans,
    fontSize: 20,
    letterSpacing: -0.2,
    color: K.brown,
  },
  check: {
    fontSize: 20,
    color: K.brown,
    marginLeft: 8,
  },
});

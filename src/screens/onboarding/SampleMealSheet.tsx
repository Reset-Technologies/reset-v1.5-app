import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
  ScrollView,
  Modal,
} from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";

const BRAND_LOGO = require("../../../assets/images/brand-logo-silver.png");
const RECIPE_IMG = require("../../../assets/images/onboarding/sample-meal-avocado.png");

const SHEET_BG = "#F3EFE3";
const ON_BONE_SUBTLE = "#7E6869";
const DIVIDER = "#C3B9BA";
const SCRIM = "rgba(54,20,22,0.64)";
const TAG_BG = "rgba(250,253,254,0.24)";

function CloseIcon({ size = 24, color = K.brown }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6l12 12M18 6L6 18"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function MuteIcon({ size = 24, color = K.brown }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 10v4h4l5 5V5L7 10H3z" fill={color} />
      <Path
        d="M16 9l5 5m0-5l-5 5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ArrowForward({ size = 28, color = K.white }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12h14M13 5l7 7-7 7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Eyebrow({ label }: { label: string }) {
  return (
    <View style={styles.eyebrow}>
      <View style={styles.eyebrowDot} />
      <Text style={styles.eyebrowText}>{label}</Text>
    </View>
  );
}

function RecipeTag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

export function SampleMealSheet({
  visible,
  onClose,
  onScan,
}: {
  visible: boolean;
  onClose: () => void;
  onScan: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Tap the exposed scrim above the sheet to dismiss. */}
        <TouchableOpacity
          style={styles.scrimTop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheet}>
          {/* Top bar — close / logo / mute */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={10}
              style={styles.iconBtn}
              testID="sampleMealSheet_close"
            >
              <CloseIcon />
            </TouchableOpacity>
            <Image source={BRAND_LOGO} style={styles.logo} resizeMode="contain" />
            <View style={styles.iconBtn}>
              <MuteIcon />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            <Eyebrow label="Sample Meal Recommendation" />
            <Text style={styles.headline}>
              Here&apos;s today&apos;s breakfast, picked for{" "}
              <Text style={styles.headlineBold}>your body</Text>.
            </Text>

            {/* Recipe card */}
            <ImageBackground
              source={RECIPE_IMG}
              style={styles.recipeCard}
              imageStyle={styles.recipeCardImg}
              resizeMode="cover"
            >
              <Svg
                style={StyleSheet.absoluteFill}
                width="100%"
                height="100%"
                preserveAspectRatio="none"
              >
                <Defs>
                  <LinearGradient id="recipeTop" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#361416" stopOpacity="0.55" />
                    <Stop offset="0.4" stopColor="#361416" stopOpacity="0" />
                  </LinearGradient>
                  <LinearGradient id="recipeBottom" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0.55" stopColor="#361416" stopOpacity="0" />
                    <Stop offset="1" stopColor="#361416" stopOpacity="0.8" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#recipeTop)" />
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#recipeBottom)" />
              </Svg>

              <View style={styles.recipeTop}>
                <Text style={styles.recipeTitle}>Avocado Toast</Text>
                <View style={styles.tagRow}>
                  <RecipeTag label="Organic" />
                  <RecipeTag label="Vegan" />
                  <RecipeTag label="Fast" />
                </View>
              </View>
              <View style={styles.recipeMeta}>
                <Text style={styles.recipeMetaText}>15 mins</Text>
                <Text style={styles.recipeMetaText}>5 ingredients</Text>
              </View>
            </ImageBackground>

            {/* Why this meal */}
            <Eyebrow label="Why this meal?" />
            <View style={styles.whyCard}>
              <Text style={styles.whyText}>
                A balanced breakfast that keeps your energy steady through the
                morning. Once you scan, Ester tailors every recommendation to
                your metabolic type.
              </Text>
            </View>

            {/* Start your scan */}
            <View style={styles.scanRow}>
              <TouchableOpacity
                style={styles.scanBtn}
                onPress={onScan}
                activeOpacity={0.85}
                testID="sampleMealSheet_scanCTA"
              >
                <Text style={styles.scanBtnText}>Start your scan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.scanArrowBtn}
                onPress={onScan}
                activeOpacity={0.85}
              >
                <ArrowForward size={28} color={K.white} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SCRIM },
  // Exposed scrim above the sheet — Figma leaves ~88px.
  scrimTop: { height: 88 },

  sheet: {
    flex: 1,
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 44, height: 44 },

  // Body — flexGrow + center so the content block is vertically centered
  // in the sheet, leaving equal space above and below it.
  body: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 24,
  },

  // Eyebrow
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8 },
  eyebrowDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: K.brown },
  eyebrowText: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    color: K.brown,
    letterSpacing: -0.12,
  },

  // Headline
  headline: {
    fontFamily: fonts.dmSans,
    fontSize: 24,
    lineHeight: 30,
    color: ON_BONE_SUBTLE,
    letterSpacing: -0.24,
    marginTop: -18, // tuck under the eyebrow (eyebrow + headline are one group)
  },
  headlineBold: { fontFamily: fonts.dmSansBold, color: K.brown },

  // Recipe card
  recipeCard: {
    height: 240,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 40,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    overflow: "hidden",
    backgroundColor: K.bone,
  },
  recipeCardImg: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 40,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  recipeTop: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    gap: 6,
  },
  recipeTitle: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    color: K.white,
    letterSpacing: -0.2,
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    backgroundColor: TAG_BG,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    color: K.white,
    letterSpacing: -0.12,
  },
  recipeMeta: { position: "absolute", left: 12, bottom: 12 },
  recipeMetaText: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    color: K.white,
    letterSpacing: -0.12,
    lineHeight: 16,
  },

  // Why this meal card
  whyCard: {
    borderWidth: 0.5,
    borderColor: DIVIDER,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 10,
    paddingBottom: 16,
    paddingLeft: 12,
    paddingRight: 16,
    marginTop: -18, // tuck under the "Why this meal?" eyebrow
  },
  whyText: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    lineHeight: 22,
    color: ON_BONE_SUBTLE,
    letterSpacing: -0.16,
  },

  // Start your scan
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
  },
  scanBtn: {
    backgroundColor: K.brown,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  scanBtnText: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    color: K.white,
    letterSpacing: -0.2,
  },
  scanArrowBtn: {
    backgroundColor: K.blue,
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});

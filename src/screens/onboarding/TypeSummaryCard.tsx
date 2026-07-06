import React, { useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { K, MetabolicType } from "../../constants/colors";
import { fonts, spacing } from "../../constants/typography";
import { TYPE_CONFIGS } from "../../constants/types";
import {
  TYPE_LOGO,
  TYPE_GRADIENT_STOPS,
  TYPE_PRIMARY,
  TYPE_DISPLAY,
  PROFILE_COPY,
  GOAL_COPY,
  article,
} from "../../constants/metabolicProfile";
import type { StatDetailData } from "../profile/StatDetailSheet";

/**
 * RES-146 — onboarding "here's your type" summary card. A card-formatted
 * version of the Profile screen's type header + Goal/strength/weakness cards,
 * slotted into the TypeReveal swipe stack right after the reveal. Uses the same
 * shared per-type copy/visuals as Profile (see constants/metabolicProfile), and
 * the card arrows call `onOpenDetail` so the parent (TypeRevealScreen) can open
 * the shared StatDetailSheet above the rotated card stack.
 */
export function TypeSummaryCard({
  type,
  userName,
  goalSlug,
  width,
  height,
  onOpenDetail,
}: {
  type: MetabolicType;
  userName: string;
  goalSlug: string | null;
  width: number;
  // Actual (safe-area-capped) card height from the parent stack. On tall cards
  // (iPhone 16 Pro-ish and up) the header stays at its full design height and
  // the footer pins to the bottom — the original layout. On short cards (Galaxy
  // S24) only the header shrinks so the footer text still clears the edge.
  height?: number;
  onOpenDetail: (d: StatDetailData) => void;
}) {
  const typeDisplay = TYPE_DISPLAY[type];
  const copy = PROFILE_COPY[type];
  const goalText = GOAL_COPY[goalSlug ?? ""] ?? copy.goal;
  const primary = TYPE_PRIMARY[type];
  const tagline = TYPE_CONFIGS[type].tagline.replace(/\.$/, "");
  const anchor = TYPE_GRADIENT_STOPS[type].anchor;

  // We measure the top content (headline + goal + strength/weakness) since its
  // height varies with screen width (the copy wraps more on a narrow S24). The
  // header then takes whatever card height is left over after the body's real
  // need, clamped to the design height. Result: on tall cards (iPhone 16 Pro-ish
  // and up) the header stays full-size and the footer pins to the bottom — the
  // original layout; on short cards only the header shrinks so the footer text
  // still clears the clipped edge.
  const [topH, setTopH] = useState(0);
  const bodyNeed = BODY_PADDING + topH + BODY_GAP + FOOTER_RESERVE;
  const headerHeight =
    height == null || topH === 0
      ? HEADER_HEIGHT
      : Math.max(HEADER_MIN, Math.min(HEADER_HEIGHT, height - bodyNeed));

  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.clip}>
        {/* Gradient header: mascot + name + type pill (no gear — it's a card). */}
        <View style={[styles.header, { height: headerHeight }]}>
          <HeaderTypeGradient type={type} />
          <Image
            source={TYPE_LOGO[type]}
            style={styles.headerAvatar}
            resizeMode="contain"
          />
          <Text style={styles.headerName} numberOfLines={1}>
            {userName}
          </Text>
          <View style={styles.headerTag}>
            <Text style={styles.headerTagText}>{typeDisplay}</Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {/* Measured top content — its height drives the header sizing above. */}
          <View
            style={styles.topContent}
            onLayout={(e) => {
              const h = Math.round(e.nativeEvent.layout.height);
              setTopH((prev) => (prev === h ? prev : h));
            }}
          >
            <Text style={styles.headline}>
              As {article(typeDisplay)}{" "}
              <Text style={[styles.headlineType, { color: primary }]}>
                {typeDisplay},
              </Text>{" "}
              {tagline}.
            </Text>

            {/* Your goal */}
            <View>
            <Eyebrow label="Your goal" dotColor={primary} />
            <TouchableOpacity
              style={[styles.blueCard, { backgroundColor: anchor }]}
              activeOpacity={0.9}
              onPress={() =>
                onOpenDetail({
                  metric: "goal",
                  variant: "simple",
                  eyebrow: "About your goal",
                  title: "Your goal",
                  value: goalSlug ?? null,
                })
              }
            >
              <TypeGradientFill type={type} idKey="goal" />
              <Text style={styles.blueCardBody}>{goalText}</Text>
              <View style={styles.ghostArrow}>
                <ArrowForwardIcon />
              </View>
            </TouchableOpacity>
          </View>

          {/* Strength + weakness */}
          <View style={styles.strengthRow}>
            <View style={styles.strengthCol}>
              <Eyebrow label="Your biggest strength" dotColor={primary} />
              <TouchableOpacity
                style={[styles.blueCard, styles.centeredCard, { backgroundColor: anchor }]}
                activeOpacity={0.9}
                onPress={() =>
                  onOpenDetail({
                    metric: "strength",
                    variant: "simple",
                    eyebrow: "About your strength",
                    title: copy.strength,
                    value: copy.strength,
                  })
                }
              >
                <TypeGradientFill type={type} idKey="strength" />
                <Text
                  style={styles.blueCardTitle}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {copy.strength}
                </Text>
                <View style={styles.ghostArrow}>
                  <ArrowForwardIcon />
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.strengthCol}>
              <Eyebrow label="Your weakness" dotColor={primary} />
              <TouchableOpacity
                style={styles.outlineCard}
                activeOpacity={0.9}
                onPress={() =>
                  onOpenDetail({
                    metric: "weakness",
                    variant: "simple",
                    eyebrow: "About your weakness",
                    title: copy.weakness,
                    value: copy.weakness,
                  })
                }
              >
                <Text
                  style={styles.outlineCardTitle}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {copy.weakness}
                </Text>
                <View style={styles.outlineArrow}>
                  <ArrowForwardIcon color="#7e6869" />
                </View>
              </TouchableOpacity>
            </View>
          </View>
          </View>

          {/* Reassurance + swipe prompt */}
          <View style={styles.footer}>
            <Text style={styles.reassure}>
              You're not alone — we're on this journey with you!
            </Text>
            <Text style={styles.swipeHint}>Swipe left to continue</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function Eyebrow({ label, dotColor }: { label: string; dotColor: string }) {
  return (
    <View style={styles.eyebrowRow}>
      <View style={[styles.eyebrowDot, { backgroundColor: dotColor }]} />
      <Text style={styles.eyebrowText}>{label}</Text>
    </View>
  );
}

// ── Per-type gradient + arrow helpers (mirror ProfileScreen's) ──────────────
function HeaderTypeGradient({ type }: { type: MetabolicType }) {
  const stops = TYPE_GRADIENT_STOPS[type];
  const id = `tsHeaderBg_${type}`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="100%" rx="80%" ry="105%" fx="50%" fy="100%">
            <Stop offset="0" stopColor={stops.anchor} />
            <Stop offset="0.5" stopColor={stops.mid} />
            <Stop offset="1" stopColor={stops.outer} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

function TypeGradientFill({ type, idKey }: { type: MetabolicType; idKey: string }) {
  const stops = TYPE_GRADIENT_STOPS[type];
  const id = `tsGrad_${type}_${idKey}`;
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
      }}
    >
      {size.w > 0 && size.h > 0 ? (
        <Svg width={size.w} height={size.h} preserveAspectRatio="none">
          <Defs>
            <RadialGradient id={id} cx="50%" cy="100%" rx="80%" ry="120%" fx="50%" fy="100%">
              <Stop offset="0" stopColor={stops.anchor} />
              <Stop offset="0.5" stopColor={stops.mid} />
              <Stop offset="1" stopColor={stops.outer} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} fill={`url(#${id})`} />
        </Svg>
      ) : null}
    </View>
  );
}

function ArrowForwardIcon({ color = K.white }: { color?: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
      <Path
        d="M8.08467 5.29883H0.5C0.358111 5.29883 0.239333 5.25094 0.143667 5.15517C0.0478888 5.0595 0 4.94072 0 4.79883C0 4.65694 0.0478888 4.53817 0.143667 4.4425C0.239333 4.34672 0.358111 4.29883 0.5 4.29883H8.08467L4.6385 0.852666C4.53939 0.753555 4.49044 0.637555 4.49167 0.504666C4.493 0.371777 4.54533 0.253611 4.64867 0.150166C4.75211 0.0536109 4.86922 0.00361094 5 0.000166493C5.13078 -0.00327795 5.24789 0.0467221 5.35133 0.150166L9.57817 4.377C9.64061 4.43944 9.68461 4.50528 9.71017 4.5745C9.73583 4.64372 9.74867 4.7185 9.74867 4.79883C9.74867 4.87917 9.73583 4.95394 9.71017 5.02317C9.68461 5.09239 9.64061 5.15822 9.57817 5.22067L5.35133 9.4475C5.259 9.53983 5.14467 9.58705 5.00833 9.58917C4.872 9.59128 4.75211 9.54405 4.64867 9.4475C4.54533 9.34405 4.49367 9.22528 4.49367 9.09117C4.49367 8.95694 4.54533 8.83811 4.64867 8.73467L8.08467 5.29883Z"
        fill={color}
      />
    </Svg>
  );
}

// Full design header height (used on iPhone 16 Pro-ish cards and up).
const HEADER_HEIGHT = 300;
// Floor the header can shrink to on short cards before the mascot/name crush.
const HEADER_MIN = 150;
// Body's fixed vertical costs, added to the measured top-content height to get
// the body's real need (which drives header sizing).
const BODY_PADDING = 44; // body paddingTop 20 + paddingBottom 24
const BODY_GAP = 18; // gap between the measured top content and the footer
const FOOTER_RESERVE = 76; // footer natural height: reassure (2 lines) + swipe

const styles = StyleSheet.create({
  card: {
    backgroundColor: K.white,
    borderRadius: 48,
    height: "100%",
    boxShadow:
      "0 0 1px 0 rgba(0,0,0,0.07) inset, 0 2px 6px -1px rgba(34,10,10,0.38), 0 -9px 4px -8px rgba(54,20,22,0.44) inset, 0 -5px 10px -3px rgba(54,20,22,0.38) inset",
    elevation: 6,
  },
  // Inner clip so the gradient header follows the card's rounded corners while
  // the card root keeps its "Bubble" shadow.
  clip: {
    flex: 1,
    borderRadius: 48,
    overflow: "hidden",
  },
  header: {
    // height is set responsively at the call site (see headerHeight).
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  headerAvatar: {
    width: 120,
    height: 120,
    transform: [{ translateX: 7 }],
  },
  headerName: {
    fontFamily: fonts.catalogue,
    fontSize: 30,
    color: K.white,
    letterSpacing: -0.3,
    marginTop: 4,
  },
  headerTag: {
    backgroundColor: "rgba(250,253,254,0.24)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 5,
  },
  headerTagText: {
    fontFamily: fonts.quadrant,
    fontSize: 14,
    color: K.white,
    letterSpacing: -0.14,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 18,
  },
  // Headline + goal + strength/weakness, measured to size the header. Keeps the
  // same 18px rhythm the body gap used to provide between these blocks.
  topContent: { gap: 18 },
  headline: {
    fontFamily: fonts.catalogue,
    fontSize: 22,
    color: K.brown,
    letterSpacing: -0.22,
    lineHeight: 28,
  },
  headlineType: {
    color: "#5C7177",
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    paddingLeft: 4,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: K.blue,
  },
  eyebrowText: {
    fontFamily: fonts.quadrant,
    fontSize: 12,
    color: K.brown,
    letterSpacing: -0.12,
  },
  blueCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: K.blue,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 16,
    paddingTop: 8,
    paddingRight: 8,
    paddingBottom: 12,
    paddingLeft: 10,
    overflow: "hidden",
  },
  centeredCard: { alignItems: "center" },
  blueCardBody: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 16,
    color: K.white,
    letterSpacing: -0.16,
    paddingLeft: 4,
  },
  blueCardTitle: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 20,
    color: K.white,
    letterSpacing: -0.2,
    paddingLeft: 4,
  },
  ghostArrow: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: "rgba(250,253,254,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  strengthRow: {
    flexDirection: "row",
    gap: 12,
  },
  strengthCol: { flex: 1 },
  outlineCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 0.5,
    borderColor: "#C3B9BA",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 16,
    paddingTop: 8,
    paddingRight: 8,
    paddingBottom: 12,
    paddingLeft: 10,
  },
  outlineCardTitle: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 20,
    color: "#7e6869",
    letterSpacing: -0.2,
    paddingLeft: 4,
  },
  outlineArrow: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#7e6869",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
  },
  reassure: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    color: K.brown,
    letterSpacing: -0.16,
    textAlign: "center",
    lineHeight: 21,
  },
  swipeHint: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.12,
    color: "rgba(54,20,22,0.5)",
  },
});

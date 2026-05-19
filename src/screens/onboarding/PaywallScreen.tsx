import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { fonts } from "../../constants/typography";
import { useApp } from "../../context/AppContext";
import { logEvent } from "../../services/braze";
import { rootNavigationRef } from "../../navigation/rootNavigationRef";

type Props = NativeStackScreenProps<any, "Paywall">;

const SCREEN_W = Dimensions.get("window").width;

const MAROON_ALT = "#513436"; // page-surface-(alt)
const MAROON = "#361416";
const WHITE = "#FAFDFE";
const BONE = "#F3EFE3";
const TEXT_ALT = "#B0A3A4";
const DIVIDER = "#7E6869";
const GHOST_W = "rgba(250,253,254,0.24)";

const RESET_LOGO = require("../../../assets/images/reset-logo.png");

const FEATURES: { label: string; pro: boolean; free: boolean }[] = [
  { label: "1st scan free", pro: true, free: true },
  { label: "Reveal your type", pro: true, free: true },
  { label: "Daily scans & insights", pro: true, free: false },
  { label: "Ongoing Reset score", pro: true, free: false },
  { label: "Access to deep reads", pro: true, free: false },
  { label: "Personalized meal suggestions", pro: true, free: false },
  { label: "Ongoing Ester pattern tracking", pro: true, free: false },
];

const COL_W = 52;

function CheckIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
        fill={WHITE}
      />
    </Svg>
  );
}

// Reset wordmark from /Brand/Logo/Wordmark.svg (96×32). Inlined as SVG paths
// to match the existing react-native-svg usage in this screen and avoid
// pulling in a separate SVG-loader for a single asset. Wrapped in a View
// with explicit dimensions because react-native-svg sometimes ignores
// width/height props when a viewBox is present — clamping via the parent
// View is reliable.
function ResetWordmark({ width = 96, height = 32 }: { width?: number; height?: number }) {
  return (
    <View style={{ width, height }}>
      <Svg width="100%" height="100%" viewBox="0 0 96 32" fill="none">
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M26.246 4.50004C33.6225 4.50004 36.8968 9.80407 36.8969 16.1447V17.5956H21.646C22.019 20.4135 23.4697 21.9053 26.5362 21.9054C28.7325 21.9054 29.9343 21.1175 30.3487 19.667H36.8138C35.9022 24.4329 31.8819 27.0447 26.4531 27.0447C19.9054 27.0446 15.2228 23.1072 15.2228 16.0206C15.2228 9.67997 18.8696 4.50015 26.246 4.50004ZM26.246 9.63933C23.6765 9.6394 22.2674 10.882 21.7701 13.4929H30.5147C30.3905 10.9236 28.8156 9.63933 26.246 9.63933Z"
          fill={WHITE}
        />
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M69.6772 4.45986C77.0538 4.45989 80.3281 9.76473 80.3281 16.1054V17.5554H65.0772C65.4505 20.3734 66.9005 21.866 69.9674 21.8661C72.1637 21.8661 73.3664 21.0782 73.7808 19.6277H80.2451C79.3335 24.3935 75.3141 27.0044 69.8853 27.0045L69.2763 26.9929C63.0486 26.7552 58.6541 22.8461 58.654 15.9813C58.654 9.64061 62.3007 4.45986 69.6772 4.45986ZM69.6772 9.59915C67.108 9.59915 65.6996 10.842 65.2022 13.4527H73.946C73.8216 10.8836 72.2464 9.59917 69.6772 9.59915Z"
          fill={WHITE}
        />
        <Path
          d="M47.4496 4.44558C53.4586 4.44568 57.2294 6.84939 57.5603 12.0295H51.1371C50.9299 10.2889 49.562 9.37772 47.2415 9.37772C45.3769 9.37777 44.4657 9.99881 44.4656 11.0349C44.4656 12.071 45.4185 12.6099 47.2004 12.9L51.4272 13.6045C54.7426 14.1431 57.8924 15.5939 57.8924 19.8625C57.8923 24.5867 54.0792 26.9902 48.4433 26.9902L47.9513 26.984C42.8717 26.8551 38.1509 24.713 37.6692 19.6545H44.2996C44.631 21.1047 45.9574 22.059 48.5683 22.059C50.5569 22.059 51.552 21.4786 51.5522 20.4429C51.5522 19.2409 50.3086 18.9095 48.5683 18.6608L45.5844 18.2045C42.0618 17.6659 38.2487 16.3809 38.2487 11.4491C38.2488 7.05638 41.4404 4.44558 47.4496 4.44558Z"
          fill={WHITE}
        />
        <Path
          d="M8.21027 9.02326C8.79046 6.61958 10.6138 4.96176 13.2246 4.96165H14.9058V12.2322H8.45848V26.5822H1.82812V4.96165H8.21027V9.02326Z"
          fill={WHITE}
        />
        <Path
          d="M87.4746 6.31879H94.171V13.5884H92.4897C89.8792 13.5884 88.0557 12.0623 87.4754 9.65897V20.7099L94.171 20.6438L94.1701 20.6447V26.5393H88.146C83.629 26.5393 81.4389 24.3846 81.4388 19.8259V1.82861H87.4746V6.31879Z"
          fill={WHITE}
        />
      </Svg>
    </View>
  );
}

function CloseIcon({ color = WHITE, size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6L18 18"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ComparisonTable() {
  const lastIdx = FEATURES.length - 1;
  return (
    <View style={styles.tableWrap}>
      {/* Column headers stick up like tabs above the table. */}
      <View style={styles.tabsRow}>
        <View style={[styles.tab, styles.tabPro]}>
          <View style={styles.tabPill}>
            <Text style={styles.tabText}>Pro</Text>
          </View>
        </View>
        <View style={[styles.tab, styles.tabFree]}>
          <Text style={styles.tabTextDim}>Free</Text>
        </View>
        {/* Invisible spacer so the headers align with the table cols below. */}
        <View style={styles.tabSpacer} />
      </View>

      {FEATURES.map((row, i) => {
        const isFirst = i === 0;
        const isLast = i === lastIdx;
        return (
          <View key={row.label} style={styles.tableRow}>
            <View
              style={[
                styles.cellPro,
                isLast && styles.cellProLast,
              ]}
            >
              {row.pro ? <CheckIcon /> : <CloseIcon size={16} color={WHITE} />}
            </View>
            <View
              style={[
                styles.cellFree,
                isLast && styles.cellFreeLast,
              ]}
            >
              {row.free ? <CheckIcon /> : <CloseIcon size={16} color={WHITE} />}
            </View>
            <View
              style={[
                styles.cellLabel,
                isFirst && styles.cellLabelFirst,
                isLast && styles.cellLabelLast,
              ]}
            >
              <Text style={styles.cellLabelText}>{row.label}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PlanCard({
  label,
  unit,
  price,
  billed,
  variant,
  selected,
  saleTag,
  onPress,
}: {
  label: string;
  unit?: string;
  price: string;
  billed: string;
  variant: "monthly" | "yearly";
  selected: boolean;
  saleTag?: string;
  onPress: () => void;
}) {
  const radiiStyle =
    variant === "monthly" ? styles.planRadiiMonthly : styles.planRadiiYearly;
  const stateStyle = selected ? styles.planSelected : styles.planUnselected;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.planCard, radiiStyle, stateStyle]}
    >
      {saleTag ? (
        <View style={styles.saleTag}>
          <Text style={styles.saleTagText}>{saleTag}</Text>
        </View>
      ) : null}
      <Text style={styles.planTitle}>{label}</Text>
      <View style={styles.planPrice}>
        {unit ? <Text style={styles.planUnit}>{unit}</Text> : null}
        <Text style={styles.planPriceText}>{price}</Text>
        <Text style={styles.planBilled}>{billed}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function PaywallScreen({ navigation }: Props) {
  const { setHomeV2Enabled, completeOnboarding } = useApp();
  // Yearly is the default per Figma (the highlighted card on first render).
  const [selectedPlan, setSelectedPlan] = React.useState<"monthly" | "yearly">(
    "yearly"
  );

  React.useEffect(() => {
    logEvent("onboarding_paywall_view");
  }, []);

  const handleClose = () => {
    logEvent("onboarding_paywall_close");
    setHomeV2Enabled(true);
    completeOnboarding();
  };

  const handleSubscribe = () => {
    logEvent("onboarding_paywall_subscribe");
    setHomeV2Enabled(true);
    completeOnboarding();
    // Defer deep navigation until the Main stack has actually mounted —
    // completeOnboarding flips the root state, which triggers a re-render
    // and a new stack. We dispatch on the next tick via the module-level
    // ref so this fires after Onboarding unmounts and Main mounts.
    setTimeout(() => {
      if (rootNavigationRef.isReady()) {
        // Deep-nest params: Main > AppOpenFlow > NextMeal. RootStackParamList
        // doesn't model nested params so cast to any — same pattern as the
        // existing app-open flow trigger in RootNavigator.
        (rootNavigationRef as any).navigate("Main", {
          screen: "AppOpenFlow",
          params: {
            screen: "NextMeal",
            params: { fromOnboarding: true },
          },
        });
      }
    }, 80);
  };

  return (
    <View style={styles.container}>
      {/* Bottom-darken gradient over the maroon-alt page surface. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="paywallBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.4358" stopColor="#000000" stopOpacity="0" />
              <Stop offset="0.815" stopColor="#000000" stopOpacity="0.6" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#paywallBg)" />
        </Svg>
      </View>

      <View style={styles.topBar}>
        {/* Placeholder + close X use flex justify-between; logo is absolutely
            positioned at center per Figma so it sits dead-center regardless
            of the placeholder/X widths. */}
        <View style={styles.topPlaceholder} />
        <TouchableOpacity onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
          <CloseIcon color={WHITE} size={24} />
        </TouchableOpacity>
        <Image source={RESET_LOGO} style={styles.topLogo} resizeMode="contain" />
      </View>

      <View style={styles.body}>
        <View style={styles.title}>
          <ResetWordmark width={96} height={32} />
          <Text style={styles.titlePro}>pro</Text>
        </View>

        {/* Flex:1 wrapper grabs spare vertical space between title and
            plans. With justifyContent:center inside, the table is centered
            within that spare space — so the visible distance from title to
            table equals the distance from table to plans. Plans + CTA stay
            anchored to the bottom of the body since the wrapper eats the
            rest. */}
        <View style={styles.tableSlot}>
          <ComparisonTable />
        </View>

        <View style={styles.plansRow}>
          <PlanCard
            label="Monthly"
            price="$19.99"
            billed="Billed monthly"
            variant="monthly"
            selected={selectedPlan === "monthly"}
            onPress={() => setSelectedPlan("monthly")}
          />
          <PlanCard
            label="Yearly"
            unit="$12.49/mo"
            price="$149.99"
            billed="Billed annually"
            variant="yearly"
            selected={selectedPlan === "yearly"}
            onPress={() => setSelectedPlan("yearly")}
            saleTag="Save 37%"
          />
        </View>

        <View style={styles.ctaBlock}>
          <Text style={styles.cancelHint}>Cancel anytime</Text>
          <TouchableOpacity
            onPress={handleSubscribe}
            activeOpacity={0.85}
            style={styles.subscribeBtn}
          >
            <Text style={styles.subscribeText}>Subscribe</Text>
          </TouchableOpacity>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Privacy Policy</Text>
            <View style={styles.footerDot} />
            <Text style={styles.footerText}>Restore Purchase</Text>
            <View style={styles.footerDot} />
            <Text style={styles.footerText}>Terms of Use</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MAROON_ALT,
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },

  // Top bar — Figma has no explicit height; tallest child (close button = 40)
  // sets the row. Set 40 here so the body sits 4px closer to the logo than
  // the prior 44 height.
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 40,
  },
  topPlaceholder: { width: 72, height: 24 },
  topLogo: {
    position: "absolute",
    width: 44,
    height: 44,
    left: "50%",
    marginLeft: -22,
    top: 0,
  },
  closeBtn: { padding: 8 },

  // Body
  body: {
    flex: 1,
    alignItems: "center",
    gap: 24,
    // Figma dev-mode measures 20px from logo bottom to top of the reset
    // wordmark glyphs. With alignItems:center on the title row and pro
    // lineHeight tightened to 40, the wordmark sits ~6px below the row
    // top (wordmark 32 centered in row 40, +2 viewBox padding). Logo
    // bottom is at body_top + 4 (logo 44 tall extending past the 40-tall
    // topBar). Net: paddingTop 18 lands the visible gap at ~20px.
    paddingTop: 18,
    width: "100%",
  },

  // Title "reset pro" — alignItems:center vertically centers each child in
  // the row. The wordmark (32 tall) centered in a 40-tall row puts its
  // glyphs ~6px below the row top; DM Sans at fontSize 40 (cap-height
  // ~28) puts the pro caps ~6px below the row top too. Net: visual
  // alignment between "reset" and "pro" caps. flex-end made pro 6px
  // higher than reset because pro's container is taller and got pinned to
  // the row bottom while reset was pushed down.
  title: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  titlePro: {
    fontFamily: fonts.dmSans,
    fontSize: 40,
    // Tight line-height so the "pro" text container is 40 tall, not 48
    // (default ~1.2 × fontSize). Default line-height inflates the title row
    // height and, with alignItems:flex-end on the title row, pushes the
    // wordmark glyphs ~16px below the row top instead of sitting at the
    // top. Tightening here keeps the row at 40 and the visible glyphs
    // close to the row top.
    lineHeight: 40,
    color: WHITE,
    letterSpacing: -0.4,
  },

  // Wrapper around the comparison table — flex:1 lets it absorb spare
  // vertical space between the title and the plans row so the table sits
  // centered between them (equal gap above/below).
  tableSlot: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  // Comparison table
  tableWrap: {
    width: "100%",
    alignItems: "stretch",
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  tab: {
    width: COL_W,
    paddingTop: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tabPro: {
    backgroundColor: GHOST_W,
    borderLeftWidth: 0.5,
    borderTopWidth: 0.5,
    borderColor: DIVIDER,
  },
  tabFree: {
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderTopWidth: 0.5,
    borderColor: DIVIDER,
  },
  tabPill: {
    backgroundColor: GHOST_W,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tabText: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 14,
    color: WHITE,
  },
  tabTextDim: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 14,
    color: TEXT_ALT,
  },
  tabSpacer: { flex: 1 },

  tableRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },

  // Pro column cells — ghost bg, left border only (no top border → no
  // horizontal row separators). Top border is implicit from the Pro tab
  // above; bottom border closes the table on the last row.
  cellPro: {
    width: COL_W,
    backgroundColor: GHOST_W,
    borderLeftWidth: 0.5,
    borderColor: DIVIDER,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  cellProLast: {
    borderBottomWidth: 0.5,
    borderBottomLeftRadius: 8,
  },

  // Free column cells — left border only.
  cellFree: {
    width: COL_W,
    borderLeftWidth: 0.5,
    borderColor: DIVIDER,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  cellFreeLast: {
    borderBottomWidth: 0.5,
  },

  // Label column — flex, left + right border. Top border applied only to
  // the first row (cellLabelFirst) so the table top closes against the
  // tabs above without adding a horizontal divider between content rows.
  cellLabel: {
    flex: 1,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: DIVIDER,
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 8,
    justifyContent: "center",
  },
  cellLabelFirst: {
    borderTopWidth: 0.5,
    borderTopRightRadius: 8,
  },
  cellLabelLast: {
    borderBottomWidth: 0.5,
    borderBottomRightRadius: 8,
  },
  cellLabelText: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    color: WHITE,
    letterSpacing: -0.16,
  },

  // Plan cards
  plansRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 4,
    width: "100%",
  },
  planCard: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
  },
  // Radii are bound to the card itself (Monthly vs Yearly) per Figma —
  // each plan has its own asymmetric shape regardless of which is
  // selected. Selection state only flips the border + bg below.
  planRadiiMonthly: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 24,
  },
  planRadiiYearly: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 40,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 4,
  },
  planUnselected: {
    borderWidth: 2,
    borderColor: DIVIDER,
  },
  planSelected: {
    borderWidth: 2,
    borderColor: WHITE,
    backgroundColor: GHOST_W,
  },
  planTitle: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    color: WHITE,
    letterSpacing: -0.2,
  },
  planPrice: {
    alignItems: "flex-start",
    gap: 2,
  },
  planUnit: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    color: TEXT_ALT,
    letterSpacing: -0.14,
  },
  planPriceText: {
    fontFamily: fonts.dmSansBold,
    fontSize: 24,
    color: WHITE,
    letterSpacing: -0.24,
  },
  planBilled: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    color: TEXT_ALT,
    letterSpacing: -0.12,
  },
  saleTag: {
    position: "absolute",
    left: 14,
    top: -10,
    backgroundColor: MAROON,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  saleTagText: {
    fontFamily: fonts.playfair,
    fontSize: 12,
    color: WHITE,
    letterSpacing: -0.12,
  },

  // CTA block
  ctaBlock: {
    width: "100%",
    alignItems: "center",
    gap: 8,
  },
  cancelHint: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    color: TEXT_ALT,
    letterSpacing: -0.14,
    textAlign: "center",
  },
  subscribeBtn: {
    backgroundColor: "#000",
    height: 56,
    width: "100%",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeText: {
    fontFamily: fonts.dmSansBold,
    fontSize: 20,
    color: WHITE,
    letterSpacing: -0.2,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 8,
  },
  footerText: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    color: BONE,
    letterSpacing: -0.12,
  },
  footerDot: {
    width: 0.5,
    height: 12,
    backgroundColor: DIVIDER,
  },
});

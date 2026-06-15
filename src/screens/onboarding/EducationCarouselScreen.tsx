import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Image,
  ImageSourcePropType,
  Animated,
  Platform,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { VideoView, useVideoPlayer } from "expo-video";
import { K } from "../../constants/colors";
import { fonts, spacing } from "../../constants/typography";
import { logEvent } from "../../services/braze";
import { PreScanView } from "./PreScanScreen";

type Props = NativeStackScreenProps<any, "Education">;

type Slide = {
  index: string;
  variant: "fullBleed" | "card" | "preview";
  title: string;
  subtitle: React.ReactNode;
  image?: ImageSourcePropType;
  imageAspectRatio?: number;
  imageWidthPct?: number;
  imageTopOffset?: number;
  video?: number;
};

const INTRO_VIDEO = require("../../../assets/videos/education-intro.mp4");

const SLIDES: Slide[] = [
  {
    index: "01",
    variant: "fullBleed",
    title: "Your body has its own rules.",
    subtitle: (
      <>
        You feel stuck in your weight loss. That's because you've never had a
        plan built for <Text style={{ fontWeight: "700" }}>your body.</Text>
      </>
    ),
    video: INTRO_VIDEO,
  },
  {
    index: "02",
    variant: "card",
    title: "Scan your face",
    subtitle: "Thirty seconds. Thirty biometric markers.",
    image: require("../../../assets/images/onboarding/education-scan.png"),
    imageAspectRatio: 1033 / 986,
    imageWidthPct: 1,
    imageTopOffset: 90,
  },
  {
    index: "03",
    variant: "card",
    title: "Find your type",
    subtitle: "The moment your pattern has a name.",
    image: require("../../../assets/images/onboarding/education-type.png"),
    imageAspectRatio: 1093 / 1401,
    imageWidthPct: 1,
    imageTopOffset: 0,
  },
  {
    index: "04",
    variant: "card",
    title: "Finally lose the weight",
    subtitle: "A daily plan that knows what you're dealing with.",
    image: require("../../../assets/images/onboarding/education-plan.png"),
    imageAspectRatio: 1206 / 1545,
    imageWidthPct: 1.1,
    imageTopOffset: -10,
  },
  // Transition "peek" — renders the same PreScanView the real PreScan screen
  // shows, so the forward swipe reveals continuous content (rather than blank
  // maroon). When momentum lands on this slide, we navigate to the real
  // PreScan and the swap is invisible because the visuals already match.
  {
    index: "05",
    variant: "preview",
    title: "",
    subtitle: "",
  },
];

const EDU_SLIDE_COUNT = 4;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ACTIVE_BLOCK_LEFT = 46;
const BLOCK_WIDTH = 304;
const BLOCK_GAP = 24;
const BLOCK_STRIDE = BLOCK_WIDTH + BLOCK_GAP;


function ResetLogo() {
  return (
    <Svg width={72} height={24} viewBox="0 0 72 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M19.6848 3.37491C25.2172 3.37491 27.6729 7.35293 27.673 12.1084V13.1966H16.2348C16.5146 15.31 17.6026 16.4289 19.9025 16.4289C21.5497 16.4289 22.4511 15.838 22.7618 14.7501H27.6107C26.927 18.3246 23.9118 20.2834 19.8402 20.2834C14.9294 20.2833 11.4174 17.3303 11.4174 12.0153C11.4174 7.25986 14.1525 3.37499 19.6848 3.37491ZM19.6848 7.22937C17.7577 7.22943 16.7009 8.16141 16.3279 10.1196H22.8864C22.7932 8.19255 21.612 7.22937 19.6848 7.22937Z"
        fill="#FAFDFE"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M52.2583 3.34478C57.7906 3.3448 60.2464 7.32343 60.2464 12.0789V13.1664H48.8083C49.0882 15.2799 50.1757 16.3994 52.4759 16.3995C54.1231 16.3995 55.0252 15.8086 55.3359 14.7207H60.1841C59.5004 18.295 56.4859 20.2532 52.4143 20.2533L51.9576 20.2446C47.2868 20.0663 43.9909 17.1344 43.9908 11.9858C43.9908 7.23033 46.7258 3.34478 52.2583 3.34478ZM52.2583 7.19924C50.3313 7.19924 49.275 8.1314 48.902 10.0894H55.4598C55.3665 8.16259 54.1852 7.19925 52.2583 7.19924Z"
        fill="#FAFDFE"
      />
      <Path
        d="M35.5875 3.33406C40.0943 3.33413 42.9224 5.13692 43.1705 9.02201H38.3531C38.1977 7.71656 37.1719 7.03317 35.4315 7.03317C34.033 7.0332 33.3496 7.49898 33.3496 8.27603C33.3496 9.05315 34.0642 9.45733 35.4007 9.67491L38.5708 10.2033C41.0573 10.6072 43.4196 11.6953 43.4196 14.8968C43.4196 18.4399 40.5597 20.2425 36.3328 20.2425L35.9638 20.2379C32.1541 20.1412 28.6135 18.5346 28.2522 14.7408H33.225C33.4736 15.8284 34.4684 16.5441 36.4266 16.5441C37.918 16.5441 38.6643 16.1088 38.6645 15.3321C38.6645 14.4305 37.7318 14.182 36.4266 13.9954L34.1886 13.6533C31.5467 13.2493 28.6868 12.2856 28.6868 8.58674C28.6869 5.29216 31.0806 3.33406 35.5875 3.33406Z"
        fill="#FAFDFE"
      />
      <Path
        d="M6.15804 6.76732C6.59318 4.96456 7.96066 3.7212 9.91875 3.72111H11.1797V9.17402H6.3442V19.9365H1.37143V3.72111H6.15804V6.76732Z"
        fill="#FAFDFE"
      />
      <Path
        d="M65.6062 4.73897H70.6286V10.1912H69.3676C67.4097 10.1912 66.0421 9.04662 65.6069 7.24411V15.5323L70.6286 15.4827L70.6279 15.4834V19.9044H66.1098C62.7221 19.9043 61.0795 18.2883 61.0795 14.8693V1.37134H65.6062V4.73897Z"
        fill="#FAFDFE"
      />
    </Svg>
  );
}

function AnimatedTextBlock({
  slide,
  index,
  scrollX,
}: {
  slide: Slide;
  index: number;
  scrollX: Animated.Value;
}) {
  const stepProgress = (index + 1) / EDU_SLIDE_COUNT;
  const stepLabel = String(index + 1).padStart(2, "0");

  // Fully opaque when this index is active; 0.32 when neighboring; 0 beyond.
  const blockOpacity = scrollX.interpolate({
    inputRange: [
      (index - 2) * SCREEN_WIDTH,
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
      (index + 2) * SCREEN_WIDTH,
    ],
    outputRange: [0, 0.32, 1, 0.32, 0],
    extrapolate: "clamp",
  });

  // Number/title/subtitle: visible while this block is "next preview" or active;
  // fade out as it becomes "prev" (progress-only stub).
  const textOpacity = scrollX.interpolate({
    inputRange: [index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <Animated.View style={[styles.textBlock, { opacity: blockOpacity }]}>
      <View style={styles.titleGroup}>
        <Animated.Text style={[styles.stepLabel, { opacity: textOpacity }]}>
          {stepLabel}
        </Animated.Text>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${stepProgress * 100}%` }]}
          />
        </View>
        <Animated.Text style={[styles.title, { opacity: textOpacity }]}>
          {slide.title}
        </Animated.Text>
      </View>
      <Animated.Text style={[styles.subtitle, { opacity: textOpacity }]}>
        {slide.subtitle}
      </Animated.Text>
    </Animated.View>
  );
}

export function EducationCarouselScreen({ navigation }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const insets = useSafeAreaInsets();
  const scrollX = useRef(new Animated.Value(0)).current;
  const advancedRef = useRef(false);
  // The `focus` listener below snaps `active` to the last real slide so a
  // return from PreScan lands there (the ScrollView is snapped back on blur).
  // That must NOT run on the very first focus (initial entry), or slide 0's
  // arrow sees active === last and jumps straight to PreScan. Skip the first.
  const firstFocusRef = useRef(true);

  const introPlayer = useVideoPlayer(INTRO_VIDEO, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  useEffect(() => {
    logEvent("onboarding_education");
  }, []);

  // When we navigate to PreScan, snap the ScrollView back to slide 4 on `blur`
  // (PreScan is now on top so the snap is invisible). Defer to the next frame
  // and avoid setState here — a re-render of Education during the transition
  // can flicker through PreScan on the iOS sim.
  useEffect(() => {
    const snapToLastSlide = () => {
      scrollRef.current?.scrollTo({
        x: (EDU_SLIDE_COUNT - 1) * SCREEN_WIDTH,
        animated: false,
      });
      activeRef.current = EDU_SLIDE_COUNT - 1;
    };
    const blurUnsub = navigation.addListener("blur", () => {
      if (advancedRef.current) {
        // Snap back to the last real slide while PreScan covers Education, so
        // returning here never re-shows the teaser. iOS paints PreScan within
        // one frame under animation:"none", so rAF hides the snap. Android
        // needs a few more frames or the snap-back flashes through before
        // PreScan has painted — defer past the transition there.
        if (Platform.OS === "android") {
          setTimeout(snapToLastSlide, 150);
        } else {
          requestAnimationFrame(snapToLastSlide);
        }
      }
    });
    const focusUnsub = navigation.addListener("focus", () => {
      advancedRef.current = false;
      // Initial entry must stay on slide 0; only a return from PreScan should
      // snap to the last real slide (matching the blur snap-back above).
      if (firstFocusRef.current) {
        firstFocusRef.current = false;
        return;
      }
      setActive(EDU_SLIDE_COUNT - 1);
    });
    return () => {
      blurUnsub();
      focusUnsub();
    };
  }, [navigation]);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    // When momentum lands on the PreScan teaser slide, push the real PreScan
    // screen. Visuals match so the swap is invisible. The `blur` listener
    // snaps the ScrollView back to slide 4 once PreScan covers Education.
    if (idx === EDU_SLIDE_COUNT && !advancedRef.current) {
      advancedRef.current = true;
      logEvent("onboarding_education_continueCTA");
      navigation.navigate("PreScan");
      return;
    }
    if (idx !== active && idx < EDU_SLIDE_COUNT) {
      setActive(idx);
      activeRef.current = idx;
      logEvent("onboarding_education_slide", { slide: SLIDES[idx].index });
    }
  };

  const handleAdvance = () => {
    if (active < EDU_SLIDE_COUNT - 1) {
      const next = active + 1;
      scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
      setActive(next);
      activeRef.current = next;
      logEvent("onboarding_education_slide", { slide: SLIDES[next].index });
    } else {
      logEvent("onboarding_education_continueCTA");
      // Reach PreScan through the same seamless teaser slide the swipe uses,
      // rather than a hard cut from this slide. Mark advanced so the momentum
      // handler doesn't also navigate, slide to the teaser (a pixel copy of
      // PreScan), then push the real screen once it's on-screen —
      // animation:"none" makes the swap invisible and the `blur` listener snaps
      // the carousel back to the last real slide underneath. A timer drives the
      // nav because a programmatic animated scroll doesn't reliably fire
      // onMomentumScrollEnd on Android.
      advancedRef.current = true;
      scrollRef.current?.scrollTo({
        x: EDU_SLIDE_COUNT * SCREEN_WIDTH,
        animated: true,
      });
      setTimeout(() => navigation.navigate("PreScan"), 320);
    }
  };

  // The arrow lives in a fixed footer overlay, so without this it stayed
  // visible as the user swiped onto the PreScan teaser slide and lingered a
  // beat on PreScan during the animation:"none" handoff. Fade it out early in
  // the swipe from the last real slide toward the teaser so it's gone before
  // PreScan loads. (scrollX is native-driven; opacity is native-safe.)
  const arrowOpacity = scrollX.interpolate({
    inputRange: [
      (EDU_SLIDE_COUNT - 1) * SCREEN_WIDTH,
      (EDU_SLIDE_COUNT - 0.4) * SCREEN_WIDTH,
    ],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const renderSlide = (item: Slide) => {
    if (item.variant === "preview") {
      // Render the exact PreScan layout as a non-interactive teaser. When
      // momentum lands on this slide we navigate to the real PreScan; because
      // visuals match, no swap is visible.
      return (
        <View key={item.index} style={styles.slide}>
          <PreScanView
            onScan={() => {}}
            onClose={() => {}}
            interactive={false}
          />
        </View>
      );
    }
    return (
      <View key={item.index} style={styles.slide}>
        {item.variant === "fullBleed" ? (
          <>
            {item.video ? (
              <VideoView
                player={introPlayer}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                nativeControls={false}
              />
            ) : item.image ? (
              <Image
                source={item.image}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : null}

            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg width="100%" height="100%" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="slideFade" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#000000" stopOpacity="0" />
                    <Stop offset="0.55" stopColor="#000000" stopOpacity="0.5" />
                    <Stop offset="1" stopColor="#000000" stopOpacity="0.9" />
                  </LinearGradient>
                </Defs>
                <Rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill="url(#slideFade)"
                />
              </Svg>
            </View>
          </>
        ) : (
          <>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg width="100%" height="100%" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient
                    id="cardVignette"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <Stop offset="0.4358" stopColor="#000000" stopOpacity="0" />
                    <Stop offset="0.815" stopColor="#000000" stopOpacity="0.6" />
                  </LinearGradient>
                </Defs>
                <Rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill="url(#cardVignette)"
                />
              </Svg>
            </View>
            <View
              style={[
                styles.cardPhotoArea,
                {
                  paddingTop:
                    insets.top + spacing.md + 24 + (item.imageTopOffset ?? 0),
                },
              ]}
              pointerEvents="none"
            >
            <View
              style={[
                styles.heroImageWrap,
                {
                  width: `${(item.imageWidthPct ?? 1) * 100}%`,
                  aspectRatio: item.imageAspectRatio ?? 345 / 412,
                },
              ]}
            >
              {item.image && (
                <Image
                  source={item.image}
                  style={styles.heroImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </View>
          <View style={styles.slideBottomFade} pointerEvents="none">
            <Svg width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="slideBottomFade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#000000" stopOpacity="0" />
                  <Stop offset="0.76" stopColor="#000000" stopOpacity="0" />
                  <Stop offset="1" stopColor="#000000" stopOpacity="0.72" />
                </LinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="url(#slideBottomFade)"
              />
            </Svg>
          </View>
          </>
        )}

        <View
          style={[
            styles.slideContent,
            {
              paddingTop: insets.top + spacing.md,
            },
          ]}
          pointerEvents="box-none"
        >
          <ResetLogo />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        ref={scrollRef as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={1}
        decelerationRate="fast"
      >
        {SLIDES.map(renderSlide)}
      </Animated.ScrollView>

      <View style={styles.carouselOverlay} pointerEvents="none">
        <Animated.View
          style={[
            styles.carouselRow,
            {
              transform: [
                {
                  translateX: scrollX.interpolate({
                    inputRange: [0, SCREEN_WIDTH],
                    outputRange: [
                      ACTIVE_BLOCK_LEFT,
                      ACTIVE_BLOCK_LEFT - BLOCK_STRIDE,
                    ],
                    extrapolate: "extend",
                  }),
                },
              ],
            },
          ]}
        >
          {SLIDES.slice(0, EDU_SLIDE_COUNT).map((slide, i) => (
            <AnimatedTextBlock
              key={slide.index}
              slide={slide}
              index={i}
              scrollX={scrollX}
            />
          ))}
        </Animated.View>
      </View>

      <SafeAreaView
        style={[styles.footerOverlay, { paddingBottom: spacing.md }]}
        edges={["bottom"]}
        pointerEvents="box-none"
      >
        <Animated.View style={{ opacity: arrowOpacity }}>
          <TouchableOpacity
            onPress={handleAdvance}
            style={styles.arrowButton}
            accessibilityLabel={
              active < SLIDES.length - 1 ? "Next slide" : "Continue"
            }
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M5 12h14M13 5l7 7-7 7"
                stroke={K.brown}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: K.brown,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    overflow: "hidden",
  },
  slideContent: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 24,
  },
  spacer: {
    flex: 1,
  },
  cardPhotoArea: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  heroImageWrap: {},
  heroImage: {
    width: "100%",
    height: "100%",
  },
  slideBottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "55%",
  },
  carouselOverlay: {
    position: "absolute",
    top: "60%",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "visible",
  },
  carouselRow: {
    flexDirection: "row",
    gap: BLOCK_GAP,
    alignItems: "flex-start",
  },
  textBlock: {
    width: BLOCK_WIDTH,
    minHeight: 160,
    padding: 8,
    gap: 16,
    alignItems: "flex-start",
  },
  titleGroup: {
    alignSelf: "stretch",
    gap: 8,
    alignItems: "flex-start",
  },
  stepLabel: {
    fontFamily: fonts.playfair,
    color: K.bone,
    fontSize: 12,
    letterSpacing: -0.12,
  },
  progressTrack: {
    alignSelf: "stretch",
    height: 2,
    backgroundColor: K.bone + "3D",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: 2,
    backgroundColor: K.bone,
    borderRadius: 999,
  },
  title: {
    fontFamily: fonts.playfairBold,
    color: K.bone,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.4,
    alignSelf: "stretch",
  },
  subtitle: {
    fontFamily: fonts.dmSans,
    color: K.bone,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    alignSelf: "stretch",
  },
  footerOverlay: {
    position: "absolute",
    right: 24,
    bottom: 0,
    alignItems: "flex-end",
  },
  arrowButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fafdfe",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowGlyph: {
    fontSize: 24,
    color: K.brown,
  },
});

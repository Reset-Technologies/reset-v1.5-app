import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fonts, spacing } from "../../constants/typography";
import { submitCheckIn } from "../../services/checkIn";
import { useAppPalette } from "../../hooks/useAppPalette";
import { CheckInV2 } from "../../components/homeV2";
import type { AppOpenStackParamList } from "../../navigation/AppOpenNavigator";

export function AppOpenSurveyScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppOpenStackParamList>>();
  const insets = useSafeAreaInsets();
  const { outerBg, innerBg, textColor, statusBarStyle } = useAppPalette();
  const [advanceAt, setAdvanceAt] = useState<number | null>(null);

  useEffect(() => {
    if (advanceAt === null) return;
    const delay = Math.max(0, advanceAt - Date.now());
    const id = setTimeout(() => navigation.replace("EncourageScan"), delay);
    return () => clearTimeout(id);
  }, [advanceAt, navigation]);

  const handleComplete = async (data: {
    energy: string | null;
    stress: string | null;
    sleepHours: number | null;
    sleepQuality: string | null;
  }) => {
    try {
      const result = await submitCheckIn({
        energy: data.energy ?? "okay",
        stressTags: data.stress ? [data.stress] : [],
        sleepHours: data.sleepHours ?? undefined,
        sleepQuality: data.sleepQuality ?? undefined,
      });
      // Hold the Ester ack for ~2s so the user sees it, then continue.
      setAdvanceAt(Date.now() + 2000);
      return result.esterResponse;
    } catch {
      setAdvanceAt(Date.now() + 1500);
      return undefined;
    }
  };

  const handleDismiss = () => {
    const parent = navigation.getParent();
    parent?.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Tabs" }],
      }),
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: outerBg }]}>
      <StatusBar barStyle={statusBarStyle} translucent />
      <View
        style={[
          styles.safe,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <View style={[styles.card, { backgroundColor: innerBg }]}>
          <View style={styles.cardInner}>
            <View style={styles.header}>
              <View style={styles.brandLogo}>
                <Image
                  source={require("../../../assets/images/quick-scan-mascot.png")}
                  style={[styles.brandLogoImage, { tintColor: textColor }]}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.title, { color: textColor }]} pointerEvents="none">
                Quick survey
              </Text>
            </View>

            <Text style={[styles.intro, { color: textColor }]}>
              A few quick signals so I can tune today's meals. Takes under a
              minute.
            </Text>

            <CheckInV2 onComplete={handleComplete} onDismiss={handleDismiss} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  card: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: 28,
    overflow: "hidden",
  },
  cardInner: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  brandLogo: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  brandLogoImage: {
    width: "100%",
    height: "100%",
  },
  title: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: fonts.catalogueBold,
    fontSize: 26,
    letterSpacing: -0.3,
  },
  intro: {
    fontFamily: fonts.catalogue,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.22,
  },
});

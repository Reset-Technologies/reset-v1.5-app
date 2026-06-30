import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCameraPermissions } from "expo-camera";
import { K } from "../../constants/colors";
import { typography } from "../../constants/typography";
import { EsterBubble, Button, Avatar } from "../../components";
import { logEvent } from "../../services/braze";

type Props = NativeStackScreenProps<any, "CameraPerm">;

export function CameraPermScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [denialCount, setDenialCount] = useState(0);

  useEffect(() => {
    logEvent("onboarding_camera_permission");
  }, []);

  const handleRequestPermission = async () => {
    if (denialCount > 0) {
      logEvent("onboarding_camera_permission_tryAgainCTA");
    } else {
      logEvent("onboarding_camera_permission_allowCTA");
    }
    const result = await requestPermission();
    if (result.granted) {
      navigation.navigate("Scan");
    } else {
      setDenialCount((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    if (denialCount > 0) {
      logEvent("onboarding_camera_permission_skipScanCTA");
    } else {
      logEvent("onboarding_camera_permission_skipCTA");
    }
    // TODO RES-119 (#125): declining the scan should drop into the "false
    // start" home (blurred recs + scan CTA). For now continue the survey —
    // AccountScreen skips the type reveal when there are no biometrics.
    navigation.navigate("Survey", { step: 0 });
  };

  // First denial message
  if (denialCount === 1) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.content}>
          <EsterBubble message="I never store the video. The scan happens on your phone — I only keep the numbers." />
        </View>
        <View style={styles.bottom}>
          <Button title="Try again" onPress={handleRequestPermission} />
          <Button title="Skip the scan" variant="ghost" onPress={handleSkip} />
        </View>
      </SafeAreaView>
    );
  }

  // Second denial - just advance
  if (denialCount >= 2) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.content}>
          <EsterBubble message="No problem. I'll work with what I know. The quiz tells me a lot — and you can always scan later." />
        </View>
        <View style={styles.bottom}>
          <Button title="Continue" onPress={handleSkip} />
        </View>
      </SafeAreaView>
    );
  }

  // Initial permission request
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.content}>
        <View style={styles.avatarContainer}>
          <Avatar size={56} />
        </View>

        <Text style={styles.explanation}>
          I pick up subtle changes in your skin to understand your stress patterns, energy, and heart rhythm.
        </Text>

        <View style={styles.illustration}>
          <View style={styles.faceOutline}>
            <View style={styles.faceInner} />
          </View>
        </View>

        <View style={styles.features}>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>💓</Text>
            <View>
              <Text style={styles.featureTitle}>Heart Rate</Text>
              <Text style={styles.featureDesc}>Live pulse tracking</Text>
            </View>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🧘</Text>
            <View>
              <Text style={styles.featureTitle}>Stress Index</Text>
              <Text style={styles.featureDesc}>Stress patterns</Text>
            </View>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>✨</Text>
            <View>
              <Text style={styles.featureTitle}>Wellness Score</Text>
              <Text style={styles.featureDesc}>Your current baseline</Text>
            </View>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🌬️</Text>
            <View>
              <Text style={styles.featureTitle}>Breathing Rate</Text>
              <Text style={styles.featureDesc}>Breathing patterns</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.bottom}>
        <Button title="Let Ester see" onPress={handleRequestPermission} />
        <Button title="Not right now" variant="ghost" onPress={handleSkip} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: K.cream,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  explanation: {
    ...typography.body,
    color: K.text,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  illustration: {
    alignItems: "center",
    marginBottom: 24,
  },
  faceOutline: {
    width: 120,
    height: 160,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: K.mustard + "60",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: K.warmGray,
  },
  faceInner: {
    width: 80,
    height: 110,
    borderRadius: 40,
    backgroundColor: K.mustard + "15",
  },
  features: {
    gap: 12,
  },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    backgroundColor: K.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: K.border,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureTitle: {
    ...typography.bodyMedium,
    fontSize: 14,
  },
  featureDesc: {
    ...typography.caption,
    color: K.sub,
    marginTop: 2,
  },
  bottom: {
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
});

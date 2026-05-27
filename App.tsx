import "react-native-gesture-handler";
import React, { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
} from "@expo-google-fonts/playfair-display";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { AppProvider } from "./src/context/AppContext";
import { ToastProvider } from "./src/context/ToastContext";
import { RootNavigator } from "./src/navigation";
import { PaletteProvider } from "./src/hooks/useAppPalette";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

const MIN_SPLASH_MS = 1200;

export default function App() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    QuadrantText_400Regular: require("./assets/fonts/QuadrantTextTrial-Regular.otf"),
    Catalogue_400Regular: require("./assets/fonts/Catalogue-Regular.otf"),
    Catalogue_500Medium: require("./assets/fonts/Catalogue-Medium.otf"),
    Catalogue_700Bold: require("./assets/fonts/Catalogue-Bold.otf"),
  });
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  const ready = fontsLoaded && minTimeElapsed;

  const onLayoutRootView = useCallback(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <AppProvider>
          <PaletteProvider>
            <ToastProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </ToastProvider>
          </PaletteProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
});

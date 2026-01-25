import { LogBox, View } from "react-native";
LogBox.ignoreLogs(["VirtualizedLists should never be nested"]);

import { Slot, usePathname } from "expo-router";
import { useEffect, useMemo } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "./i18n"; // 🔑 WICHTIG

import BottomNavbar from "../components/bottomnavbar";
import FloatingNowPlaying from "../components/floatingnowplaying";

const HIDE_ON: RegExp[] = [
  /^\/login$/i,
  /^\/register$/i,
  /^\/splash$/i,
  /^\/postloginsplash$/i,
  /^\/start$/i,
  /^\/chat\/[^/]+$/i,
  /^\/profile\/upload\/?/i,
];

export default function RootLayout() {
  const pathname = usePathname() || "/";

  const showBottomBar = useMemo(() => {
    for (const rx of HIDE_ON) if (rx.test(pathname)) return false;
    return true;
  }, [pathname]);

  // 🌍 Sprache global laden
  useEffect(() => {
    (async () => {
      const lang = await AsyncStorage.getItem("language");
      if (lang) i18n.changeLanguage(lang);
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={{ flex: 1 }}>
          <Slot />
          {showBottomBar && <BottomNavbar />}
          <FloatingNowPlaying />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

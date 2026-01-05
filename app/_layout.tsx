// app/_layout.tsx
import { LogBox } from "react-native";
LogBox.ignoreLogs(["VirtualizedLists should never be nested"]);

import { Slot, usePathname } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={{ flex: 1 }}>
          <Slot />

          {showBottomBar && <BottomNavbar />}

          {/* Schwebende Kugel global */}
          <FloatingNowPlaying />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

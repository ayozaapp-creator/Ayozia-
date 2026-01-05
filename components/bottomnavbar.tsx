// components/bottomnavbar.tsx
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useMemo } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BG = "#000";
const BORDER = "#1e1e1e";
const TEXT = "#fff";
const ACCENT = "#ff4fd8";

type TabItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  match: RegExp;
};

/**
 * 🔴 WICHTIG
 * Alle Routen, bei denen die BottomNavbar NICHT angezeigt werden darf
 * → Stories, Kamera, Upload, Vollbild-Chat usw.
 */
const HIDDEN_PREFIXES = [
  "/stories",          // 🔥 deckt /stories/[userId] ab
  "/stories/camera",
  "/stories/upload",
  "/chat/camera",
  "/chat/voicemessage",
];

const TABS: TabItem[] = [
  {
    label: "Home",
    icon: "home-outline",
    href: "/startseite",
    match: /^\/(startseite|home|index)\/?$/i,
  },
  {
    label: "Search",
    icon: "search-outline",
    href: "/search",
    match: /^\/search(\/.*)?$/i,
  },
  {
    label: "Snippet",
    icon: "flame-outline",
    href: "/snippet",
    match: /^\/snippet(\/.*)?$/i,
  },
  {
    label: "Chat",
    icon: "chatbubble-outline",
    href: "/chat",
    match: /^\/chat(\/)?$/i,
  },
  {
    label: "Profile",
    icon: "person-circle-outline",
    href: "/profile",
    match: /^\/profile(\/(index)?)?$/i,
  },
];

export default function BottomNavbar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname() || "/";
  const router = useRouter();

  /**
   * ❌ Navbar ausblenden (Stories, Kamera etc.)
   */
  const isHidden = useMemo(() => {
    return HIDDEN_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    );
  }, [pathname]);

  if (isHidden) {
    return null;
  }

  /**
   * ✅ Aktiver Tab
   */
  const activeIndex = useMemo(() => {
    const idx = TABS.findIndex((t) => t.match.test(pathname));
    return idx === -1 ? 0 : idx;
  }, [pathname]);

  const height =
    58 + Math.max(insets.bottom, Platform.OS === "ios" ? 10 : 0);

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height,
        paddingBottom: Math.max(insets.bottom, 8),
        backgroundColor: BG,
        borderTopWidth: 1,
        borderTopColor: BORDER,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        zIndex: 50,
      }}
    >
      {TABS.map((tab, idx) => {
        const active = idx === activeIndex;
        const color = active ? ACCENT : TEXT;

        return (
          <TouchableOpacity
            key={tab.label}
            onPress={() => router.push(tab.href as any)}
            activeOpacity={0.85}
            style={{
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <Ionicons name={tab.icon} size={22} color={color} />
            <Text
              style={{
                color,
                fontSize: 11,
                fontWeight: active ? "800" : "600",
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

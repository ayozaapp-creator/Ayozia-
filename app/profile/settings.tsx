// app/profile/settings.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BG = "#050505";
const CARD = "#141414";
const BORDER = "#1f1f1f";
const TXT = "#ffffff";
const TXT_DIM = "#b5b5b5";
const ACCENT = "#ff4fd8";

type SettingItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route?: string;
  subtitle?: string;
};

type SettingSection = {
  title: string;
  items: SettingItem[];
};

const sections: SettingSection[] = [
  {
    title: "Guthaben",
    items: [
      {
        icon: "wallet-outline",
        label: "Guthaben",
        subtitle: "Dein aktuelles Ayoza-Guthaben",
        route: "/profile/settings/balance",
      },
    ],
  },
  {
    title: "Konto",
    items: [
      {
        icon: "notifications-outline",
        label: "Benachrichtigungen",
        route: "/profile/settings/notifications",
      },
      {
        icon: "card-outline",
        label: "Käufe und Mitgliedschaft",
        route: "/profile/settings/membership",
      },
      {
        icon: "language-outline",
        label: "Sprachen",
        route: "/profile/settings/language",
      },
      {
        icon: "shield-checkmark-outline",
        label: "Meine Daten auf Ayoza",
        route: "/profile/settings/my-data",
      },
      {
        icon: "lock-closed-outline",
        label: "Datenschutz",
        route: "/profile/settings/privacy",
      },
    ],
  },
  {
    title: "Audioeinstellung",
    items: [
      {
        icon: "play-circle-outline",
        label: "Wiedergabe",
        route: "/profile/settings/playback",
      },
      {
        icon: "download-outline",
        label: "Offline",
        route: "/profile/settings/offline",
      },
      {
        icon: "cloud-upload-outline",
        label: "Uploads",
        route: "/profile/settings/uploads",
      },
    ],
  },
  {
    title: "Wer darf deine Inhalte sehen",
    items: [
      {
        icon: "eye-outline",
        label: "Konto Privatsphäre",
        route: "/profile/settings/accountprivacy",
      },
      {
        icon: "ban-outline",
        label: "Blockierte Nutzer",
        route: "/profile/settings/blockedusers",
      },
    ],
  },
  {
    title: "Wie andere mit dir interagieren können",
    items: [
      {
        icon: "chatbubbles-outline",
        label: "Nachrichten & Storys",
        route: "/profile/settings/messages-stories",
      },
    ],
  },
  {
    title: "Hilfe und Richtlinien",
    items: [
      {
        icon: "help-circle-outline",
        label: "Hilfe",
        route: "/profile/settings/help",
      },
      {
        icon: "chatbox-ellipses-outline",
        label: "Feedback geben",
        route: "/profile/settings/feedback",
      },
      {
        icon: "document-text-outline",
        label: "Ayoza Nutzungsbedingungen",
        route: "/profile/settings/terms",
      },
      {
        icon: "information-circle-outline",
        label: "Info",
        route: "/profile/settings/info",
      },
    ],
  },
];

const SettingsScreen: React.FC = () => {
  const router = useRouter();

  const handlePress = (item: SettingItem) => {
    if (item.route) {
      router.push(item.route as any);
    } else {
      Alert.alert(item.label, "Diese Einstellung kommt später.");
    }
  };

  const logout = async () => {
    Alert.alert(
      "Abmelden",
      "Möchtest du dich wirklich abmelden?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Abmelden",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.clear();
            router.replace("/login");
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-outline" size={26} color={TXT} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Einstellungen</Text>
          <View style={styles.headerAccentBar} />
        </View>

        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>

            <View style={styles.card}>
              {section.items.map((item, index) => {
                const isLast = index === section.items.length - 1;
                return (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.row, !isLast && styles.rowBorder]}
                    activeOpacity={0.8}
                    onPress={() => handlePress(item)}
                  >
                    <View style={styles.rowLeft}>
                      <View style={styles.iconBubble}>
                        <Ionicons name={item.icon} size={20} color={TXT} />
                      </View>

                      <View>
                        <Text style={styles.rowLabel}>{item.label}</Text>
                        {item.subtitle ? (
                          <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
                        ) : null}
                      </View>
                    </View>

                    <Ionicons
                      name="chevron-forward-outline"
                      size={18}
                      color={TXT_DIM}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* ───────────── ABMELDEN ───────────── */}
        <View style={{ marginTop: 26 }}>
          <TouchableOpacity
            onPress={logout}
            style={styles.logoutBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="log-out-outline" size={20} color="#fff" />
            <Text style={styles.logoutText}>Abmelden</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 16 },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: ACCENT, fontSize: 18, fontWeight: "700" },
  headerAccentBar: {
    marginTop: 3,
    width: 36,
    height: 3,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  section: { marginTop: 18 },
  sectionTitle: { color: TXT_DIM, fontSize: 13, marginBottom: 8 },
  card: {
    backgroundColor: CARD,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    justifyContent: "space-between",
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  rowLeft: { flexDirection: "row", alignItems: "center" },
  iconBubble: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "#1f1f1f",
    borderWidth: 1,
    borderColor: ACCENT,
  },
  rowLabel: { color: TXT, fontSize: 15 },
  rowSubtitle: { color: TXT_DIM, fontSize: 12, marginTop: 2 },

  // 🔥 Abmelden-Button
  logoutBtn: {
    backgroundColor: "#ff3b5c",
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

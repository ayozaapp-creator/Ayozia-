// app/profile/settings/notifications.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
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

type LoggedUser = {
  id: string;
  email?: string;
  username?: string;
};

type NotificationKey =
  | "daily"
  | "recommendedMusic"
  | "commentReactions"
  | "mentions"
  | "muteSoundVibration";

type NotificationPref = {
  key: NotificationKey;
  label: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const PREFS: NotificationPref[] = [
  {
    key: "daily",
    label: "Tägliche Benachrichtigung",
    subtitle: "Kurzer Überblick über dein Ayoza-Profil",
    icon: "calendar-outline",
  },
  {
    key: "recommendedMusic",
    label: "Empfohlene Musik",
    subtitle: "Neue Songs & Künstler passend zu deinem Geschmack",
    icon: "musical-notes-outline",
  },
  {
    key: "commentReactions",
    label: "Reaktionen auf Kommentare Musik/Snippet/Bilder",
    subtitle: "Likes & Antworten auf deine Kommentare",
    icon: "chatbubbles-outline",
  },
  {
    key: "mentions",
    label: "Erwähnungen",
    subtitle: "@Erwähnungen in Storys, Snippets und Nachrichten",
    icon: "at-outline",
  },
  {
    key: "muteSoundVibration",
    label: "Ton und Vibration deaktivieren",
    subtitle: "Nur stille Benachrichtigungen von Ayoza",
    icon: "volume-mute-outline",
  },
];

const DEFAULT_STATE: Record<NotificationKey, boolean> = {
  daily: true,
  recommendedMusic: true,
  commentReactions: true,
  mentions: true,
  muteSoundVibration: false,
};

const NotificationsSettingsScreen: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] =
    useState<Record<NotificationKey, boolean>>(DEFAULT_STATE);

  const getStorageKey = (userId: string) =>
    `ayoza:notifications:${userId}`;

  // User + gespeicherte Einstellungen laden
  useEffect(() => {
    (async () => {
      try {
        const rawUser = await AsyncStorage.getItem("user");
        if (!rawUser) {
          Alert.alert("Nicht eingeloggt", "Bitte zuerst einloggen.");
          router.replace("/login");
          return;
        }

        const u: LoggedUser = JSON.parse(rawUser);
        setUser(u);

        const stored = await AsyncStorage.getItem(
          getStorageKey(u.id)
        );
        if (stored) {
          const parsed = JSON.parse(stored);
          setState({
            ...DEFAULT_STATE,
            ...parsed,
          });
        } else {
          setState(DEFAULT_STATE);
        }
      } catch (err: any) {
        console.log("notification prefs load error", err?.message ?? err);
        Alert.alert(
          "Fehler",
          "Benachrichtigungseinstellungen konnten nicht geladen werden."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const saveState = async (
    next: Record<NotificationKey, boolean>
  ) => {
    if (!user) return;
    try {
      setSaving(true);
      await AsyncStorage.setItem(
        getStorageKey(user.id),
        JSON.stringify(next)
      );
    } catch (err: any) {
      console.log("notification prefs save error", err?.message ?? err);
      Alert.alert(
        "Fehler",
        "Einstellungen konnten nicht gespeichert werden."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: NotificationKey) => {
    const next = {
      ...state,
      [key]: !state[key],
    };

    // Spezielle Logik: wenn Ton/Vibration deaktiviert,
    // ist das nur ein Flag – andere bleiben an.
    setState(next);
    saveState(next);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header im YouTube-Style */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back-outline" size={24} color={TXT} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Benachrichtigungen</Text>
          <View style={styles.headerAccentBar} />
        </View>

        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="small" color={ACCENT} />
        </View>
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
        >
          <View style={styles.card}>
            {PREFS.map((p, index) => {
              const isLast = index === PREFS.length - 1;
              const value = state[p.key];

              return (
                <View
                  key={p.key}
                  style={[styles.row, !isLast && styles.rowBorder]}
                >
                  <View style={styles.rowLeft}>
                    <View style={styles.iconBubble}>
                      <Ionicons
                        name={p.icon}
                        size={20}
                        color={TXT}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel}>{p.label}</Text>
                      {p.subtitle ? (
                        <Text style={styles.rowSubtitle}>
                          {p.subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <Switch
                    value={value}
                    onValueChange={() => toggle(p.key)}
                    thumbColor={value ? "#ffffff" : "#888"}
                    trackColor={{
                      false: "#444",
                      true: ACCENT,
                    }}
                  />
                </View>
              );
            })}
          </View>

          {saving && (
            <View style={styles.savingRow}>
              <ActivityIndicator size="small" color={ACCENT} />
              <Text style={styles.savingText}>Speichere…</Text>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default NotificationsSettingsScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: ACCENT,
    fontSize: 18,
    fontWeight: "700",
  },
  headerAccentBar: {
    marginTop: 3,
    width: 40,
    height: 3,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
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
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },
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
  rowLabel: {
    color: TXT,
    fontSize: 15,
  },
  rowSubtitle: {
    color: TXT_DIM,
    fontSize: 12,
    marginTop: 2,
  },
  savingRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  savingText: {
    marginLeft: 8,
    color: TXT_DIM,
    fontSize: 12,
  },
});

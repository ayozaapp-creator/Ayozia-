// app/profile/settings/privacy.tsx
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

type PrivacyKey =
  | "showActivityStatus"
  | "showOnlineInChat"
  | "readReceipts"
  | "personalizedSuggestions"
  | "personalizedAds"
  | "analytics";

type PrivacyPref = {
  key: PrivacyKey;
  label: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type PrivacySection = {
  title: string;
  items: PrivacyPref[];
};

const SECTIONS: PrivacySection[] = [
  {
    title: "Aktivität & Sichtbarkeit",
    items: [
      {
        key: "showActivityStatus",
        label: "Aktivitätsstatus anzeigen",
        subtitle: "Zeige anderen, wann du zuletzt in Ayoza aktiv warst.",
        icon: "time-outline",
      },
      {
        key: "showOnlineInChat",
        label: "Onlinestatus im Chat",
        subtitle: "Grüner Punkt, wenn du gerade im Messenger aktiv bist.",
        icon: "chatbubbles-outline",
      },
      {
        key: "readReceipts",
        label: "Lesebestätigungen",
        subtitle: "Zeige, wann du Nachrichten gelesen hast (✓✓).",
        icon: "checkmark-done-outline",
      },
    ],
  },
  {
    title: "Personalisierung",
    items: [
      {
        key: "personalizedSuggestions",
        label: "Profil für Vorschläge nutzen",
        subtitle:
          "Deine Aktivität verwenden, um dir passende Künstler & Songs zu zeigen.",
        icon: "sparkles-outline",
      },
      {
        key: "personalizedAds",
        label: "Personalisierte Werbung",
        subtitle:
          "Werbung kann basierend auf deiner Aktivität in Ayoza angepasst werden.",
        icon: "pricetag-outline",
      },
    ],
  },
  {
    title: "Daten & Analyse",
    items: [
      {
        key: "analytics",
        label: "Nutzungsdaten für Analyse freigeben",
        subtitle:
          "Anonyme Daten helfen uns, Ayoza zu verbessern. Keine privaten Chats.",
        icon: "analytics-outline",
      },
    ],
  },
];

const DEFAULT_STATE: Record<PrivacyKey, boolean> = {
  showActivityStatus: true,
  showOnlineInChat: true,
  readReceipts: true,
  personalizedSuggestions: true,
  personalizedAds: false,
  analytics: true,
};

const PrivacySettingsScreen: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] =
    useState<Record<PrivacyKey, boolean>>(DEFAULT_STATE);

  const getStorageKey = (userId: string) => `ayoza:privacy:${userId}`;

  // User + gespeicherte Datenschutzeinstellungen laden
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

        const stored = await AsyncStorage.getItem(getStorageKey(u.id));
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
        console.log("privacy load error", err?.message ?? err);
        Alert.alert(
          "Fehler",
          "Datenschutzeinstellungen konnten nicht geladen werden."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const saveState = async (next: Record<PrivacyKey, boolean>) => {
    if (!user) return;
    try {
      setSaving(true);
      await AsyncStorage.setItem(
        getStorageKey(user.id),
        JSON.stringify(next)
      );
    } catch (err: any) {
      console.log("privacy save error", err?.message ?? err);
      Alert.alert(
        "Fehler",
        "Einstellungen konnten nicht gespeichert werden."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: PrivacyKey) => {
    const next = {
      ...state,
      [key]: !state[key],
    };
    setState(next);
    saveState(next);
  };

  const handleExportData = () => {
    Alert.alert(
      "Daten herunterladen",
      "Hier kannst du später eine Datei mit deinen Ayoza-Daten exportieren. (Feature folgt.)"
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Konto löschen",
      "Das dauerhafte Löschen des Kontos wird später hier möglich sein. Aktuell nur Platzhalter.",
      [{ text: "OK", style: "default" }]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back-outline" size={24} color={TXT} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Datenschutz</Text>
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
          {/* Info-Box wie bei Insta „Kontrolliere deine Privatsphäre“ */}
          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark-outline" size={20} color={ACCENT} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.infoTitle}>
                Kontrolliere deine Privatsphäre
              </Text>
              <Text style={styles.infoText}>
                Hier legst du fest, was andere über dich sehen können und wie
                wir deine Daten verwenden, um Ayoza zu verbessern.
              </Text>
            </View>
          </View>

          {/* Sektionen mit Switches */}
          {SECTIONS.map((section) => (
            <View key={section.title} style={{ marginBottom: 18 }}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.card}>
                {section.items.map((item, index) => {
                  const isLast = index === section.items.length - 1;
                  const value = state[item.key];

                  return (
                    <View
                      key={item.key}
                      style={[styles.row, !isLast && styles.rowBorder]}
                    >
                      <View style={styles.rowLeft}>
                        <View style={styles.iconBubble}>
                          <Ionicons
                            name={item.icon}
                            size={20}
                            color={TXT}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowLabel}>{item.label}</Text>
                          {item.subtitle ? (
                            <Text style={styles.rowSubtitle}>
                              {item.subtitle}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <Switch
                        value={value}
                        onValueChange={() => toggle(item.key)}
                        thumbColor={value ? "#ffffff" : "#888"}
                        trackColor={{ false: "#444", true: ACCENT }}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Datenaktionen wie bei Insta (Download / Löschen) */}
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.row, styles.rowBorder]}
              activeOpacity={0.8}
              onPress={handleExportData}
            >
              <View style={styles.rowLeft}>
                <View style={styles.iconBubble}>
                  <Ionicons name="download-outline" size={20} color={TXT} />
                </View>
                <View>
                  <Text style={styles.rowLabel}>Deine Daten herunterladen</Text>
                  <Text style={styles.rowSubtitle}>
                    Fordere eine Kopie deiner Ayoza-Daten an.
                  </Text>
                </View>
              </View>

              <Ionicons
                name="chevron-forward-outline"
                size={18}
                color={TXT_DIM}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.8}
              onPress={handleDeleteAccount}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconBubble, { borderColor: "#ff4f4f" }]}>
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color="#ff6b6b"
                  />
                </View>
                <View>
                  <Text style={[styles.rowLabel, { color: "#ff6b6b" }]}>
                    Konto löschen
                  </Text>
                  <Text style={styles.rowSubtitle}>
                    Entferne dein Konto dauerhaft aus Ayoza.
                  </Text>
                </View>
              </View>

              <Ionicons
                name="chevron-forward-outline"
                size={18}
                color={TXT_DIM}
              />
            </TouchableOpacity>
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

export default PrivacySettingsScreen;

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
    width: 60,
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
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    marginBottom: 18,
  },
  infoTitle: {
    color: TXT,
    fontSize: 14,
    fontWeight: "600",
  },
  infoText: {
    color: TXT_DIM,
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: TXT_DIM,
    fontSize: 13,
    marginBottom: 8,
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

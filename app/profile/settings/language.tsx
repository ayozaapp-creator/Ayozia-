// app/profile/settings/language.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
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

type LoggedUser = {
  id: string;
  email?: string;
  username?: string;
};

type LanguageCode = "de" | "en" | "sq" | "fr" | "es" | "tr";

type LanguageItem = {
  code: LanguageCode;
  label: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const LANGUAGES: LanguageItem[] = [
  {
    code: "de",
    label: "Deutsch",
    subtitle: "Empfohlen – Gerätesprache",
    icon: "flag-outline",
  },
  {
    code: "en",
    label: "Englisch",
    subtitle: "International / Default",
    icon: "earth-outline",
  },
  {
    code: "sq",
    label: "Albanisch",
    subtitle: "Shqip",
    icon: "flag-outline",
  },
  {
    code: "fr",
    label: "Französisch",
    subtitle: "Français",
    icon: "flag-outline",
  },
  {
    code: "es",
    label: "Spanisch",
    subtitle: "Español",
    icon: "flag-outline",
  },
  {
    code: "tr",
    label: "Türkisch",
    subtitle: "Türkçe",
    icon: "flag-outline",
  },
];

const DEFAULT_LANG: LanguageCode = "de";

const LanguageSettingsScreen: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<LanguageCode>(DEFAULT_LANG);

  const getStorageKey = (userId: string) => `ayoza:language:${userId}`;

  // User + Sprache laden
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
          const code = stored as LanguageCode;
          setSelected(code);
        } else {
          setSelected(DEFAULT_LANG);
        }
      } catch (err: any) {
        console.log("language load error", err?.message ?? err);
        Alert.alert(
          "Fehler",
          "Sprach­einstellung konnte nicht geladen werden."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const changeLanguage = async (code: LanguageCode) => {
    if (!user) return;
    try {
      setSaving(true);
      setSelected(code);
      await AsyncStorage.setItem(getStorageKey(user.id), code);

      // hier könntest du später i18n triggern
      // z.B. i18n.changeLanguage(code);

    } catch (err: any) {
      console.log("language save error", err?.message ?? err);
      Alert.alert(
        "Fehler",
        "Sprache konnte nicht gespeichert werden."
      );
    } finally {
      setSaving(false);
    }
  };

  const currentLang = LANGUAGES.find((l) => l.code === selected);

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
          <Text style={styles.headerTitle}>Sprachen</Text>
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
          {/* Aktuelle Sprache */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color={ACCENT} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.infoTitle}>Aktive Sprache</Text>
              <Text style={styles.infoText}>
                {currentLang?.label ?? "Deutsch"}{" "}
                <Text style={{ color: TXT_DIM }}>
                  ({currentLang?.code.toUpperCase() ?? "DE"})
                </Text>
              </Text>
              <Text style={styles.infoHint}>
                Diese Einstellung betrifft nur Ayoza. Deine Gerätesprache bleibt
                unverändert.
              </Text>
            </View>
          </View>

          {/* Sprachenliste */}
          <View style={styles.card}>
            {LANGUAGES.map((lang, index) => {
              const isLast = index === LANGUAGES.length - 1;
              const isActive = lang.code === selected;

              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.row, !isLast && styles.rowBorder]}
                  activeOpacity={0.85}
                  onPress={() => changeLanguage(lang.code)}
                >
                  <View style={styles.rowLeft}>
                    <View style={styles.iconBubble}>
                      <Ionicons name={lang.icon} size={20} color={TXT} />
                    </View>
                    <View>
                      <Text style={styles.rowLabel}>{lang.label}</Text>
                      {lang.subtitle ? (
                        <Text style={styles.rowSubtitle}>
                          {lang.subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Radio-Style Indicator */}
                  <View
                    style={[
                      styles.radioOuter,
                      isActive && styles.radioOuterActive,
                    ]}
                  >
                    {isActive && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
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

export default LanguageSettingsScreen;

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
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    marginBottom: 16,
  },
  infoTitle: {
    color: TXT,
    fontSize: 14,
    fontWeight: "600",
  },
  infoText: {
    color: TXT,
    fontSize: 15,
    marginTop: 2,
  },
  infoHint: {
    color: TXT_DIM,
    fontSize: 12,
    marginTop: 4,
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
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: TXT_DIM,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: {
    borderColor: ACCENT,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: ACCENT,
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

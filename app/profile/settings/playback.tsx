// app/profile/settings/wiedergabe.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
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

const STORAGE_KEY = "settings_wiedergabe_v1";

type WiedergabeSettings = {
  autoplayNext: boolean;
  autoplayOnMobile: boolean;
  hqOnWifiOnly: boolean;
  backgroundPlayback: boolean;
};

const defaultSettings: WiedergabeSettings = {
  autoplayNext: true,
  autoplayOnMobile: false,
  hqOnWifiOnly: true,
  backgroundPlayback: true,
};

const WiedergabeSettingsScreen: React.FC = () => {
  const router = useRouter();
  const [settings, setSettings] = useState<WiedergabeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Laden
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: WiedergabeSettings = JSON.parse(raw);
          setSettings({ ...defaultSettings, ...parsed });
        } else {
          setSettings(defaultSettings);
        }
      } catch (e) {
        console.warn("Wiedergabe Settings load error:", e);
        setSettings(defaultSettings);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Speichern
  useEffect(() => {
    if (!settings) return;
    (async () => {
      try {
        setSaving(true);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch (e) {
        console.warn("Wiedergabe Settings save error:", e);
      } finally {
        setSaving(false);
      }
    })();
  }, [settings]);

  const toggle = (key: keyof WiedergabeSettings) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: !settings[key] });
  };

  if (loading || !settings) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back-outline" size={24} color={TXT} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Wiedergabe</Text>
            <View style={styles.headerAccentBar} />
          </View>

          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="small" color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.headerTitle}>Wiedergabe</Text>
          <View style={styles.headerAccentBar} />
        </View>

        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        {/* Info-Box */}
        <View style={styles.infoCard}>
          <Ionicons name="play-circle-outline" size={22} color={ACCENT} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.infoTitle}>Ayoza Wiedergabe</Text>
            <Text style={styles.infoText}>
              Steuere, wie Songs auf deinem Gerät abgespielt werden – ähnlich
              wie bei YouTube / Spotify, aber im Ayoza-Style.
            </Text>
          </View>
        </View>

        {/* Haupt-Settings */}
        <View style={styles.card}>
          {/* Autoplay nächster Track */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowLeft}>
              <View style={styles.iconBubbleSmall}>
                <Ionicons
                  name="play-skip-forward-outline"
                  size={18}
                  color={TXT}
                />
              </View>
              <View>
                <Text style={styles.rowLabel}>Nächster Track automatisch</Text>
                <Text style={styles.rowSubtitle}>
                  Spiele automatisch den nächsten Song in der Liste ab.
                </Text>
              </View>
            </View>
            <Switch
              value={settings.autoplayNext}
              onValueChange={() => toggle("autoplayNext")}
              trackColor={{ false: "#555", true: ACCENT }}
              thumbColor="#ffffff"
            />
          </View>

          {/* Autoplay über mobile Daten */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowLeft}>
              <View style={styles.iconBubbleSmall}>
                <Ionicons name="cellular-outline" size={18} color={TXT} />
              </View>
              <View>
                <Text style={styles.rowLabel}>Autoplay über mobile Daten</Text>
                <Text style={styles.rowSubtitle}>
                  Erlaube Autoplay auch, wenn du nicht im WLAN bist.
                </Text>
              </View>
            </View>
            <Switch
              value={settings.autoplayOnMobile}
              onValueChange={() => toggle("autoplayOnMobile")}
              trackColor={{ false: "#555", true: ACCENT }}
              thumbColor="#ffffff"
            />
          </View>

          {/* HQ nur im WLAN */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowLeft}>
              <View style={styles.iconBubbleSmall}>
                <Ionicons name="wifi-outline" size={18} color={TXT} />
              </View>
              <View>
                <Text style={styles.rowLabel}>Hohe Qualität nur im WLAN</Text>
                <Text style={styles.rowSubtitle}>
                  Höchste Klangqualität wird nur im WLAN genutzt.
                </Text>
              </View>
            </View>
            <Switch
              value={settings.hqOnWifiOnly}
              onValueChange={() => toggle("hqOnWifiOnly")}
              trackColor={{ false: "#555", true: ACCENT }}
              thumbColor="#ffffff"
            />
          </View>

          {/* Hintergrundwiedergabe */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={styles.iconBubbleSmall}>
                <Ionicons
                  name="phone-portrait-outline"
                  size={18}
                  color={TXT}
                />
              </View>
              <View>
                <Text style={styles.rowLabel}>Wiedergabe im Hintergrund</Text>
                <Text style={styles.rowSubtitle}>
                  Musik weiterlaufen lassen, wenn du Ayoza minimierst.
                </Text>
              </View>
            </View>
            <Switch
              value={settings.backgroundPlayback}
              onValueChange={() => toggle("backgroundPlayback")}
              trackColor={{ false: "#555", true: ACCENT }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {saving && (
          <View style={styles.savingBadge}>
            <ActivityIndicator size="small" color={ACCENT} />
            <Text style={styles.savingText}>
              Änderungen werden gespeichert …
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default WiedergabeSettingsScreen;

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
    width: 80,
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
  rowLabel: {
    color: TXT,
    fontSize: 14,
  },
  rowSubtitle: {
    color: TXT_DIM,
    fontSize: 11,
    marginTop: 2,
  },
  iconBubbleSmall: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: "#1f1f1f",
    borderWidth: 1,
    borderColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  savingBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  savingText: {
    marginLeft: 8,
    color: TXT_DIM,
    fontSize: 11,
  },
});

// app/profile/settings/offline.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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

export default function OfflineSettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // LOCAL STATES
  const [offlineMode, setOfflineMode] = useState(false);
  const [autoDownload, setAutoDownload] = useState(false);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [maxStorage, setMaxStorage] = useState(2); // in GB (Demo)

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("ayoza_offline_settings");
        if (stored) {
          const s = JSON.parse(stored);
          setOfflineMode(!!s.offlineMode);
          setAutoDownload(!!s.autoDownload);
          setWifiOnly(!!s.wifiOnly);
          setMaxStorage(s.maxStorage ?? 2);
        }
      } catch (e) {
        console.log("Offline settings load error:", e);
      }
      setLoading(false);
    })();
  }, []);

  const save = async (data: any) => {
    try {
      await AsyncStorage.setItem(
        "ayoza_offline_settings",
        JSON.stringify({
          offlineMode,
          autoDownload,
          wifiOnly,
          maxStorage,
          ...data,
        })
      );
    } catch (e) {
      console.log("Offline settings save error:", e);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back-outline" size={24} color={TXT} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Offline-Einstellungen</Text>
          <View style={styles.headerAccentBar} />
        </View>

        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          
          {/* Info Box */}
          <View style={styles.infoCard}>
            <Ionicons name="cloud-offline-outline" size={22} color={ACCENT} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.infoTitle}>Offline-Funktionen</Text>
              <Text style={styles.infoText}>
                Speichere Songs & Snippets offline, um sie überall ohne Internet
                abzuspielen – perfekt wie Spotify Offline Mode.
              </Text>
            </View>
          </View>

          {/* Hauptschalter */}
          <View style={styles.card}>
            <View style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowLeft}>
                <Ionicons name="cloud-offline-outline" size={20} color={TXT} style={{ marginRight: 12 }} />
                <Text style={styles.rowLabel}>Offline-Modus</Text>
              </View>
              <Switch
                value={offlineMode}
                onValueChange={(v) => {
                  setOfflineMode(v);
                  save({ offlineMode: v });
                }}
                thumbColor={offlineMode ? ACCENT : "#555"}
                trackColor={{ true: "#ff4fd877", false: "#222" }}
              />
            </View>

            <View style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowLeft}>
                <Ionicons name="download-outline" size={20} color={TXT} style={{ marginRight: 12 }} />
                <Text style={styles.rowLabel}>Automatische Downloads</Text>
              </View>
              <Switch
                value={autoDownload}
                onValueChange={(v) => {
                  setAutoDownload(v);
                  save({ autoDownload: v });
                }}
                thumbColor={autoDownload ? ACCENT : "#555"}
                trackColor={{ true: "#ff4fd877", false: "#222" }}
              />
            </View>

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="wifi-outline" size={20} color={TXT} style={{ marginRight: 12 }} />
                <Text style={styles.rowLabel}>Nur über WLAN downloaden</Text>
              </View>
              <Switch
                value={wifiOnly}
                onValueChange={(v) => {
                  setWifiOnly(v);
                  save({ wifiOnly: v });
                }}
                thumbColor={wifiOnly ? ACCENT : "#555"}
                trackColor={{ true: "#ff4fd877", false: "#222" }}
              />
            </View>
          </View>

          {/* Offline Speicher */}
          <Text style={styles.sectionTitle}>Speicherplatz</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="folder-outline" size={20} color={TXT} style={{ marginRight: 12 }} />
                <View>
                  <Text style={styles.rowLabel}>Verfügbarer Speicher</Text>
                  <Text style={styles.rowSubtitle}>Maximalgröße der Offline-Daten</Text>
                </View>
              </View>

              <Text style={styles.rowValue}>{maxStorage} GB</Text>
            </View>
          </View>

          {/* Hint */}
          <View style={styles.footerHint}>
            <Ionicons name="information-circle-outline" size={16} color={TXT_DIM} />
            <Text style={styles.footerHintText}>
              Bald werden echte Daten angezeigt: tatsächlicher Speicherverbrauch, offline gespeicherte Songs, Snippets & Cache.
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
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
    width: 80,
    height: 3,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { flex: 1 },
  content: { padding: 16 },
  infoCard: {
    flexDirection: "row",
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    marginBottom: 18,
  },
  infoTitle: { color: TXT, fontSize: 14, fontWeight: "600" },
  infoText: { color: TXT_DIM, fontSize: 12, marginTop: 4 },
  sectionTitle: { color: TXT_DIM, fontSize: 13, marginBottom: 8, marginTop: 18 },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  rowLabel: { color: TXT, fontSize: 14 },
  rowSubtitle: { color: TXT_DIM, fontSize: 11, marginTop: 2 },
  rowValue: { color: TXT, fontSize: 16, fontWeight: "600" },
  footerHint: { flexDirection: "row", marginTop: 16 },
  footerHintText: { color: TXT_DIM, fontSize: 11, marginLeft: 6, flex: 1 },
});

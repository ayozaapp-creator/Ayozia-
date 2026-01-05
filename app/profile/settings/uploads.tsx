// app/profile/settings/uploads.tsx
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

export default function UploadSettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // LOCAL STATES (Remix entfernt)
  const [allowComments, setAllowComments] = useState(true);
  const [lyricsAuto, setLyricsAuto] = useState(true);
  const [defaultVisibility, setDefaultVisibility] = useState("public");
  const [hqUploads, setHqUploads] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("ayoza_upload_settings");
        if (raw) {
          const s = JSON.parse(raw);
          setAllowComments(s.allowComments ?? true);
          setLyricsAuto(s.lyricsAuto ?? true);
          setDefaultVisibility(s.defaultVisibility ?? "public");
          setHqUploads(s.hqUploads ?? true);
        }
      } catch (err) {
        console.log("UploadSettings load error:", err);
      }
      setLoading(false);
    })();
  }, []);

  const save = async (obj: any) => {
    try {
      await AsyncStorage.setItem(
        "ayoza_upload_settings",
        JSON.stringify({
          allowComments,
          lyricsAuto,
          defaultVisibility,
          hqUploads,
          ...obj,
        })
      );
    } catch (e) {
      console.log("UploadSettings save error:", e);
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
          <Text style={styles.headerTitle}>Uploads</Text>
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
            <Ionicons name="cloud-upload-outline" size={22} color={ACCENT} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.infoTitle}>Upload-Standards</Text>
              <Text style={styles.infoText}>
                Lege ein, wie neue Tracks standardmäßig hochgeladen werden sollen.
              </Text>
            </View>
          </View>

          {/* Sichtbarkeit */}
          <Text style={styles.sectionTitle}>Sichtbarkeit</Text>
          <View style={styles.card}>
            {["public", "unlisted", "private"].map((mode, index) => {
              const labels: Record<string, string> = {
                public: "Öffentlich",
                unlisted: "Nicht gelistet",
                private: "Privat",
              };

              return (
                <View key={mode} style={[styles.row, index < 2 && styles.rowBorder]}>
                  <Text style={styles.rowLabel}>{labels[mode]}</Text>

                  <TouchableOpacity
                    onPress={() => {
                      setDefaultVisibility(mode);
                      save({ defaultVisibility: mode });
                    }}
                  >
                    <Ionicons
                      name={
                        defaultVisibility === mode
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={22}
                      color={defaultVisibility === mode ? ACCENT : TXT_DIM}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* Switches */}
          <Text style={styles.sectionTitle}>Upload-Funktionen</Text>
          <View style={styles.card}>

            {/* Kommentare */}
            <View style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowLeft}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={20}
                  color={TXT}
                  style={{ marginRight: 12 }}
                />
                <Text style={styles.rowLabel}>Kommentare erlauben</Text>
              </View>

              <Switch
                value={allowComments}
                onValueChange={(v) => {
                  setAllowComments(v);
                  save({ allowComments: v });
                }}
                thumbColor={allowComments ? ACCENT : "#555"}
                trackColor={{ true: "#ff4fd877", false: "#222" }}
              />
            </View>

            {/* Auto-Lyrics */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons
                  name="musical-notes-outline"
                  size={20}
                  color={TXT}
                  style={{ marginRight: 12 }}
                />
                <View>
                  <Text style={styles.rowLabel}>Auto-Lyrics generieren</Text>
                  <Text style={styles.rowSubtitle}>Analyse beim Upload aktivieren</Text>
                </View>
              </View>

              <Switch
                value={lyricsAuto}
                onValueChange={(v) => {
                  setLyricsAuto(v);
                  save({ lyricsAuto: v });
                }}
                thumbColor={lyricsAuto ? ACCENT : "#555"}
                trackColor={{ true: "#ff4fd877", false: "#222" }}
              />
            </View>
          </View>

          {/* Upload Qualität */}
          <Text style={styles.sectionTitle}>Upload-Qualität</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons
                  name="speedometer-outline"
                  size={20}
                  color={TXT}
                  style={{ marginRight: 12 }}
                />
                <Text style={styles.rowLabel}>Hohe Qualität bevorzugen</Text>
              </View>

              <Switch
                value={hqUploads}
                onValueChange={(v) => {
                  setHqUploads(v);
                  save({ hqUploads: v });
                }}
                thumbColor={hqUploads ? ACCENT : "#555"}
                trackColor={{ true: "#ff4fd877", false: "#222" }}
              />
            </View>
          </View>

          {/* Hinweis */}
          <View style={styles.footerHint}>
            <Ionicons name="information-circle-outline" size={16} color={TXT_DIM} />
            <Text style={styles.footerHintText}>
              Diese Einstellungen gelten für alle neuen Uploads.  
              Später werden sie automatisch mit deinem Server synchronisiert.
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
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
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
  sectionTitle: {
    color: TXT_DIM,
    fontSize: 13,
    marginBottom: 8,
    marginTop: 16,
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
  footerHint: { flexDirection: "row", marginTop: 16 },
  footerHintText: { color: TXT_DIM, fontSize: 11, marginLeft: 6, flex: 1 },
});

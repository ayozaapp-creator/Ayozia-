// app/profile/settings/my-data.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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

const API = "http://192.168.0.224:5000";

const http = axios.create({ baseURL: API, timeout: 15000 });

type LoggedUser = {
  id: string;
  email?: string;
  username?: string;
};

type Metric = {
  label: string;
  value: number;
  unit?: string;
  diff?: number; // % vs. vorherige Periode (später)
  icon: keyof typeof Ionicons.glyphMap;
};

type InsightsResponse = {
  userId: string;
  username: string;
  tracks: {
    count: number;
    plays: number;
    likes: number;
    saves: number;
  };
  social: {
    followers: number;
    following: number;
  };
  profile: {
    views: number;
  };
  messages: {
    sent: number;
    received: number;
  };
};

const MyDataSettingsScreen: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [metrics28, setMetrics28] = useState<Metric[]>([]);
  const [metrics7, setMetrics7] = useState<Metric[]>([]);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // 👤 User aus AsyncStorage holen
        const rawUser = await AsyncStorage.getItem("user");
        if (!rawUser) {
          setLoading(false);
          setError("Kein eingeloggter User gefunden.");
          return;
        }

        const u: LoggedUser = JSON.parse(rawUser);
        if (!u?.id) {
          setLoading(false);
          setError("Benutzer-ID fehlt.");
          return;
        }

        setUser(u);

        // 📊 Live-Insights vom Server holen
        const res = await http.get<InsightsResponse>(`/users/${u.id}/insights`);
        const data = res.data;
        setInsights(data);

        const totalMessages = (data.messages?.sent || 0) + (data.messages?.received || 0);

        // 🔥 "Letzte 28 Tage" – aktuell: Gesamt-Stats deines Accounts
        const m28: Metric[] = [
          {
            label: "Zuhörer / Plays",
            value: data.tracks?.plays ?? 0,
            unit: "",
            icon: "headset-outline",
          },
          {
            label: "Profilaufrufe",
            value: data.profile?.views ?? 0,
            unit: "",
            icon: "person-circle-outline",
          },
          {
            label: "Tracks gesamt",
            value: data.tracks?.count ?? 0,
            unit: "",
            icon: "musical-notes-outline",
          },
          {
            label: "Follower",
            value: data.social?.followers ?? 0,
            unit: "",
            icon: "people-outline",
          },
        ];

        // "Letzte 7 Tage" – aktuell noch ohne Zeitfilter → wir zeigen
        // eine kompakte Übersicht deiner wichtigsten KPIs (gesamt),
        // 7-Tage-Filter können wir später extra auf dem Server bauen.
        const m7: Metric[] = [
          {
            label: "Zuhörer / Plays",
            value: data.tracks?.plays ?? 0,
            unit: "gesamt",
            icon: "headset-outline",
          },
          {
            label: "Profilaufrufe",
            value: data.profile?.views ?? 0,
            unit: "gesamt",
            icon: "person-circle-outline",
          },
          {
            label: "Nachrichten-Aktivität",
            value: totalMessages,
            unit: "gesendet & empfangen",
            icon: "chatbubble-ellipses-outline",
          },
        ];

        setMetrics28(m28);
        setMetrics7(m7);
      } catch (e: any) {
        console.warn("MyData /insights error:", e?.message || e);
        setError("Konnte deine Ayoza-Statistiken gerade nicht laden.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatDiff = (diff?: number) => {
    if (diff == null) return "";
    const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
    return `${sign}${Math.abs(diff)}%`;
  };

  const diffColor = (diff?: number) => {
    if (diff == null) return TXT_DIM;
    if (diff > 0) return "#7CFC8A";
    if (diff < 0) return "#ff6b6b";
    return TXT_DIM;
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
          <Text style={styles.headerTitle}>Meine Daten auf Ayoza</Text>
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
          {/* Fehlermeldung (falls API down o.ä.) */}
          {error && (
            <View style={[styles.card, { padding: 12, marginBottom: 14 }]}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons
                  name="warning-outline"
                  size={18}
                  color="#ff6b6b"
                />
                <Text
                  style={{
                    marginLeft: 8,
                    color: TXT_DIM,
                    fontSize: 12,
                    flex: 1,
                  }}
                >
                  {error}
                </Text>
              </View>
            </View>
          )}

          {/* Intro / Info – Insta Insights-Feeling */}
          <View style={styles.infoCard}>
            <Ionicons name="stats-chart-outline" size={22} color={ACCENT} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.infoTitle}>Account-Insights</Text>
              <Text style={styles.infoText}>
                Sieh dir an, wie viele{" "}
                <Text style={{ fontWeight: "600", color: TXT }}>
                  Zuhörer / Plays, Profilaufrufe und Follower
                </Text>{" "}
                dein Ayoza-Account aktuell hat – angelehnt an die
                Insights von Instagram & TikTok.
              </Text>
              {user?.username && (
                <Text style={styles.infoUser}>
                  Account:&nbsp;
                  <Text style={styles.infoUserName}>{user.username}</Text>
                </Text>
              )}
            </View>
          </View>

          {/* Letzte 28 Tage – große Übersicht (aktuell Gesamtwerte) */}
          <Text style={styles.sectionTitle}>Übersicht (gesamt)</Text>
          <View style={styles.metricsGrid}>
            {metrics28.map((m) => (
              <View key={m.label} style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <View style={styles.iconBubble}>
                    <Ionicons name={m.icon} size={18} color={TXT} />
                  </View>
                  {m.diff != null && (
                    <Text
                      style={[
                        styles.metricDiff,
                        { color: diffColor(m.diff) },
                      ]}
                    >
                      {formatDiff(m.diff)}
                    </Text>
                  )}
                </View>
                <Text style={styles.metricValue}>
                  {m.value.toLocaleString("de-DE")}
                </Text>
                <Text style={styles.metricLabel}>{m.label}</Text>
              </View>
            ))}
          </View>

          {/* Letzte 7 Tage – aktuell kompakte Account-Übersicht */}
          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
            Aktivität (kompakt)
          </Text>
          <View style={styles.card}>
            {metrics7.map((m, idx) => {
              const isLast = idx === metrics7.length - 1;
              return (
                <View
                  key={m.label}
                  style={[
                    styles.row,
                    !isLast && styles.rowBorder,
                  ]}
                >
                  <View style={styles.rowLeft}>
                    <View style={styles.iconBubbleSmall}>
                      <Ionicons name={m.icon} size={18} color={TXT} />
                    </View>
                    <View>
                      <Text style={styles.rowLabel}>{m.label}</Text>
                      <Text style={styles.rowSubtitle}>
                        {m.unit || "Gesamtaktivität deines Accounts"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rowRight}>
                    <Text style={styles.rowValue}>
                      {m.value.toLocaleString("de-DE")}
                    </Text>
                    {m.diff != null && (
                      <Text
                        style={[
                          styles.rowDiff,
                          { color: diffColor(m.diff) },
                        ]}
                      >
                        {formatDiff(m.diff)}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Reichweite & Top-Bereiche – leicht angepasst an deine echten Daten */}
          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
            Reichweite & Interaktion
          </Text>
          <View style={styles.card}>
            <View style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowLeft}>
                <View style={styles.iconBubbleSmall}>
                  <Ionicons name="people-outline" size={18} color={TXT} />
                </View>
                <View>
                  <Text style={styles.rowLabel}>Follower & Following</Text>
                  <Text style={styles.rowSubtitle}>
                    Follower:{" "}
                    {insights
                      ? insights.social.followers.toLocaleString("de-DE")
                      : "0"}
                    {"   "}•   Folgt:{" "}
                    {insights
                      ? insights.social.following.toLocaleString("de-DE")
                      : "0"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowLeft}>
                <View style={styles.iconBubbleSmall}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={TXT} />
                </View>
                <View>
                  <Text style={styles.rowLabel}>Nachrichten-Aktivität</Text>
                  <Text style={styles.rowSubtitle}>
                    Gesendet & empfangen insgesamt – wie aktiv du im Messenger bist.
                  </Text>
                </View>
              </View>

              <Text style={styles.rowValueHighlight}>
                {insights
                  ? (
                      insights.messages.sent + insights.messages.received
                    ).toLocaleString("de-DE")
                  : "0"}
              </Text>
            </View>

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.iconBubbleSmall}>
                  <Ionicons name="musical-notes-outline" size={18} color={TXT} />
                </View>
                <View>
                  <Text style={styles.rowLabel}>Tracks & Interaktion</Text>
                  <Text style={styles.rowSubtitle}>
                    {insights
                      ? `${insights.tracks.count} Tracks • ${insights.tracks.plays.toLocaleString(
                          "de-DE"
                        )} Plays • ${insights.tracks.likes.toLocaleString(
                          "de-DE"
                        )} Likes`
                      : "Keine Daten verfügbar"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Hinweis, dass Zahlen live sind & Zeiträume später feiner werden können */}
          <View style={styles.footerHint}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={TXT_DIM}
            />
            <Text style={styles.footerHintText}>
              Diese Werte kommen bereits{" "}
              <Text style={{ color: TXT, fontWeight: "600" }}>live</Text> von
              deinem Ayoza-Server (Endpoint{" "}
              <Text style={{ fontFamily: "monospace" }}>
                /users/:id/insights
              </Text>
              ). Später können wir hier noch echte 7-Tage / 28-Tage-Filter
              und Top-Tracks / Top-Länder einbauen – wie bei Insta & TikTok.
            </Text>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default MyDataSettingsScreen;

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
  infoUser: {
    color: TXT_DIM,
    fontSize: 12,
    marginTop: 6,
  },
  infoUserName: {
    color: TXT,
    fontWeight: "600",
  },
  sectionTitle: {
    color: TXT_DIM,
    fontSize: 13,
    marginBottom: 8,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  metricCard: {
    width: "50%",
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  metricHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricValue: {
    color: TXT,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 6,
  },
  metricLabel: {
    color: TXT_DIM,
    fontSize: 11,
    marginTop: 2,
  },
  metricDiff: {
    fontSize: 11,
    fontWeight: "600",
  },
  iconBubble: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#1f1f1f",
    borderWidth: 1,
    borderColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
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
  rowRight: {
    alignItems: "flex-end",
  },
  rowValue: {
    color: TXT,
    fontSize: 15,
    fontWeight: "600",
  },
  rowValueHighlight: {
    color: TXT,
    fontSize: 18,
    fontWeight: "700",
  },
  rowDiff: {
    fontSize: 11,
    marginTop: 2,
  },
  footerHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 16,
  },
  footerHintText: {
    marginLeft: 6,
    color: TXT_DIM,
    fontSize: 11,
    flex: 1,
  },
});

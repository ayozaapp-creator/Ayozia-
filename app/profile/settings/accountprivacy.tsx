// app/profile/settings/account-privacy.tsx
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

export default function AccountPrivacyScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [privateAccount, setPrivateAccount] = useState(false);
  const [mentions, setMentions] = useState("everyone"); // everyone / followers / nobody
  const [comments, setComments] = useState("everyone");
  const [tagsAllowed, setTagsAllowed] = useState("everyone");
  const [allowMessages, setAllowMessages] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("ayoza_account_privacy");
        if (raw) {
          const s = JSON.parse(raw);
          setPrivateAccount(s.privateAccount ?? false);
          setMentions(s.mentions ?? "everyone");
          setComments(s.comments ?? "everyone");
          setTagsAllowed(s.tagsAllowed ?? "everyone");
          setAllowMessages(s.allowMessages ?? true);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const save = async (obj: any) => {
    await AsyncStorage.setItem(
      "ayoza_account_privacy",
      JSON.stringify({
        privateAccount,
        mentions,
        comments,
        tagsAllowed,
        allowMessages,
        ...obj,
      })
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back-outline" size={24} color={TXT} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Account-Privatsphäre</Text>
          <View style={styles.headerAccentBar} />
        </View>

        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          
          {/* INFO */}
          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark-outline" size={22} color={ACCENT} />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.infoTitle}>Kontosicherheit</Text>
              <Text style={styles.infoText}>
                Bestimme, wer dich finden, markieren und kontaktieren kann.
              </Text>
            </View>
          </View>

          {/* PRIVATE ACCOUNT */}
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowLeft}>
                <Ionicons name="lock-closed-outline" size={20} color={TXT} style={{ marginRight: 12 }} />
                <Text style={styles.rowLabel}>Privater Account</Text>
              </View>

              <Switch
                value={privateAccount}
                onValueChange={(v) => {
                  setPrivateAccount(v);
                  save({ privateAccount: v });
                }}
                thumbColor={privateAccount ? ACCENT : "#555"}
                trackColor={{ true: "#ff4fd877", false: "#222" }}
              />
            </View>
          </View>

          {/* MENTIONS */}
          <Text style={styles.sectionTitle}>Erwähnungen</Text>
          <View style={styles.card}>
            {["everyone", "followers", "nobody"].map((m, i) => {
              const label =
                m === "everyone"
                  ? "Jeder"
                  : m === "followers"
                  ? "Follower"
                  : "Niemand";

              return (
                <View key={m} style={[styles.row, i < 2 && styles.rowBorder]}>
                  <Text style={styles.rowLabel}>{label}</Text>

                  <TouchableOpacity
                    onPress={() => {
                      setMentions(m);
                      save({ mentions: m });
                    }}
                  >
                    <Ionicons
                      name={mentions === m ? "radio-button-on" : "radio-button-off"}
                      size={22}
                      color={mentions === m ? ACCENT : TXT_DIM}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* TAGGING */}
          <Text style={styles.sectionTitle}>Markierungen</Text>
          <View style={styles.card}>
            {["everyone", "followers", "nobody"].map((m, i) => {
              const label =
                m === "everyone"
                  ? "Jeder"
                  : m === "followers"
                  ? "Follower"
                  : "Niemand";

              return (
                <View key={m} style={[styles.row, i < 2 && styles.rowBorder]}>
                  <Text style={styles.rowLabel}>{label}</Text>

                  <TouchableOpacity
                    onPress={() => {
                      setTagsAllowed(m);
                      save({ tagsAllowed: m });
                    }}
                  >
                    <Ionicons
                      name={tagsAllowed === m ? "radio-button-on" : "radio-button-off"}
                      size={22}
                      color={tagsAllowed === m ? ACCENT : TXT_DIM}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* COMMENTS */}
          <Text style={styles.sectionTitle}>Kommentare</Text>
          <View style={styles.card}>
            {["everyone", "followers", "nobody"].map((m, i) => {
              const label =
                m === "everyone"
                  ? "Jeder"
                  : m === "followers"
                  ? "Follower"
                  : "Niemand";

              return (
                <View key={m} style={[styles.row, i < 2 && styles.rowBorder]}>
                  <Text style={styles.rowLabel}>{label}</Text>

                  <TouchableOpacity
                    onPress={() => {
                      setComments(m);
                      save({ comments: m });
                    }}
                  >
                    <Ionicons
                      name={comments === m ? "radio-button-on" : "radio-button-off"}
                      size={22}
                      color={comments === m ? ACCENT : TXT_DIM}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* MESSAGES */}
          <Text style={styles.sectionTitle}>Nachrichten</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="chatbubbles-outline" size={20} color={TXT} style={{ marginRight: 12 }} />
                <Text style={styles.rowLabel}>Nachrichten erlauben</Text>
              </View>

              <Switch
                value={allowMessages}
                onValueChange={(v) => {
                  setAllowMessages(v);
                  save({ allowMessages: v });
                }}
                thumbColor={allowMessages ? ACCENT : "#555"}
                trackColor={{ true: "#ff4fd877", false: "#222" }}
              />
            </View>
          </View>

          {/* FOOTER */}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ================= STYLES ================= */
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
  content: { padding: 16 },
  infoCard: {
    flexDirection: "row",
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  infoTitle: { color: TXT, fontSize: 14, fontWeight: "600" },
  infoText: { color: TXT_DIM, fontSize: 12 },
  sectionTitle: { color: TXT_DIM, fontSize: 13, marginVertical: 10 },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    overflow: "hidden",
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  rowLabel: { color: TXT, fontSize: 14 },
});

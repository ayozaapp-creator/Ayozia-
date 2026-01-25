// app/profile/settings/accountprivacy.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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

type PrivacyChoice = "everyone" | "followers" | "nobody";

type PrivacyState = {
  privateAccount: boolean;
  mentions: PrivacyChoice;
  comments: PrivacyChoice;
  tagsAllowed: PrivacyChoice;
  allowMessages: boolean;
};

const DEFAULT_STATE: PrivacyState = {
  privateAccount: false,
  mentions: "everyone",
  comments: "everyone",
  tagsAllowed: "everyone",
  allowMessages: true,
};

const API = process.env.EXPO_PUBLIC_API_URL || "http://192.168.0.224:5000";

/**
 * Versucht den aktuell eingeloggten User aus AsyncStorage zu finden.
 * Supportet mehrere Keys, damit es in deinem Projekt sicher greift.
 */
async function getCurrentUserFromStorage(): Promise<any | null> {
  const possibleKeys = [
    "user",
    "@user",
    "ayo_user",
    "auth_user",
    "ayoza_user",
    "ayozia_user",
    "currentUser",
    "profile_user",
  ];

  for (const k of possibleKeys) {
    try {
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);

      // Manche speichern { user: {...} }
      const maybeUser = parsed?.user?.id ? parsed.user : parsed;
      if (maybeUser && typeof maybeUser === "object") return maybeUser;
    } catch {
      // ignore
    }
  }

  return null;
}

function extractUserId(user: any): string | null {
  if (!user || typeof user !== "object") return null;

  const candidates = [user.id, user._id, user.userId, user.uid, user.uuid];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
    if (typeof c === "number") return String(c);
  }

  return null;
}

function normalizeChoice(v: any, fallback: PrivacyChoice): PrivacyChoice {
  return v === "everyone" || v === "followers" || v === "nobody" ? v : fallback;
}

function normalizeState(input: any): PrivacyState {
  const s = input && typeof input === "object" ? input : {};
  return {
    privateAccount:
      typeof s.privateAccount === "boolean"
        ? s.privateAccount
        : DEFAULT_STATE.privateAccount,
    mentions: normalizeChoice(s.mentions, DEFAULT_STATE.mentions),
    comments: normalizeChoice(s.comments, DEFAULT_STATE.comments),
    tagsAllowed: normalizeChoice(s.tagsAllowed, DEFAULT_STATE.tagsAllowed),
    allowMessages:
      typeof s.allowMessages === "boolean"
        ? s.allowMessages
        : DEFAULT_STATE.allowMessages,
  };
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function AccountPrivacyScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string>("");

  // UI-State
  const [privateAccount, setPrivateAccount] = useState(DEFAULT_STATE.privateAccount);
  const [mentions, setMentions] = useState<PrivacyChoice>(DEFAULT_STATE.mentions);
  const [comments, setComments] = useState<PrivacyChoice>(DEFAULT_STATE.comments);
  const [tagsAllowed, setTagsAllowed] = useState<PrivacyChoice>(DEFAULT_STATE.tagsAllowed);
  const [allowMessages, setAllowMessages] = useState(DEFAULT_STATE.allowMessages);

  const aliveRef = useRef(true);

  const storageKey = useMemo(
    () => (userId ? `ayoza_account_privacy:${userId}` : "ayoza_account_privacy:guest"),
    [userId]
  );

  const applyState = (s: PrivacyState) => {
    setPrivateAccount(s.privateAccount);
    setMentions(s.mentions);
    setComments(s.comments);
    setTagsAllowed(s.tagsAllowed);
    setAllowMessages(s.allowMessages);
  };

  const loadFromCache = async (uid: string) => {
    try {
      const raw = await AsyncStorage.getItem(`ayoza_account_privacy:${uid}`);
      if (!raw) return null;
      return normalizeState(JSON.parse(raw));
    } catch {
      return null;
    }
  };

  const saveToCache = async (uid: string, state: PrivacyState) => {
    try {
      await AsyncStorage.setItem(`ayoza_account_privacy:${uid}`, JSON.stringify(state));
    } catch {
      // ignore
    }
  };

  const fetchFromServer = async (uid: string): Promise<PrivacyState> => {
    const base = API.replace(/\/$/, "");
    const res = await fetch(`${base}/users/${encodeURIComponent(uid)}/account-privacy`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const json = await safeJson(res);

    if (!res.ok) {
      const msg =
        json?.message ||
        `Konnte Privacy nicht laden (HTTP ${res.status}).`;
      throw new Error(msg);
    }

    // Server liefert { userId, privacy }
    const privacy = json?.privacy ?? json;
    return normalizeState(privacy);
  };

  const pushToServer = async (uid: string, next: PrivacyState): Promise<PrivacyState> => {
    const base = API.replace(/\/$/, "");
    const res = await fetch(`${base}/users/${encodeURIComponent(uid)}/account-privacy`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });

    const json = await safeJson(res);

    if (!res.ok) {
      const msg =
        json?.message ||
        `Konnte Privacy nicht speichern (HTTP ${res.status}).`;
      throw new Error(msg);
    }

    const privacy = json?.privacy ?? json;
    return normalizeState(privacy);
  };

  const hydrate = async () => {
    try {
      setLoading(true);

      const u = await getCurrentUserFromStorage();
      const uid = extractUserId(u);

      if (!uid) {
        Alert.alert("Nicht eingeloggt", "Bitte melde dich an.");
        router.replace("/login");
        return;
      }

      if (!aliveRef.current) return;

      setUserId(uid);

      // 1) Cache sofort anwenden (snappy UI)
      const cached = await loadFromCache(uid);
      if (cached && aliveRef.current) {
        applyState(cached);
      } else if (aliveRef.current) {
        applyState(DEFAULT_STATE);
      }

      // 2) Dann Server als Wahrheit laden
      const fromServer = await fetchFromServer(uid);
      if (!aliveRef.current) return;

      applyState(fromServer);
      await saveToCache(uid, fromServer);
    } catch (e: any) {
      // Falls Server nicht erreichbar: UI bleibt Cache/Default
      Alert.alert(
        "Hinweis",
        e?.message ||
          "Server nicht erreichbar. Einstellungen werden lokal angezeigt."
      );
    } finally {
      aliveRef.current && setLoading(false);
    }
  };

  useEffect(() => {
    aliveRef.current = true;
    hydrate();
    return () => {
      aliveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (patch: Partial<PrivacyState>) => {
    if (!userId) return;

    const optimistic: PrivacyState = normalizeState({
      privateAccount,
      mentions,
      comments,
      tagsAllowed,
      allowMessages,
      ...patch,
    });

    // UI sofort updaten
    applyState(optimistic);

    // Cache sofort aktualisieren (falls offline)
    await saveToCache(userId, optimistic);

    // Server schreiben
    try {
      setSaving(true);
      const confirmed = await pushToServer(userId, optimistic);
      if (!aliveRef.current) return;

      // Server kann normalisieren → final übernehmen
      applyState(confirmed);
      await saveToCache(userId, confirmed);
    } catch (e: any) {
      // rollback? (optional) – ich lasse die UI so, aber melde Fehler
      Alert.alert(
        "Speichern fehlgeschlagen",
        e?.message || "Konnte die Einstellung nicht speichern."
      );
    } finally {
      aliveRef.current && setSaving(false);
    }
  };

  const setAllPrivate = async () => {
    if (!userId) return;
    await save({
      privateAccount: true,
      mentions: "followers",
      comments: "followers",
      tagsAllowed: "followers",
      allowMessages: false,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back-outline" size={24} color={TXT} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Account-Privatsphäre</Text>
          <View style={styles.headerAccentBar} />
          <Text style={styles.subHeader}>
            Aktiver Account: {userId ? userId : "—"}
          </Text>
        </View>

        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={ACCENT} />
          <Text style={{ color: TXT_DIM, marginTop: 10 }}>Lade Einstellungen…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* INFO */}
          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark-outline" size={22} color={ACCENT} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.infoTitle}>Kontosicherheit</Text>
              <Text style={styles.infoText}>
                Diese Einstellungen werden jetzt **serverseitig** gespeichert und gelten für deinen Account – nicht nur lokal.
              </Text>
              <Text style={[styles.infoText, { marginTop: 6 }]}>
                {saving ? "Speichert…" : " "}
              </Text>
            </View>
          </View>

          {/* QUICK ACTION */}
          <View style={{ marginTop: 10 }}>
            <TouchableOpacity
              onPress={() => setAllPrivate()}
              style={styles.quickBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="lock-closed-outline" size={18} color="#fff" />
              <Text style={styles.quickBtnText}>Alles komplett privat machen</Text>
            </TouchableOpacity>
            <Text style={styles.quickHint}>
              Setzt: Privat an · Erwähnungen/Fotos-Markierungen/Kommentare nur Follower · Nachrichten nur Follower
            </Text>
          </View>

          {/* PRIVATE ACCOUNT */}
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowLeft}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={TXT}
                  style={{ marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Privater Account</Text>
                  <Text style={styles.rowDesc}>
                    Nur Follower können deine Inhalte sehen (Bilder, Musik, Snippets, Stories).
                  </Text>
                </View>
              </View>

              <Switch
                value={privateAccount}
                onValueChange={(v) => save({ privateAccount: v })}
                thumbColor={privateAccount ? ACCENT : "#555"}
                trackColor={{ true: "#ff4fd877", false: "#222" }}
              />
            </View>
          </View>

          {/* MENTIONS */}
          <Text style={styles.sectionTitle}>Erwähnungen</Text>
          <View style={styles.card}>
            {(["everyone", "followers", "nobody"] as PrivacyChoice[]).map((m, i) => {
              const label = m === "everyone" ? "Jeder" : m === "followers" ? "Follower" : "Niemand";
              return (
                <View key={m} style={[styles.row, i < 2 && styles.rowBorder]}>
                  <Text style={styles.rowLabel}>{label}</Text>

                  <TouchableOpacity onPress={() => save({ mentions: m })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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

          {/* COMMENTS */}
          <Text style={styles.sectionTitle}>Kommentare</Text>
          <View style={styles.card}>
            {(["everyone", "followers", "nobody"] as PrivacyChoice[]).map((m, i) => {
              const label = m === "everyone" ? "Jeder" : m === "followers" ? "Follower" : "Niemand";
              return (
                <View key={m} style={[styles.row, i < 2 && styles.rowBorder]}>
                  <Text style={styles.rowLabel}>{label}</Text>

                  <TouchableOpacity onPress={() => save({ comments: m })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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

          {/* TAGGING */}
          <Text style={styles.sectionTitle}>Markierungen</Text>
          <View style={styles.card}>
            {(["everyone", "followers", "nobody"] as PrivacyChoice[]).map((m, i) => {
              const label = m === "everyone" ? "Jeder" : m === "followers" ? "Follower" : "Niemand";
              return (
                <View key={m} style={[styles.row, i < 2 && styles.rowBorder]}>
                  <Text style={styles.rowLabel}>{label}</Text>

                  <TouchableOpacity onPress={() => save({ tagsAllowed: m })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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

          {/* MESSAGES */}
          <Text style={styles.sectionTitle}>Nachrichten</Text>
          <View style={styles.card}>
            <View style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowLeft}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={20}
                  color={TXT}
                  style={{ marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Nachrichten erlauben</Text>
                  <Text style={styles.rowDesc}>
                    Wenn aus: Nur Follower (und System) können dir schreiben.
                  </Text>
                </View>
              </View>

              <Switch
                value={allowMessages}
                onValueChange={(v) => save({ allowMessages: v })}
                thumbColor={allowMessages ? ACCENT : "#555"}
                trackColor={{ true: "#ff4fd877", false: "#222" }}
              />
            </View>
          </View>

          <View style={{ height: 28 }} />

          {/* DEBUG / RELOAD */}
          <TouchableOpacity
            onPress={() => hydrate()}
            style={styles.reloadBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh-outline" size={18} color={TXT_DIM} />
            <Text style={styles.reloadText}>Neu laden</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: ACCENT, fontSize: 16, fontWeight: "800" },
  headerAccentBar: {
    marginTop: 4,
    width: 44,
    height: 3,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  subHeader: { marginTop: 6, color: TXT_DIM, fontSize: 12 },

  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  content: { paddingHorizontal: 16, paddingVertical: 16 },

  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    padding: 14,
  },
  infoTitle: { color: TXT, fontSize: 14, fontWeight: "800" },
  infoText: { color: TXT_DIM, fontSize: 12.5, marginTop: 4, lineHeight: 18 },

  sectionTitle: { color: TXT_DIM, fontSize: 13, marginTop: 18, marginBottom: 8 },

  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },

  row: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 10 },

  rowLabel: { color: TXT, fontSize: 14, fontWeight: "700" },
  rowDesc: { color: TXT_DIM, fontSize: 12, marginTop: 3, lineHeight: 16 },

  quickBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  quickBtnText: { color: "#fff", fontSize: 13.5, fontWeight: "800" },
  quickHint: { color: TXT_DIM, fontSize: 12, marginTop: 8, lineHeight: 16 },

  reloadBtn: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: "#0c0c0c",
  },
  reloadText: { color: TXT_DIM, fontSize: 12.5, fontWeight: "700" },
});

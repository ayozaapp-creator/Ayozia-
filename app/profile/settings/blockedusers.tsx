// app/profile/settings/blocked-users.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
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

const http = axios.create({
  baseURL: API,
  timeout: 15000,
});

type LoggedUser = {
  id: string;
  username?: string;
  email?: string;
};

type SafeUser = {
  id: string;
  username?: string;
  avatarUrl?: string | null;
};

type BlockedItem = {
  blockedId: string;
  reason?: string;
  createdAt?: string;
  user?: SafeUser;
};

type BlockedResponse = {
  userId: string;
  blocked: BlockedItem[];
};

export default function BlockedUsersScreen() {
  const router = useRouter();

  const [me, setMe] = useState<LoggedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [blocked, setBlocked] = useState<BlockedItem[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadMe = async (): Promise<LoggedUser | null> => {
    // ✅ Robust: akzeptiere mehrere Keys & Strukturen (u oder {user:u})
    const keys = ["me", "user", "@user", "ayo_user", "auth_user", "ayozia_user", "currentUser"];
    for (const k of keys) {
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;

      try {
        const j = JSON.parse(raw);
        const u = j?.user?.id ? j.user : j;
        if (!u?.id) continue;

        return { id: String(u.id), username: u.username, email: u.email };
      } catch {
        continue;
      }
    }
    return null;
  };

  const fetchBlocked = async (userId: string) => {
    const res = await http.get<BlockedResponse>(`/users/${userId}/blocked`, {
      params: { viewer: userId },
    });
    const list = Array.isArray(res.data?.blocked) ? res.data.blocked : [];
    setBlocked(list);
  };

  useEffect(() => {
    (async () => {
      try {
        const u = await loadMe();
        if (!u) {
          Alert.alert("Nicht eingeloggt", "Bitte zuerst einloggen.");
          setLoading(false);
          return;
        }
        setMe(u);
        await fetchBlocked(u.id);
      } catch (e: any) {
        console.log("blocked load error:", e?.message ?? e);
        Alert.alert(
          "Fehler",
          "Blockierte Nutzer konnten nicht geladen werden. Prüfe Server/Verbindung."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onRefresh = async () => {
    if (!me?.id) return;
    try {
      setRefreshing(true);
      await fetchBlocked(me.id);
    } catch (e: any) {
      console.log("blocked refresh error:", e?.message ?? e);
      Alert.alert("Fehler", "Aktualisieren fehlgeschlagen.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleUnblock = (item: BlockedItem) => {
    if (!me?.id) return;

    const username =
      item?.user?.username || (item.blockedId ? item.blockedId : "Nutzer");

    Alert.alert("Entsperren", `Möchtest du @${username} wirklich entsperren?`, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Entsperren",
        style: "destructive",
        onPress: async () => {
          try {
            setSavingId(item.blockedId);
            await http.post(`/users/${me.id}/unblock`, {
              viewerId: me.id,
              blockedId: item.blockedId,
            });

            // UI sofort aktualisieren
            setBlocked((prev) =>
              prev.filter((x) => String(x.blockedId) !== String(item.blockedId))
            );
          } catch (e: any) {
            console.log("unblock error:", e?.message ?? e);
            Alert.alert(
              "Fehler",
              "Entsperren fehlgeschlagen. Prüfe Server/Verbindung."
            );
          } finally {
            setSavingId(null);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: BlockedItem }) => {
    const username = item?.user?.username || "unbekannt";
    const reason = item?.reason?.trim() ? item.reason : "Blockiert";
    const isSaving = savingId === item.blockedId;

    return (
      <View style={styles.userRow}>
        <View style={styles.userLeft}>
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person-circle-outline" size={30} color={TXT_DIM} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.usernameText}>@{username}</Text>
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.unblockBtn, isSaving && { opacity: 0.6 }]}
          onPress={() => handleUnblock(item)}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={ACCENT} />
          ) : (
            <>
              <Ionicons name="remove-circle-outline" size={18} color={ACCENT} />
              <Text style={styles.unblockText}>Entsperren</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
          <Text style={styles.headerTitle}>Blockierte Nutzer</Text>
          <View style={styles.headerAccentBar} />
        </View>

        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <View style={styles.container}>
          <View style={styles.content}>
            {/* Info-Karte */}
            <View style={styles.infoCard}>
              <Ionicons name="hand-left-outline" size={22} color={ACCENT} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.infoTitle}>Blockierte Accounts</Text>
                <Text style={styles.infoText}>
                  Nutzer auf dieser Liste können dein Profil nicht sehen, dir
                  keine Nachrichten schicken und nicht mit deinen Inhalten
                  interagieren –
                </Text>
              </View>
            </View>

            {/* Liste */}
            <View style={styles.card}>
              {blocked.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={34}
                    color={TXT_DIM}
                  />
                  <Text style={styles.emptyTitle}>Keine blockierten Nutzer</Text>
                  <Text style={styles.emptyText}>
                    Du hast aktuell niemanden blockiert. Wenn du jemanden
                    blockierst, erscheint der Account hier.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={blocked}
                  keyExtractor={(item) => String(item.blockedId)}
                  renderItem={renderItem}
                  ItemSeparatorComponent={() => (
                    <View style={styles.separator} />
                  )}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      tintColor={ACCENT}
                    />
                  }
                />
              )}
            </View>

            <View style={{ height: 40 }} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

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
    flex: 1,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 14,
  },
  infoTitle: {
    color: TXT,
    fontSize: 14,
    fontWeight: "800",
  },
  infoText: {
    color: TXT_DIM,
    marginTop: 3,
    lineHeight: 18,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  emptyWrap: {
    padding: 18,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 8,
    color: TXT,
    fontWeight: "800",
    fontSize: 14,
  },
  emptyText: {
    marginTop: 6,
    color: TXT_DIM,
    textAlign: "center",
    lineHeight: 18,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: 12,
  },
  userRow: {
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  userLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  usernameText: {
    color: TXT,
    fontWeight: "900",
    fontSize: 14,
  },
  reasonText: {
    color: TXT_DIM,
    marginTop: 2,
    fontSize: 12,
  },
  unblockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ACCENT,
    backgroundColor: "#0f0f0f",
  },
  unblockText: {
    color: ACCENT,
    fontWeight: "900",
    fontSize: 12,
  },
});

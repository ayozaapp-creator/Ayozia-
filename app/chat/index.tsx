// app/chat/index.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
import BottomNavbar from "../../components/bottomnavbar"; // ✅ deine globale Navbar

const API = "http://192.168.0.224:5000";

type Conversation = {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
  avatarUrl?: string | null;
  lastType?: "text" | "media" | "voice";
};

const getChatId = (a: string, b: string) => [a, b].sort().join("-");
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatTimeOrDay = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (isSameDay(d, now)) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  try {
    return d.toLocaleDateString([], { weekday: "short" });
  } catch {
    return d.toLocaleDateString();
  }
};

const lastPreview = (input: { type?: Conversation["lastType"]; text?: string }) => {
  if (input.type === "voice") return "🎙 Sprachmemo";
  if (input.type === "media") return "📎 Medien";
  const t = (input.text || "").trim();
  return t.length ? t : "—";
};

type ServerMsg = {
  id: string;
  chatId: string;
  fromId: string;
  toId: string;
  text?: string;
  timestamp: string;
  read?: boolean;
  media?: any;
  voice?: any;
};

type PublicUser = {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string | null;
};

export default function ChatList() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const swipeRefs = useRef<Record<string, Swipeable | null>>({});

  const serverDeleteConversation = useCallback(async (userId: string, partnerId: string) => {
    try {
      const res = await fetch(`${API}/conversations/${userId}/${partnerId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (e: any) {
      throw e;
    }
  }, []);

  const loadMe = useCallback(async () => {
    const raw = await AsyncStorage.getItem("user");
    const u = raw ? JSON.parse(raw) : null;
    setMeId(u?.id ?? null);
    return u?.id ?? null;
  }, []);

  const tryLoadViaServerList = useCallback(async (uid: string): Promise<Conversation[] | null> => {
    try {
      const r = await fetch(`${API}/conversations/${uid}`);
      if (!r.ok) return null;
      const j = await r.json();
      if (!Array.isArray(j?.items)) return null;
      return j.items.map((it: any) => {
        const t = it.lastMessage?.createdAt || it.lastMessage?.timestamp;
        const type: Conversation["lastType"] =
          it.lastMessage?.voice ? "voice" : it.lastMessage?.media ? "media" : "text";
        return {
          id: String(it.partner?.id || ""),
          name: String(it.partner?.username || "Unbekannt"),
          avatarUrl: it.partner?.avatarUrl ?? null,
          lastMessage: String(it.lastMessage?.text || "—"),
          time: formatTimeOrDay(t),
          unread: Number(it.unreadCount || 0),
          lastType: type,
        };
      });
    } catch {
      return null;
    }
  }, []);

  const loadConversations = useCallback(
    async (uid: string) => {
      const direct = await tryLoadViaServerList(uid);
      if (direct !== null) setConvos(direct);
      else setConvos([]);
    },
    [tryLoadViaServerList]
  );

  useEffect(() => {
    (async () => {
      const uid = await loadMe();
      if (uid) await loadConversations(uid);
    })();
  }, [loadMe, loadConversations]);

  useEffect(() => {
    if (!meId) return;
    pollingRef.current = setInterval(() => {
      loadConversations(meId).catch(() => {});
    }, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [meId, loadConversations]);

  const data = useMemo(() => {
    if (!q.trim()) return convos;
    const s = q.trim().toLowerCase();
    return convos.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.lastMessage.toLowerCase().includes(s)
    );
  }, [q, convos]);

  const openChat = (c: Conversation) => {
    router.push({ pathname: "/chat/[id]", params: { id: c.id, name: c.name } });
    setConvos((prev) => prev.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x)));
  };

  const confirmDelete = (partnerId: string, name: string) => {
    if (!meId) {
      Alert.alert("Fehler", "Bitte neu einloggen.");
      return;
    }
    Alert.alert(
      "Chat löschen?",
      `Konversation mit ${name} dauerhaft entfernen?`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            setConvos((prev) => prev.filter((c) => c.id !== partnerId));
            try {
              await serverDeleteConversation(meId, partnerId);
              await loadConversations(meId);
            } catch {
              await loadConversations(meId);
              Alert.alert("Fehler", "Konnte Chat nicht löschen.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const RightAction = ({ onPress }: { onPress: () => void }) => (
    <View style={styles.rightAction}>
      <TouchableOpacity onPress={onPress} style={styles.trashBtn}>
        <Ionicons name="trash" size={20} color="#fff" />
        <Text style={styles.trashTxt}>Löschen</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Chats</Text>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput
            style={styles.search}
            placeholder="Suchen…"
            placeholderTextColor="#888"
            value={q}
            onChangeText={setQ}
          />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
        >
          {data.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: 40 }}>
              <Ionicons name="chatbubble-ellipses-outline" size={36} color="#555" />
              <Text style={{ color: "#777", marginTop: 8 }}>Noch keine Konversationen</Text>
              <Text style={{ color: "#555", marginTop: 2, fontSize: 12 }}>
                Schreibe jemanden an, um eine Unterhaltung zu starten.
              </Text>
            </View>
          ) : (
            data.map((item) => {
              const setRef: React.Ref<Swipeable> = (r) => {
                swipeRefs.current[item.id] = r;
              };
              return (
                <Swipeable
                  key={item.id}
                  ref={setRef}
                  overshootRight={false}
                  renderRightActions={() => (
                    <RightAction
                      onPress={() => {
                        swipeRefs.current[item.id]?.close();
                        confirmDelete(item.id, item.name);
                      }}
                    />
                  )}
                >
                  <TouchableOpacity
                    style={styles.item}
                    activeOpacity={0.8}
                    onPress={() => openChat(item)}
                  >
                    <View style={styles.avatar}>
                      {item.avatarUrl ? (
                        <Image source={{ uri: item.avatarUrl }} style={styles.avatarImg} />
                      ) : (
                        <Text style={{ color: "#fff", fontWeight: "700" }}>
                          {item.name.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={styles.name} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.time}>{item.time}</Text>
                      </View>
                      <View style={styles.row}>
                        <Text style={styles.preview} numberOfLines={1}>
                          {lastPreview({
                            type: item.lastType,
                            text: item.lastMessage,
                          })}
                        </Text>
                        {item.unread > 0 && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                              {item.unread > 99 ? "99+" : item.unread}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              );
            })
          )}
        </ScrollView>

        <BottomNavbar />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },
  header: { paddingTop: 18, paddingHorizontal: 16, paddingBottom: 10 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  searchRow: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#161616",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  search: { color: "#fff", flex: 1 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#121212",
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ff4fd8",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: { color: "#fff", fontSize: 16, fontWeight: "600", maxWidth: "70%" },
  time: { color: "#888", fontSize: 12, marginLeft: 8 },
  preview: { color: "#bbb", fontSize: 13, maxWidth: "80%" },
  badge: {
    minWidth: 18,
    paddingHorizontal: 6,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ff4fd8",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  rightAction: {
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    marginBottom: 10,
  },
  trashBtn: {
    backgroundColor: "#e03131",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 92,
  },
  trashTxt: { color: "#fff", fontWeight: "700", marginTop: 4, fontSize: 12 },
});

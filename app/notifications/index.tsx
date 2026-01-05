// app/notifications/index.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const API = "http://192.168.0.224:5000";

const http = axios.create({ baseURL: API, timeout: 15000 });

type PublicUser = { id: string; username: string; avatarUrl: string | null };
type Noti = {
  id: string;
  toId: string;
  fromId: string;
  kind: "message" | "follow" | "like" | "comment";
  meta?: { chatId?: string; messageId?: string; preview?: string; postId?: string };
  actor?: PublicUser | null;
  createdAt: string;
  read: boolean;
};

const BG = "#000";
const CARD = "#0f0f0f";
const BORDER = "#1f1f1f";
const TEXT = "#fff";
const DIM = "#bfbfbf";
const ACCENT = "#ff4fd8";

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [me, setMe] = useState<PublicUser | null>(null);
  const [items, setItems] = useState<Noti[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem("user");
      if (!raw) {
        router.replace("/login");
        return;
      }
      const u = JSON.parse(raw);
      setMe({ id: u.id, username: u.username, avatarUrl: u.avatarUrl });
    })();
  }, [router]);

  const load = useCallback(async (reset = false) => {
    if (!me?.id) return;
    try {
      if (reset) setLoading(true);
      const r = await http.get<{ items: Noti[]; nextCursor: string | null }>("/notifications", {
        params: { userId: me.id, limit: 20, cursor: reset ? undefined : cursor || undefined },
      });
      setItems(prev => reset ? r.data.items : [...prev, ...r.data.items]);
      setCursor(r.data.nextCursor);
    } finally {
      if (reset) setLoading(false);
    }
  }, [me?.id, cursor]);

  useEffect(() => {
    if (!me?.id) return;
    load(true);
    // beim Öffnen: alles gelesen
    http.post("/notifications/mark-all-read", { userId: me.id }).catch(() => {});
  }, [me?.id, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCursor(null);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const onEnd = useCallback(async () => {
    if (!cursor || fetchingMore || loading) return;
    setFetchingMore(true);
    await load(false);
    setFetchingMore(false);
  }, [cursor, fetchingMore, loading, load]);

  const renderText = (n: Noti) => {
    const name = n.actor?.username || "Jemand";
    switch (n.kind) {
      case "message":
        return (
          <>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.text}> hat dir eine Nachricht geschickt</Text>
            {!!n.meta?.preview && <Text style={styles.preview}> — {n.meta.preview}</Text>}
          </>
        );
      case "follow":
        return (
          <>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.text}> folgt dir jetzt</Text>
          </>
        );
      case "like":
        return (
          <>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.text}> hat dein Snippet geliked</Text>
          </>
        );
      case "comment":
        return (
          <>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.text}> hat kommentiert</Text>
          </>
        );
      default:
        return <Text style={styles.text}>Benachrichtigung</Text>;
    }
  };

  const goTo = (n: Noti) => {
    if (n.kind === "message" && n.actor?.id) {
      router.push({ pathname: "/chat/[id]", params: { id: n.actor.id } });
      return;
    }
    if (n.actor?.id) {
      router.push({ pathname: "/profile/[id]", params: { id: n.actor.id } });
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <View style={{ flex:1, alignItems:"center", justifyContent:"center" }}>
          <ActivityIndicator color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={styles.header}>
        <Text style={styles.title}>Benachrichtigungen</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.row, !item.read && styles.rowUnread]} activeOpacity={0.9} onPress={() => goTo(item)}>
            {item.actor?.avatarUrl ? (
              <Image source={{ uri: item.actor.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarEmpty}>
                <Ionicons name="person" size={18} color="#999" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.line} numberOfLines={2}>
                {renderText(item)}
              </Text>
              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#777" />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        onEndReachedThreshold={0.4}
        onEndReached={onEnd}
        ListFooterComponent={
          fetchingMore ? (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator color="#aaa" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ padding: 24, alignItems: "center" }}>
            <Text style={{ color: "#777" }}>Noch keine Benachrichtigungen</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const AV = 46;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  title: { color: TEXT, fontSize: 20, fontWeight: "800" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: BG,
  },
  rowUnread: {
    backgroundColor: "#0b0b12",
  },
  avatar: {
    width: AV, height: AV, borderRadius: AV/2,
    marginRight: 12, borderWidth: 1, borderColor: BORDER,
  },
  avatarEmpty: {
    width: AV, height: AV, borderRadius: AV/2,
    marginRight: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: "#151515", borderWidth: 1, borderColor: BORDER,
  },
  line: { color: TEXT, fontSize: 14 },
  name: { color: TEXT, fontWeight: "800" },
  text: { color: TEXT },
  preview: { color: DIM },
  time: { color: "#888", marginTop: 2, fontSize: 12 },
  sep: { height: 1, backgroundColor: BORDER, marginLeft: 72 },
});

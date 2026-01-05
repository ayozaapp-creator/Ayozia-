import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const API = "http://192.168.0.224:5000";
;

type PublicUser = {
  id: string;
  username: string;
  avatarUrl: string | null;
  isVerified?: boolean;
  followedAt?: string;
};

async function authFetch(url: string) {
  const token = await AsyncStorage.getItem("token");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { headers });
}

export default function FollowingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PublicUser[]>([]);
  const [filtered, setFiltered] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await authFetch(`${API}/users/${id}/following`);
      const json = await res.json();
      const list: PublicUser[] = Array.isArray(json.following)
        ? json.following
        : [];
      setData(list);
      setFiltered(list);
    } catch (e) {
      console.warn("following load error:", e);
      setData([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(data);
    } else {
      const s = search.toLowerCase();
      setFiltered(data.filter((u) => u.username.toLowerCase().includes(s)));
    }
  }, [search, data]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Gefolgt</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Suchfeld */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#aaa" />
        <TextInput
          placeholder="Suche nach Nutzern..."
          placeholderTextColor="#888"
          style={styles.input}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Liste */}
      <FlatList
        data={filtered}
        keyExtractor={(u) => String(u.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#aaa"
          />
        }
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => (
          <Link
            href={{ pathname: "/profile/[id]", params: { id: String(item.id) } }}
            asChild
          >
            <TouchableOpacity style={styles.row} activeOpacity={0.9}>
              {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  @{String(item?.username || "")}{" "}
                  {item?.isVerified ? "✅" : ""}
                </Text>
                {item?.followedAt ? (
                  <Text style={styles.meta}>
                    Seit {new Date(item.followedAt).toLocaleDateString()}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          </Link>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Du folgst noch niemandem</Text>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0a0014" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  backBtn: { padding: 6 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a22",
    marginHorizontal: 16,
    borderRadius: 12,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    paddingVertical: 8,
    marginLeft: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  avatarFallback: { backgroundColor: "#333a" },
  name: { color: "#fff", fontSize: 15, fontWeight: "700" },
  meta: { color: "#9aa", fontSize: 12, marginTop: 2 },
  sep: { height: 1, backgroundColor: "#1d2033" },
  empty: { color: "#8b8b9c", textAlign: "center", marginTop: 24 },
});

// app/search.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ================= Config ================= */
const API = "http://192.168.0.224:5000";

const SINCE_DAYS = 30; // Wie lange gilt "neu"
const LIMIT_NEW = 200; // Neu angemeldet
const ALL_USERS_CAP = 4000; // ✅ WICHTIG: niemals limit=0 (Freeze!)
const SEARCH_MIN_CHARS = 2; // ✅ ab 2 Zeichen suchen (UI bleibt flüssig)
const SEARCH_DEBOUNCE_MS = 250;
const FILTER_CHUNK = 600; // ✅ Chunk-Filter, damit JS-Thread nicht blockiert

/* ================= Types ================= */
type User = {
  id: string;
  username: string;
  email?: string;
  avatarUrl: string | null;
  bio?: string;
  isVerified: boolean;
  createdAt: string | null; // ISO
};

const isNewWithin = (iso?: string | null, days = SINCE_DAYS) => {
  if (!iso) return false;
  const diffDays = (Date.now() - new Date(iso).getTime()) / 86400000;
  return diffDays <= days;
};

/* ================= UI Const ================= */
const { width: SCREEN_W } = Dimensions.get("window");
const STORY_SIZE = 72;
const GRID_COLS = 3;
const GRID_GAP = 12;
const GRID_ITEM_W = Math.floor(
  (SCREEN_W - 24 /*padding*/ - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS
);

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Suche
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<User[]>([]);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Neu angemeldet
  const [fresh, setFresh] = useState<User[]>([]);
  const [loadingFresh, setLoadingFresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Cache: alle User (für Client-Suche)
  const allUsersRef = useRef<User[] | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);

  // Cancel laufende Chunk-Suche
  const searchTokenRef = useRef(0);

  /* -------- Fetch helpers -------- */
  const fetchFresh = useCallback(async () => {
    try {
      setLoadingFresh(true);
      const res = await fetch(`${API}/users/new?sinceDays=${SINCE_DAYS}&limit=${LIMIT_NEW}`);
      const json = await res.json();
      const list: User[] = Array.isArray(json.users) ? json.users : [];
      setFresh(list);
      console.log("fresh users:", list.length);
    } catch (e) {
      console.warn("fetchFresh error:", e);
      setFresh([]);
    } finally {
      setLoadingFresh(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFresh();
    setRefreshing(false);
  }, [fetchFresh]);

  /**
   * ✅ IMPORTANT:
   * - NICHT limit=0, sonst kann JSON + Parsing die App "einfrieren"
   * - wir cappen auf ALL_USERS_CAP
   */
  const ensureAllUsers = useCallback(async () => {
    if (allUsersRef.current) return allUsersRef.current;
    try {
      setLoadingAll(true);
      const res = await fetch(`${API}/users?limit=${ALL_USERS_CAP}&sort=createdAt&order=desc`);
      const json = await res.json();
      const list = Array.isArray(json.users) ? (json.users as User[]) : [];
      allUsersRef.current = list;
      return list;
    } catch (e) {
      console.warn("ensureAllUsers error:", e);
      allUsersRef.current = [];
      return [];
    } finally {
      setLoadingAll(false);
    }
  }, []);

  /* -------- Load „fresh“ on mount -------- */
  useEffect(() => {
    fetchFresh();
  }, [fetchFresh]);

  // ✅ Navigation
  const openProfile = useCallback(
    (u: User) => {
      if (!u?.id) return;
      router.push({ pathname: "/profile/[id]", params: { id: String(u.id) } });
    },
    [router]
  );

  /**
   * ✅ Chunked Filtering (UI bleibt flüssig)
   * Filtert in Blöcken und yieldet zwischen den Blöcken.
   */
  const filterUsersChunked = useCallback(async (term: string) => {
    const token = ++searchTokenRef.current;

    const all = await ensureAllUsers();
    if (token !== searchTokenRef.current) return;

    const normalized = term.toLowerCase();

    const out: User[] = [];
    let i = 0;

    const step = () =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          const end = Math.min(i + FILTER_CHUNK, all.length);
          for (; i < end; i++) {
            const u = all[i];
            const un = (u.username || "").toLowerCase();
            const bio = (u.bio || "").toLowerCase();
            if (un.includes(normalized) || bio.includes(normalized)) out.push(u);
          }
          resolve();
        }, 0);
      });

    while (i < all.length) {
      if (token !== searchTokenRef.current) return;
      await step();
      if (token !== searchTokenRef.current) return;

      // ✅ optional: early stop wenn sehr viele Treffer
      if (out.length >= 300) break;
    }

    if (token !== searchTokenRef.current) return;
    setResults(out);
  }, [ensureAllUsers]);

  /* -------- Debounced client-side search (patched) -------- */
  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);

    const term = q.trim();
    if (term.length === 0) {
      searchTokenRef.current++; // cancel laufendes
      setResults([]);
      setSearching(false);
      return;
    }

    // ✅ erst ab 2 Zeichen suchen (massiv weniger Freeze)
    if (term.length < SEARCH_MIN_CHARS) {
      searchTokenRef.current++; // cancel laufendes
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);

    debRef.current = setTimeout(async () => {
      try {
        await filterUsersChunked(term);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, [q, filterUsersChunked]);

  const todayCount = useMemo(
    () =>
      fresh.filter(
        (u) =>
          u.createdAt &&
          new Date(u.createdAt).toDateString() === new Date().toDateString()
      ).length,
    [fresh]
  );

  /* ---------- UI pieces ---------- */
  const FreshBubble = ({ u }: { u: User }) => (
    <TouchableOpacity style={styles.storyWrap} activeOpacity={0.9} onPress={() => openProfile(u)}>
      <View style={styles.storyRing}>
        <View style={styles.storyCircle}>
          {u.avatarUrl ? (
            <Image
              source={{ uri: u.avatarUrl }}
              style={{ width: STORY_SIZE - 12, height: STORY_SIZE - 12, borderRadius: 999 }}
            />
          ) : (
            <Ionicons name="person" size={28} color="#fff" />
          )}
        </View>
        {isNewWithin(u.createdAt) && <View style={styles.newDot} />}
      </View>
      <Text style={styles.storyLabel} numberOfLines={1}>
        @{u.username}
      </Text>
    </TouchableOpacity>
  );

  const GridItem = ({ u }: { u: User }) => (
    <TouchableOpacity style={styles.gridItem} activeOpacity={0.9} onPress={() => openProfile(u)}>
      <View style={styles.gridCircle}>
        {u.avatarUrl ? (
          <Image
            source={{ uri: u.avatarUrl }}
            style={{ width: GRID_ITEM_W - 8, height: GRID_ITEM_W - 8, borderRadius: 999 }}
          />
        ) : (
          <Ionicons name="person" size={26} color="#fff" />
        )}
      </View>
      <Text style={styles.gridName} numberOfLines={1}>
        @{u.username} {u.isVerified ? "✅" : ""}
      </Text>
      {isNewWithin(u.createdAt) && (
        <View style={styles.gridNewPill}>
          <Text style={styles.gridNewText}>NEU</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  /* ---------- Render ---------- */
  return (
    <View style={[styles.container, { paddingTop: insets.top + 6 }]}>
      {/* 🔎 Suche */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#aaa" />
        <TextInput
          style={styles.input}
          placeholder="Leute suchen …"
          placeholderTextColor="#8a8a8a"
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardAppearance="dark"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        {(searching || loadingAll) && <ActivityIndicator size="small" color="#aaa" />}
      </View>

      {/* Infozeile */}
      <View style={styles.infoBar}>
        <Ionicons name="sparkles-outline" size={16} color="#ff4fd8" />
        <Text style={styles.infoText}>
          {loadingFresh
            ? "Lade neue Accounts …"
            : `${fresh.length} neue Accounts in den letzten ${SINCE_DAYS} Tagen`}
          {todayCount > 0 ? ` • Heute: ${todayCount}` : ""}
        </Text>
      </View>

      {/* Neu angemeldet */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Neu angemeldet</Text>
      </View>
      <FlatList
        data={fresh}
        keyExtractor={(u) => String(u.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesRow}
        renderItem={({ item }) => <FreshBubble u={item} />}
        ListEmptyComponent={
          loadingFresh ? (
            <ActivityIndicator style={{ marginLeft: 12 }} />
          ) : (
            <Text style={{ color: "#888", marginLeft: 12 }}>Noch keine neuen Accounts</Text>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#aaa" />
        }
        initialNumToRender={12}
        maxToRenderPerBatch={20}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
      />

      {/* Ergebnisse */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Ergebnisse</Text>
      </View>

      {q.trim().length === 0 ? (
        <Text style={styles.hint}>Tippe einen Namen, um nach Artists zu suchen.</Text>
      ) : q.trim().length < SEARCH_MIN_CHARS ? (
        <Text style={styles.hint}>Mindestens {SEARCH_MIN_CHARS} Zeichen eingeben…</Text>
      ) : results.length === 0 && !searching ? (
        <Text style={styles.hint}>Keine Treffer für „{q}“</Text>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(u) => String(u.id)}
          numColumns={GRID_COLS}
          columnWrapperStyle={{ justifyContent: "space-between", marginBottom: GRID_GAP }}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 90, paddingTop: 6 }}
          renderItem={({ item }) => <GridItem u={item} />}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

/* ================= Styles ================= */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0014", paddingBottom: 70 },

  // Suche
  searchBar: {
    marginHorizontal: 12,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#151528",
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#222344",
  },
  input: { color: "#fff", flex: 1, fontSize: 14 },

  // Info
  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#12122a",
    borderWidth: 1,
    borderColor: "#222344",
  },
  infoText: { color: "#ddd", fontSize: 12 },

  // Abschnittstitel
  sectionHeader: { marginTop: 14, marginBottom: 8, paddingHorizontal: 12 },
  sectionTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },

  // Stories
  storiesRow: { paddingHorizontal: 10, paddingBottom: 6, gap: 12 },
  storyWrap: { width: STORY_SIZE + 8, alignItems: "center", marginRight: 8 },
  storyRing: {
    width: STORY_SIZE,
    height: STORY_SIZE,
    borderRadius: STORY_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0f2a",
    borderWidth: 2,
    borderColor: "#ff4fd8",
    position: "relative",
  },
  storyCircle: {
    width: STORY_SIZE - 10,
    height: STORY_SIZE - 10,
    borderRadius: (STORY_SIZE - 10) / 2,
    backgroundColor: "#2a2a44",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  newDot: {
    position: "absolute",
    right: -2,
    top: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#3fd97d",
    borderWidth: 2,
    borderColor: "#0a0014",
  },
  storyLabel: {
    color: "#ddd",
    fontSize: 11,
    marginTop: 6,
    maxWidth: STORY_SIZE + 8,
    textAlign: "center",
  },

  // Grid
  gridItem: { width: GRID_ITEM_W, alignItems: "center", position: "relative" },
  gridCircle: {
    width: GRID_ITEM_W,
    height: GRID_ITEM_W,
    borderRadius: GRID_ITEM_W / 2,
    backgroundColor: "#2a2a44",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#3b3b6b",
    overflow: "hidden",
  },
  gridName: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
    maxWidth: GRID_ITEM_W,
    textAlign: "center",
  },
  gridNewPill: {
    position: "absolute",
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#1e2a1e",
    borderWidth: 1,
    borderColor: "#3fd97d",
  },
  gridNewText: { color: "#3fd97d", fontSize: 10, fontWeight: "800" },

  hint: { color: "#8b8b9c", marginHorizontal: 12, marginTop: 6 },
});

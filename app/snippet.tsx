// app/snippet.tsx
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { Audio, AVPlaybackStatus } from "expo-av";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: W, height: H } = Dimensions.get("window");

// ---- Theme ----
const BG = "#0b0b0b";
const CARD = "#151515";
const TXT = "#fff";
const TXT_DIM = "#bdbdbd";
const BORDER = "#242424";
const ACCENT = "#ff4fd8";

// ---- API ----
const API = "http://192.168.0.224:5000";
const DONATION_URL = process.env.EXPO_PUBLIC_DONATION_URL || ""; // optional
const http = axios.create({ baseURL: API, timeout: 15000 });

// ---- Types ----
type PublicUser = {
  id: string;
  email?: string;
  username?: string;
  avatarUrl?: string | null;
};

type Track = {
  id: string;
  userId: string | null;
  title: string;
  url: string;              // absolute
  cover?: string | null;    // absolute
  createdAt?: string | null;
  likes: number;
  plays: number;
  snippetStartMs: number;
  snippetDurationMs: number;
  hasLyrics: boolean;
  user?: PublicUser | null;
};

// ---- Utils ----
const FALLBACK_AVATAR =
  "https://upload.wikimedia.org/wikipedia/commons/2/2c/Default_pfp.svg";
const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop";

function absolutize(rel: string | null | undefined): string {
  if (!rel) return "";
  if (/^https?:\/\//i.test(rel)) return rel;
  const base = API.replace(/\/$/, "");
  const clean = rel.replace(/^\/+/, "");
  if (/^(music|covers)\//i.test(clean)) return `${base}/uploads/${clean}`;
  return `${base}/${clean}`;
}

export default function SnippetScreen() {
  const router = useRouter();

  const [items, setItems] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);

  // Player refs/state
  const soundRef = useRef<Audio.Sound | null>(null);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [swipeEnabled, setSwipeEnabled] = useState(false);

  // 🔵 Neu: Like+Spenden UI (minimal)
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
  const [askDonateOpen, setAskDonateOpen] = useState(false);
  const [donateInfoOpen, setDonateInfoOpen] = useState(false);

  // verhindert Race Conditions
  const playTokenRef = useRef<number>(0);

  // FlatList Ref, damit die aktive Karte mitscrollt
  const flatRef = useRef<FlatList<Track>>(null);

  const current = items[idx];

  // -------- Daten holen --------
  const fetchUser = useCallback(async (userId: string): Promise<PublicUser | null> => {
    try {
      const r = await http.get<{ user: PublicUser }>(`/users/${userId}`);
      return r.data?.user ?? null;
    } catch {
      return null;
    }
  }, []);

  const normalize = useCallback(
    async (raw: any): Promise<Track> => {
      const userId = raw.userId ? String(raw.userId) : null;
      const t: Track = {
        id: String(raw.id || raw._id || raw.uuid || Date.now()),
        userId,
        title: raw.title || raw.name || "Unbenannter Track",
        url: absolutize(raw.absUrl || raw.url || raw.path || raw.relPath || ""),
        cover: absolutize(raw.absCover || raw.cover || raw.coverUrl || raw.coverRelPath || ""),
        createdAt: raw.createdAt || raw.date || null,
        likes: Number.isFinite(raw.likes) ? raw.likes : 0,
        plays: Number.isFinite(raw.plays) ? raw.plays : 0,
        snippetStartMs:
          raw.snippetStartMs != null
            ? Number(raw.snippetStartMs)
            : raw.snippet_start_ms != null
            ? Number(raw.snippet_start_ms)
            : 0,
        snippetDurationMs:
            raw.snippetDurationMs != null
              ? Number(raw.snippetDurationMs)
              : raw.snippet_duration_ms != null
              ? Number(raw.snippet_duration_ms)
              : 30000,
        hasLyrics: !!raw.hasLyrics,
        user: null,
      };
      if (t.userId) t.user = await fetchUser(t.userId);
      return t;
    },
    [fetchUser]
  );

  const takeArray = (data: any): any[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.music)) return data.music;
    return [];
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let raws: any[] = [];
      const eps = ["/music/recent?limit=100", "/music/feed?limit=100", "/music"];
      for (const ep of eps) {
        try {
          const res = await http.get(ep);
          raws = takeArray(res.data);
          if (raws.length) break;
        } catch {
          // try next
        }
      }
      const normalized = await Promise.all(raws.map((r) => normalize(r)));
      setItems(normalized.filter((t) => !!t.url));
      setIdx(0);
      setLikedIds({});
    } finally {
      setLoading(false);
    }
  }, [normalize]);

  // -------- Player Helpers --------
  const clearTimer = () => {
    if (endTimer.current) {
      clearTimeout(endTimer.current);
      endTimer.current = null;
    }
  };

  const stopCurrent = useCallback(async () => {
    clearTimer();
    setIsPlaying(false);
    try {
      if (soundRef.current) {
        soundRef.current.setOnPlaybackStatusUpdate(null);
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
      }
    } finally {
      soundRef.current = null;
    }
  }, []);

  const playCurrent = useCallback(
    async (track: Track | undefined | null) => {
      const myToken = ++playTokenRef.current;

      setSwipeEnabled(false);
      setIsPlaying(false);
      clearTimer();

      if (!track?.url) {
        setSwipeEnabled(true);
        return;
      }

      await stopCurrent();

      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: track.url },
          { shouldPlay: false, progressUpdateIntervalMillis: 200 }
        );

        if (playTokenRef.current !== myToken) {
          await sound.unloadAsync().catch(() => {});
          return;
        }

        soundRef.current = sound;

        const start = Math.max(0, Number(track.snippetStartMs || 0));
        await sound.setPositionAsync(start);
        await sound.playAsync();
        setIsPlaying(true);

        const dur = Math.max(1000, Number(track.snippetDurationMs || 30000));
        endTimer.current = setTimeout(async () => {
          if (playTokenRef.current !== myToken) return;
          try {
            await sound.pauseAsync();
          } catch {}
          setIsPlaying(false);
          setSwipeEnabled(true);
        }, dur);

        sound.setOnPlaybackStatusUpdate((st: AVPlaybackStatus) => {
          if (playTokenRef.current !== myToken) return;
          if (!st.isLoaded) return;
          if (st.didJustFinish) {
            clearTimer();
            setIsPlaying(false);
            setSwipeEnabled(true);
          }
        });
      } catch {
        setSwipeEnabled(true);
      }
    },
    [stopCurrent]
  );

  // -------- Lifecycle --------
  useEffect(() => {
    loadData();
    return () => {
      playTokenRef.current++; // invalidate
      stopCurrent();
    };
  }, [loadData, stopCurrent]);

  useEffect(() => {
    playCurrent(items[idx]);
  }, [idx, items.length, playCurrent]);

  // bei idx-Wechsel → mitscrollen
  useEffect(() => {
    if (!flatRef.current) return;
    flatRef.current.scrollToIndex({ index: idx, animated: true });
  }, [idx]);

  // -------- Actions --------
  const goToIndex = useCallback(
    async (next: number) => {
      await stopCurrent();
      setIdx(next);
    },
    [stopCurrent]
  );

  const goNext = useCallback(async () => {
    const next = idx + 1 < items.length ? idx + 1 : 0;
    await goToIndex(next);
  }, [idx, items.length, goToIndex]);

  // ✅ Like -> Frage „spenden?“ anzeigen (alles andere unverändert)
  const onLike = useCallback(async () => {
    const t = items[idx];
    if (!t) return;

    // Optimistisch 1x liken
    if (!likedIds[t.id]) {
      setLikedIds((m) => ({ ...m, [t.id]: true }));
      setItems((arr) =>
        arr.map((x) => (x.id === t.id ? { ...x, likes: (x.likes || 0) + 1 } : x))
      );
      try {
        await http.post(`/music/${t.id}/like`);
      } catch {
        // rollback bei Fehler
        setLikedIds((m) => {
          const c = { ...m };
          delete c[t.id];
          return c;
        });
        setItems((arr) =>
          arr.map((x) =>
            x.id === t.id ? { ...x, likes: Math.max(0, (x.likes || 1) - 1) } : x
          )
        );
      }
    }

    // ➜ Spenden-Dialog öffnen
    setAskDonateOpen(true);
  }, [idx, items, likedIds]);

  // Nutzer: JA spenden
  const confirmDonate = useCallback(async () => {
    setAskDonateOpen(false);

    if (DONATION_URL) {
      try {
        const can = await Linking.canOpenURL(DONATION_URL);
        if (can) {
          await Linking.openURL(DONATION_URL);
          await goNext();
          return;
        }
      } catch {}
    }
    // Fallback-Info, wenn kein/ungültiger Link
    setDonateInfoOpen(true);
  }, [goNext]);

  // Nutzer: NEIN spenden
  const declineDonate = useCallback(async () => {
    setAskDonateOpen(false);
    await goNext();
  }, [goNext]);

  const closeDonateInfo = useCallback(async () => {
    setDonateInfoOpen(false);
    await goNext();
  }, [goNext]);

  const onSkip = useCallback(async () => {
    await goNext();
  }, [goNext]);

  const onOpenProfile = useCallback(() => {
    const t = items[idx];
    if (!t?.userId) return;
    router.push(`/profile/${t.userId}`);
  }, [idx, items, router]);

  // FlatList Viewability / Scroll-Events
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (!viewableItems?.length) return;
    const first = viewableItems[0];
    if (typeof first?.index === "number") {
      const newIndex = first.index as number;
      if (newIndex !== idx && swipeEnabled) {
        setIdx(newIndex);
      }
    }
  });

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / W);
    if (newIndex !== idx && swipeEnabled) {
      setIdx(newIndex);
    }
  };

  const dataToRender = useMemo(() => items, [items]);

  // -------- UI --------
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerBox}>
          <ActivityIndicator />
          <Text style={{ color: TXT_DIM, marginTop: 8 }}>Lade Snippets…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!items.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerBox}>
          <Text style={{ color: TXT_DIM, marginBottom: 12 }}>Keine Snippets gefunden.</Text>
          <TouchableOpacity onPress={loadData} style={styles.reloadBtn}>
            <Ionicons name="refresh" size={16} color="#0b0b0b" />
            <Text style={styles.reloadTxt}>Neu laden</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Snippets</Text>
        <TouchableOpacity onPress={loadData} style={styles.iconBtn}>
          <Ionicons name="refresh" size={18} color={TXT} />
        </TouchableOpacity>
      </View>

      {/* Pager */}
      <FlatList
        ref={flatRef}
        data={dataToRender}
        keyExtractor={(t) => t.id}
        extraData={{ idx, swipeEnabled, likedIds }}
        renderItem={({ item, index }) => (
          <SnippetCard
            item={item}
            isActive={index === idx}
            isPlaying={isPlaying && index === idx}
            onOpenProfile={onOpenProfile}
            onLike={onLike}
            onSkip={onSkip}
            swipeEnabled={swipeEnabled}
          />
        )}
        horizontal
        pagingEnabled
        snapToAlignment="center"
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        onMomentumScrollEnd={onMomentumEnd}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig}
        scrollEnabled={swipeEnabled}
        decelerationRate="fast"
        removeClippedSubviews
        windowSize={3}
        getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
      />

      {/* Swipe Lock Hinweis */}
      {!swipeEnabled && (
        <View style={styles.lockHint}>
          <Ionicons name="lock-closed-outline" size={14} color={TXT_DIM} />
          <Text style={styles.lockText}>Swipe nach Snippet-Ende</Text>
        </View>
      )}

      {/* 🔵 Modal: Spendenfrage nach Like */}
      <Modal visible={askDonateOpen} transparent animationType="fade" onRequestClose={declineDonate}>
        <Pressable style={styles.modalBackdrop} onPress={declineDonate}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Möchtest du an den Künstler spenden?</Text>
            <Text style={styles.modalText}>
              Ein kleines Trinkgeld unterstützt neue Artists und motiviert für mehr Releases.
            </Text>
            <View style={styles.modalRow}>
              <TouchableOpacity onPress={declineDonate} style={[styles.modalBtn, styles.btnGhost]}>
                <Text style={[styles.modalBtnText, { color: TXT }]}>Nein</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDonate} style={[styles.modalBtn, styles.btnAccent]}>
                <Text style={[styles.modalBtnText, { color: "#0b0b0b" }]}>Ja, spenden</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* 🔵 Modal: Fallback wenn DONATION_URL fehlt/nicht öffnet */}
      <Modal
        visible={donateInfoOpen}
        transparent
        animationType="fade"
        onRequestClose={closeDonateInfo}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeDonateInfo}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Spenden-Link nicht verfügbar</Text>
            <Text style={styles.modalText}>
              Setze <Text style={{ color: ACCENT, fontWeight: "800" }}>EXPO_PUBLIC_DONATION_URL</Text> in deiner .env,
              um direkt per Link zu spenden.
            </Text>
            <TouchableOpacity onPress={closeDonateInfo} style={[styles.modalBtn, styles.btnAccent]}>
              <Text style={[styles.modalBtnText, { color: "#0b0b0b" }]}>Okay</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ---- Card (unverändert bis auf Props) ----
function SnippetCard({
  item,
  isActive,
  isPlaying,
  onOpenProfile,
  onLike,
  onSkip,
  swipeEnabled,
}: {
  item: Track;
  isActive: boolean;
  isPlaying: boolean;
  onOpenProfile: () => void;
  onLike: () => void;
  onSkip: () => void;
  swipeEnabled: boolean;
}) {
  const cover = item.cover || FALLBACK_COVER;
  const userAvatar = item.user?.avatarUrl || FALLBACK_AVATAR;
  const username = item.user?.username || "Unbekannt";

  return (
    <View style={styles.cardWrap}>
      <Image source={{ uri: cover }} style={styles.cover} />
      <View style={styles.overlay} />

      {/* Uploader */}
      <View style={styles.uploaderRow}>
        <TouchableOpacity onPress={onOpenProfile} activeOpacity={0.9} style={styles.uploaderBtn}>
          <Image source={{ uri: userAvatar }} style={styles.uploaderAvatar} />
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.uploaderName} numberOfLines={1}>
              @{username}
            </Text>
            <Text style={styles.uploaderSub} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={[styles.playPill, !isActive && { opacity: 0.5 }]}>
          <Ionicons name={isPlaying ? "pause" : "play"} size={12} color="#0b0b0b" />
          <Text style={styles.playPillTxt}>
            {isActive ? (isPlaying ? "Snippet spielt…" : "Pause") : "Wartet…"}
          </Text>
        </View>
      </View>

      {/* Controls – unverändert */}
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={onSkip}
          activeOpacity={0.85}
          style={[styles.ctrlBtn, { backgroundColor: "#1e1e1e", borderColor: BORDER }]}
        >
          <Ionicons name="thumbs-down-outline" size={22} color={TXT} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onLike}
          activeOpacity={0.9}
          style={[styles.ctrlBtn, { backgroundColor: ACCENT, borderColor: ACCENT }]}
        >
          <Ionicons name="heart" size={22} color="#0b0b0b" />
        </TouchableOpacity>
      </View>

      {!swipeEnabled && (
        <View style={styles.swipeHint}>
          <Ionicons name="timer-outline" size={14} color={TXT_DIM} />
          <Text style={styles.swipeHintText}>Bitte Snippet anhören…</Text>
        </View>
      )}
    </View>
  );
}

// ---- Styles ----
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: TXT, fontSize: 20, fontWeight: "900" },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD,
  },

  cardWrap: { width: W, height: H * 0.78, alignItems: "center", justifyContent: "center" },
  cover: { width: W - 24, height: H * 0.65, borderRadius: 18, resizeMode: "cover" },
  overlay: {
    position: "absolute",
    width: W - 24,
    height: H * 0.65,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  uploaderRow: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  uploaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
  },
  uploaderAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#333" },
  uploaderName: { color: TXT, fontWeight: "800", fontSize: 13, maxWidth: W * 0.5 },
  uploaderSub: { color: TXT_DIM, fontSize: 11, maxWidth: W * 0.55 },

  playPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ACCENT,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  playPillTxt: { marginLeft: 6, color: "#0b0b0b", fontWeight: "800", fontSize: 12 },

  controls: {
    position: "absolute",
    bottom: 18,
    width: W - 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
  },
  ctrlBtn: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  swipeHint: {
    position: "absolute",
    bottom: 82,
    left: 0,
    right: 0,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  swipeHintText: { color: TXT_DIM, fontSize: 12, fontWeight: "700" },

  lockHint: {
    alignSelf: "center",
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    opacity: 0.8,
  },
  lockText: { color: TXT_DIM, fontSize: 12, fontWeight: "700" },

  reloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  reloadTxt: { color: "#0b0b0b", fontSize: 14, fontWeight: "700" },

  // 🔵 Modal Styles (klein & schlicht)
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    gap: 10,
  },
  modalTitle: { color: TXT, fontSize: 18, fontWeight: "800" },
  modalText: { color: TXT_DIM },
  modalRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 6 },
  modalBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, minWidth: 90, alignItems: "center" },
  modalBtnText: { fontWeight: "900" },
  btnAccent: { backgroundColor: ACCENT },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: BORDER },
});

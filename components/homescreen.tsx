// components/homescreen.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNavbar from "../components/bottomnavbar";
import TrackPlayButton from "../components/trackplaybutton";
import audio from "../server/lib/audiocontroller";

const { width: SCREEN_W } = Dimensions.get("window");

const BG = "#0b0b0b";
const CARD = "#141414";
const TXT = "#ffffff";
const TXT_DIM = "#bdbdbd";
const BORDER = "#1e1e1e";
const ACCENT = "#ff4fd8";

const API = "http://192.168.0.224:5000";

const http = axios.create({ baseURL: API, timeout: 15000 });

type TabKey = "music" | "artists" | "event" | "trending" | "playlist";
const TABS: {
  key: TabKey;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  { key: "music", label: "Musik", icon: "musical-notes-outline" },
  { key: "artists", label: "Artists", icon: "person-outline" },
  { key: "event", label: "Event", icon: "calendar-outline" },
  { key: "trending", label: "Trending", icon: "flame-outline" },
  { key: "playlist", label: "Meine Playlist", icon: "list-outline" },
];

type PublicUser = {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
};

export type FeedItem = {
  id: string;
  userId: string | null;
  title: string;
  url: string;
  cover?: string | null;
  createdAt: string;
  likes: number;
  plays: number;
  snippetStartMs: number | null;
  snippetDurationMs: number | null;
  hasLyrics: boolean;
  user?: PublicUser | null;
};

type ArtistCard = {
  id: string;
  username: string;
  avatarUrl: string | null;
  cover: string | null;
  trackCount: number;
};

const FALLBACK_AVATAR =
  "https://upload.wikimedia.org/wikipedia/commons/2/2c/Default_pfp.svg";

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=1200&auto=format&fit=crop";

const FALLBACK_COVER_ALT =
  "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=1200&auto=format&fit=crop";

const AnimatedTouchable =
  Animated.createAnimatedComponent(TouchableOpacity);

/* ───────────── Playlist-Typen & Storage-Helpers ───────────── */

type PlaylistStoredTrack = {
  id: string;
  title: string;
  url: string;
  cover?: string | null;
};

type StoredPlaylist = {
  id: string;
  name: string;
  cover?: string | null;
  createdAt: string;
  tracks: PlaylistStoredTrack[];
};

const PLAYLISTS_KEY = "playlists:v1";
const LEGACY_PLAYLIST_KEY = "playlist:default";

// ► Lädt Playlists oder legt eine Default-Playlist an (inkl. Migration von playlist:default)
async function loadOrInitPlaylists(): Promise<StoredPlaylist[]> {
  try {
    const raw = await AsyncStorage.getItem(PLAYLISTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as StoredPlaylist[];
    }

    // Migration: alter Key playlist:default
    let legacyTracks: PlaylistStoredTrack[] = [];
    const legacyRaw = await AsyncStorage.getItem(LEGACY_PLAYLIST_KEY);
    if (legacyRaw) {
      try {
        const arr = JSON.parse(legacyRaw);
        if (Array.isArray(arr)) {
          legacyTracks = arr.map((t: any) => ({
            id: String(t.id),
            title: String(t.title ?? "Unbenannter Track"),
            url: String(t.url),
            cover: t.cover ?? null,
          }));
        }
      } catch {
        legacyTracks = [];
      }
    }

    const defaultPlaylist: StoredPlaylist = {
      id: "default",
      name: "Favoriten",
      cover: legacyTracks[0]?.cover ?? null,
      createdAt: new Date().toISOString(),
      tracks: legacyTracks,
    };

    const initial = [defaultPlaylist];
    await AsyncStorage.setItem(PLAYLISTS_KEY, JSON.stringify(initial));
    return initial;
  } catch {
    return [];
  }
}

type AddTrackStatus = "added" | "duplicate" | "full";

type AddTrackResult = {
  status: AddTrackStatus;
  playlists: StoredPlaylist[];
};

// ► Fügt Track in erste Playlist (Favoriten) ein – mit 50er Limit
async function addTrackToDefaultPlaylist(
  track: PlaylistStoredTrack
): Promise<AddTrackResult> {
  const playlists = await loadOrInitPlaylists();
  let updated = [...playlists];

  if (!updated.length) {
    updated = [
      {
        id: "default",
        name: "Favoriten",
        cover: track.cover ?? null,
        createdAt: new Date().toISOString(),
        tracks: [],
      },
    ];
  }

  const first = updated[0];

  // ► Limit 50 Songs pro Playlist
  if (first.tracks.length >= 50) {
    return { status: "full", playlists: updated };
  }

  const exists = first.tracks.some((t) => t.id === track.id);

  if (!exists) {
    const newTracks = [...first.tracks, track];
    const newFirst: StoredPlaylist = {
      ...first,
      cover: first.cover ?? track.cover ?? null,
      tracks: newTracks,
    };
    updated[0] = newFirst;
    await AsyncStorage.setItem(PLAYLISTS_KEY, JSON.stringify(updated));
    return { status: "added", playlists: updated };
  }

  return { status: "duplicate", playlists: updated };
}

/* ───────────── HomeScreen ───────────── */

export default function HomeScreen() {
  const router = useRouter();

  const [index, setIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const pagerRef = useRef<ScrollView>(null);
  const chipsScrollRef = useRef<ScrollView>(null);

  const [me, setMe] = useState<PublicUser | null>(null);
  const avatar = me?.avatarUrl || FALLBACK_AVATAR;

  // Feeds
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [trending, setTrending] = useState<FeedItem[]>([]);
  const [recent, setRecent] = useState<FeedItem[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // Dummy Events (Platzhalter)
  const cards = useMemo(
    () =>
      Array.from({ length: 10 }).map((_, i) => ({
        id: String(i + 1),
        title: `Track #${i + 1}`,
        img: i % 2 === 0 ? FALLBACK_COVER : FALLBACK_COVER_ALT,
      })),
    []
  );

  // User laden
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("user");
        const local: any = raw ? JSON.parse(raw) : null;
        if (!alive) return;

        if (local?.id) {
          const user: PublicUser = {
            id: String(local.id),
            email: local.email || "",
            username: local.username || "",
            avatarUrl: local.avatarUrl ?? null,
          };
          setMe(user);
          try {
            const res = await http.get<{ user: PublicUser }>(
              `/users/${user.id}`
            );
            if (!alive) return;
            setMe(res.data.user);
            await AsyncStorage.setItem(
              "user",
              JSON.stringify(res.data.user)
            );
          } catch {
            // ignore
          }
        }
      } catch {
        setMe(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ───────────── Feed Loader ───────────── */

  const normalizeFeedItem = (raw: any): FeedItem => {
    const id = String(
      raw.id ||
        raw._id ||
        raw.uuid ||
        raw.key ||
        raw.filename ||
        Date.now().toString()
    );

    const pick = (...vals: any[]) =>
      vals.find((v) => v != null && v !== "");
    const toAbs = (v?: string | null) =>
      !v ? "" : /^https?:\/\//i.test(v) ? v : absolutize(v);

    const urlIn = pick(raw.absUrl, raw.url, raw.path, raw.relPath) ?? "";
    const coverIn =
      pick(raw.absCover, raw.cover, raw.coverUrl, raw.coverRelPath) ??
      null;

    const url = toAbs(urlIn);
    const cover = coverIn ? toAbs(coverIn) : null;

    const createdAt =
      raw.createdAt || raw.date || new Date().toISOString();

    const stats = raw.stats || {};
    const plays =
      typeof stats.plays === "number"
        ? stats.plays
        : typeof raw.plays === "number"
        ? raw.plays
        : typeof raw.playCount === "number"
        ? raw.playCount
        : 0;

    const likes =
      typeof stats.likes === "number"
        ? stats.likes
        : typeof raw.likes === "number"
        ? raw.likes
        : typeof raw.likesCount === "number"
        ? raw.likesCount
        : 0;

    return {
      id,
      userId: raw.userId ? String(raw.userId) : null,
      title: raw.title || raw.name || "Unbenannter Track",
      url,
      cover,
      createdAt,
      likes,
      plays,
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
      user: raw.user || null,
    };
  };

  async function ensureUsers(items: FeedItem[]): Promise<FeedItem[]> {
    const ids = Array.from(
      new Set(
        items
          .filter((t) => t.userId && !t.user)
          .map((t) => String(t.userId))
      )
    );
    if (!ids.length) return items;

    const map = new Map<string, PublicUser>();
    await Promise.all(
      ids.map(async (id) => {
        try {
          const r = await http.get<{ user: PublicUser }>(
            `/users/${id}`
          );
          if (r.data?.user) map.set(id, r.data.user);
        } catch {}
      })
    );

    return items.map((t) =>
      !t.user && t.userId && map.get(t.userId)
        ? { ...t, user: map.get(t.userId)! }
        : t
    );
  }

  const loadFeed = async () => {
    try {
      setLoadingFeed(true);
      const res = await http.get<{ items?: any[] }>("/music/feed");
      const arr = Array.isArray(res.data.items) ? res.data.items : [];
      const norm = arr.map(normalizeFeedItem);
      setFeed(await ensureUsers(norm));
    } catch (e) {
      console.warn(
        "feed load error",
        e instanceof Error ? e.message : e
      );
      setFeed([]);
    } finally {
      setLoadingFeed(false);
    }
  };

  const loadTrending = async () => {
    try {
      setLoadingTrending(true);
      const res = await http.get<{ items?: any[] }>(
        "/music/trending"
      );
      const arr = Array.isArray(res.data.items) ? res.data.items : [];
      const norm = arr.map(normalizeFeedItem);
      setTrending(await ensureUsers(norm));
    } catch (e) {
      console.warn(
        "trending load error",
        e instanceof Error ? e.message : e
      );
      setTrending([]);
    } finally {
      setLoadingTrending(false);
    }
  };

  const loadRecent = async () => {
    try {
      setLoadingRecent(true);
      const res = await http.get<{ items?: any[] }>("/music/recent");
      const arr = Array.isArray(res.data.items) ? res.data.items : [];
      const norm = arr.map(normalizeFeedItem);
      setRecent(await ensureUsers(norm));
    } catch (e) {
      console.warn(
        "recent load error",
        e instanceof Error ? e.message : e
      );
      setRecent([]);
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    loadFeed();
    loadTrending();
    loadRecent();
  }, []);

  // 🔥 Globale Playlist über ALLE Home-Tracks (Feed + Neu + Trending)
  const allTracks = useMemo<FeedItem[]>(() => {
    const merged = [...feed, ...recent, ...trending];
    const map = new Map<string, FeedItem>();
    for (const t of merged) {
      if (!t?.id) continue;
      if (!map.has(t.id)) {
        map.set(t.id, t);
      }
    }
    return Array.from(map.values());
  }, [feed, recent, trending]);

  // 🔥 Artists-Liste: nur User, die mindestens 1 Track in allTracks haben
  const artists = useMemo<ArtistCard[]>(() => {
    const map = new Map<string, ArtistCard>();

    for (const t of allTracks) {
      const uid = t.user?.id ?? t.userId;
      if (!uid) continue;

      const username =
        t.user?.username ||
        (t.userId ? `User ${t.userId.slice(0, 4)}…` : "Unbekannt");

      const avatarUrl = t.user?.avatarUrl ?? null;
      const cover = t.cover ?? null;

      const existing = map.get(uid);
      if (!existing) {
        map.set(uid, {
          id: uid,
          username,
          avatarUrl,
          cover,
          trackCount: 1,
        });
      } else {
        existing.trackCount += 1;
        if (!existing.cover && cover) {
          existing.cover = cover;
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.trackCount - a.trackCount
    );
  }, [allTracks]);

  const goTo = (i: number) => {
    setIndex(i);
    pagerRef.current?.scrollTo({ x: i * SCREEN_W, animated: true });
    chipsScrollRef.current?.scrollTo({
      x: Math.max(0, i * 90 - 50),
      animated: true,
    });
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(
      e.nativeEvent.contentOffset.x / SCREEN_W
    );
    if (i !== index) goTo(i);
  };

  const indicatorTranslate = scrollX.interpolate({
    inputRange: [0, SCREEN_W * (TABS.length - 1)],
    outputRange: [0, (TABS.length - 1) * 90],
    extrapolate: "clamp",
  });

  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "left", "right"]}
    >
      {/* Header – nur Avatar rechts */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => router.push("/profile")}
          activeOpacity={0.9}
          style={styles.avatarBtn}
        >
          <Image source={{ uri: avatar }} style={styles.avatarImg} />
        </TouchableOpacity>
      </View>

      {/* Kompakte Suche */}
      <View style={styles.searchRow}>
        <Ionicons
          name="search-outline"
          size={16}
          color={TXT_DIM}
        />
        <TextInput
          placeholder="Suche nach Sounds, Artists…"
          placeholderTextColor={TXT_DIM}
          style={styles.searchInput}
        />
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons
            name="options-outline"
            size={16}
            color={TXT}
          />
        </TouchableOpacity>
      </View>

      {/* Wischbare Tabs */}
      <View style={styles.tabbarWrap}>
        <ScrollView
          ref={chipsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14 }}
          bounces
          alwaysBounceVertical={false}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.chipIndicator,
              {
                transform: [
                  {
                    translateX: Animated.multiply(
                      indicatorTranslate,
                      1
                    ),
                  },
                ],
                width: 110,
              },
            ]}
          />
          {TABS.map((t, i) => {
            const active = i === index;
            const scale = scrollX.interpolate({
              inputRange: TABS.map((_, k) => k * SCREEN_W),
              outputRange: TABS.map((_, k) =>
                k === i ? 1 : 0.96
              ),
              extrapolate: "clamp",
            });
            return (
              <AnimatedTouchable
                key={t.key}
                style={[
                  styles.chip,
                  active && styles.chipActive,
                  { transform: [{ scale }] },
                ]}
                onPress={() => goTo(i)}
                activeOpacity={0.9}
              >
                <Ionicons
                  name={t.icon}
                  size={15}
                  color={active ? "#0b0b0b" : TXT_DIM}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.chipText,
                    active && styles.chipTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </AnimatedTouchable>
            );
          })}
        </ScrollView>
      </View>

      {/* Pager */}
      <Animated.ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        directionalLockEnabled
        alwaysBounceVertical={false}
        bounces={false}
      >
        {/* TAB 0: Musik / Feed */}
        <Page>
          <Hero title="Für dich" />
          <Section title="Dein Feed">
            <TrackGrid
              items={feed}
              allItems={allTracks}
              loading={loadingFeed}
              emptyText="Noch keine Musik im Feed"
            />
          </Section>
          <Section title="Neueste Drops">
            <TrackGrid
              items={recent}
              allItems={allTracks}
              loading={loadingRecent}
              emptyText="Noch keine neuen Tracks"
            />
          </Section>
          <BottomSpacer />
        </Page>

        {/* TAB 1: Artists – nur echte Accounts mit Musik */}
        <Page>
          <Hero icon="people-outline" title="Artists entdecken" />
          <Section title="Aufstrebend">
            <ArtistGrid artists={artists} />
          </Section>
          <BottomSpacer />
        </Page>

        {/* TAB 2: Events (Platzhalter) */}
        <Page>
          <Hero
            icon="calendar-outline"
            title="Bevorstehende Events"
          />
          <Section title="In deiner Nähe">
            <DummyGrid cards={cards.slice(0, 6)} />
          </Section>
          <BottomSpacer />
        </Page>

        {/* TAB 3: Trending */}
        <Page>
          <Hero icon="flame-outline" title="Trending" />
          <Section title="Gerade viral">
            <TrackGrid
              items={trending}
              allItems={allTracks}
              loading={loadingTrending}
              emptyText="Noch keine Trending-Tracks"
            />
          </Section>
          <BottomSpacer />
        </Page>

        {/* TAB 4: Meine Playlist */}
        <Page>
          <Hero icon="list-outline" title="Meine Playlist" />
          <PlaylistTab />
          <BottomSpacer />
        </Page>
      </Animated.ScrollView>

      <BottomNavbar />
    </SafeAreaView>
  );
}

/* ---------- Hilfsfunktionen & Unterkomponenten ---------- */

function Page({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={{ width: SCREEN_W }}
      contentContainerStyle={{ paddingBottom: 24 }}
      bounces={false}
      overScrollMode="never"
    >
      {children}
    </ScrollView>
  );
}

function Hero({
  title,
  icon = "musical-notes-outline",
}: {
  title: string;
  icon?: string;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroRow}>
        <Ionicons name={icon as any} size={18} color={TXT} />
        <Text style={styles.heroTitle}>{title}</Text>
      </View>
      <Text style={styles.heroSub}>
        Fresh drops, handpicked for you.
      </Text>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ paddingHorizontal: 14, marginTop: 6 }}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionMore}>Mehr</Text>
      </View>
      {children}
    </View>
  );
}

type MenuState = {
  track: FeedItem;
  playlist: FeedItem[];
  index: number;
  profileId: string | null;
} | null;

function TrackGrid({
  items,
  allItems,
  loading,
  emptyText,
}: {
  items: FeedItem[];
  allItems: FeedItem[];
  loading: boolean;
  emptyText: string;
}) {
  const router = useRouter();
  const [menuState, setMenuState] = useState<MenuState>(null);

  const openProfile = (uid?: string | null) => {
    if (!uid) return;
    router.push(`/profile/${String(uid)}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.loadingText}>Lade…</Text>
      </View>
    );
  }

  if (!items.length) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  // Playlist: gesamte Home-Playlist, sonst nur lokale items
  const playlist = allItems && allItems.length ? allItems : items;

  const handlePlayNow = async () => {
    if (!menuState) return;
    const { playlist, index } = menuState;
    const ac: any = audio;
    try {
      if (typeof ac.playFromQueue === "function") {
        await ac.playFromQueue(playlist, index);
      } else if (typeof ac.play === "function") {
        await ac.play(playlist[index]);
      }
    } catch {}
    setMenuState(null);
  };

  const handleNextTrack = async () => {
    const ac: any = audio;
    try {
      if (typeof ac.next === "function") {
        await ac.next();
      }
    } catch {}
    setMenuState(null);
  };

  const handleGoToProfile = () => {
    if (!menuState || !menuState.profileId) {
      setMenuState(null);
      return;
    }
    const id = menuState.profileId;
    setMenuState(null);
    router.push(`/profile/${id}`);
  };

  const handleAddToPlaylist = async () => {
    if (!menuState) return;
    try {
      const base = menuState.track;
      const { status } = await addTrackToDefaultPlaylist({
        id: base.id,
        title: base.title,
        url: base.url,
        cover: base.cover ?? null,
      });

      if (status === "added") {
        Alert.alert(
          "Playlist",
          "Track zu deiner Playlist hinzugefügt."
        );
      } else if (status === "duplicate") {
        Alert.alert(
          "Playlist",
          "Der Track ist bereits in deiner Playlist."
        );
      } else if (status === "full") {
        Alert.alert(
          "Playlist voll",
          "Diese Playlist hat schon 50 Songs. Lösche zuerst etwas oder erstelle eine neue Playlist."
        );
      }
    } catch (e) {
      Alert.alert(
        "Fehler",
        "Konnte den Track nicht zur Playlist hinzufügen."
      );
    }
    setMenuState(null);
  };

  const handleShare = async () => {
    if (!menuState) return;
    try {
      await Share.share({
        message: `Check diesen Track auf Ayosya: ${menuState.track.title}`,
      });
    } catch {}
    setMenuState(null);
  };

  return (
    <>
      <View style={styles.grid}>
        {items.map((t, idx) => {
          const profileId = t.user?.id ?? t.userId;
          const globalIndex = playlist.findIndex(
            (p) => p.id === t.id
          );
          const indexForQueue =
            globalIndex >= 0 ? globalIndex : idx;

          return (
            <View key={t.id} style={styles.card}>
              {/* ▶ Cover klickbar -> Profil */}
              <TouchableOpacity
                onPress={() => openProfile(profileId)}
                activeOpacity={0.88}
              >
                <Image
                  source={{ uri: t.cover || FALLBACK_COVER }}
                  style={styles.cardImg}
                />
              </TouchableOpacity>

              <View style={styles.cardOverlay}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {t.title}
                </Text>

                {/* Username klickbar */}
                <TouchableOpacity
                  onPress={() => openProfile(profileId)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.cardMeta, styles.cardLink]}>
                    {t.user?.username
                      ? `@${t.user.username}`
                      : t.userId
                      ? `User · ${t.userId.slice(0, 4)}…`
                      : "Unbekannter Artist"}
                  </Text>
                </TouchableOpacity>

                <View style={styles.cardFooterRow}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name="flame-outline"
                      size={12}
                      color={TXT_DIM}
                    />
                    <Text style={styles.cardMetaSmall}>
                      {" "}
                      {t.plays || 0} Plays · {t.likes || 0} Likes
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {/* Drei-Punkte-Menü */}
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.moreBtn}
                      onPress={() =>
                        setMenuState({
                          track: t,
                          playlist,
                          index: indexForQueue,
                          profileId: profileId
                            ? String(profileId)
                            : null,
                        })
                      }
                    >
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={18}
                        color={TXT_DIM}
                      />
                    </TouchableOpacity>

                    <TrackPlayButton
                      track={{
                        id: t.id,
                        title: t.title,
                        url: t.url,
                        cover: t.cover || undefined,
                        snippetStartMs:
                          t.snippetStartMs ?? undefined,
                        snippetDurationMs:
                          t.snippetDurationMs ?? undefined,
                        stats: {
                          plays: t.plays || 0,
                          likes: t.likes || 0,
                          saves: 0,
                        },
                      }}
                      playlist={playlist}
                      index={indexForQueue}
                      size={26}
                    />
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Bottom-Sheet Menü */}
      <Modal
        visible={!!menuState}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuState(null)}
      >
        <View style={styles.menuBackdrop}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setMenuState(null)}
          />

          <View style={styles.menuCard}>
            <View style={styles.menuHandle} />

            <Text style={styles.menuTitle} numberOfLines={1}>
              {menuState?.track.title || "Track-Optionen"}
            </Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handlePlayNow}
            >
              <Ionicons
                name="play-circle-outline"
                size={22}
                color={TXT}
              />
              <Text style={styles.menuItemText}>
                Jetzt abspielen
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleAddToPlaylist}
            >
              <Ionicons
                name="add-circle-outline"
                size={22}
                color={TXT}
              />
              <Text style={styles.menuItemText}>
                Zu Playlist hinzufügen
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleNextTrack}
            >
              <Ionicons
                name="play-skip-forward-outline"
                size={22}
                color={TXT}
              />
              <Text style={styles.menuItemText}>
                Nächster Titel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleShare}
            >
              <Ionicons
                name="share-outline"
                size={22}
                color={TXT}
              />
              <Text style={styles.menuItemText}>
                Titel teilen …
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleGoToProfile}
            >
              <Ionicons
                name="person-circle-outline"
                size={22}
                color={TXT}
              />
              <Text style={styles.menuItemText}>
                Zum Profil
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { marginTop: 4 }]}
              onPress={() => setMenuState(null)}
            >
              <Ionicons
                name="close-circle-outline"
                size={22}
                color={TXT}
              />
              <Text style={styles.menuItemText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// 🔥 Neuer Grid: nur Artists, die hochgeladen haben
function ArtistGrid({ artists }: { artists: ArtistCard[] }) {
  const router = useRouter();

  if (!artists.length) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.emptyText}>
          Noch keine Artists mit Uploads
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {artists.map((a) => (
        <TouchableOpacity
          key={a.id}
          style={styles.card}
          activeOpacity={0.9}
          onPress={() => router.push(`/profile/${a.id}`)}
        >
          <Image
            source={{
              uri: a.cover || a.avatarUrl || FALLBACK_COVER,
            }}
            style={styles.cardImg}
          />
          <View style={styles.cardOverlay}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <Image
                source={{
                  uri: a.avatarUrl || FALLBACK_AVATAR,
                }}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  marginRight: 6,
                }}
              />
              <Text style={styles.cardTitle} numberOfLines={1}>
                {a.username}
              </Text>
            </View>
            <Text style={styles.cardMeta}>
              {a.trackCount} Upload
              {a.trackCount === 1 ? "" : "s"}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function DummyGrid({
  cards,
}: {
  cards: { id: string; title: string; img: string }[];
}) {
  return (
    <View style={styles.grid}>
      {cards.map((c) => (
        <View key={c.id} style={styles.card}>
          <Image
            source={{ uri: c.img }}
            style={styles.cardImg}
          />
          <View style={styles.cardOverlay}>
            <Text style={styles.cardTitle}>{c.title}</Text>
            <Text style={styles.cardMeta}>Artist · 2:47</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function BottomSpacer() {
  return <View style={{ height: 90 }} />;
}

/* ───────────── Playlist-Tab (mit Ordnern + Löschen) ───────────── */

function PlaylistTab() {
  const [playlists, setPlaylists] = useState<StoredPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const list = await loadOrInitPlaylists();
      setPlaylists(list);
    } catch {
      Alert.alert("Fehler", "Playlist konnte nicht geladen werden.");
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlaylists();
  }, []);

  const savePlaylists = async (next: StoredPlaylist[]) => {
    setPlaylists(next);
    try {
      await AsyncStorage.setItem(
        PLAYLISTS_KEY,
        JSON.stringify(next)
      );
    } catch {}
  };

  const handleCreatePlaylist = async () => {
    const name = newName.trim() || "Neue Playlist";
    try {
      const current = await loadOrInitPlaylists();
      const newPlaylist: StoredPlaylist = {
        id: `${Date.now()}`,
        name,
        cover: null,
        createdAt: new Date().toISOString(),
        tracks: [],
      };
      const updated = [...current, newPlaylist];
      await AsyncStorage.setItem(
        PLAYLISTS_KEY,
        JSON.stringify(updated)
      );
      setPlaylists(updated);
      setNewName("");
      setShowCreateModal(false);
    } catch {
      Alert.alert("Fehler", "Playlist konnte nicht erstellt werden.");
    }
  };

  const selected = playlists.find((p) => p.id === selectedId);

  const confirmDeletePlaylist = (pl: StoredPlaylist) => {
    Alert.alert(
      "Playlist löschen",
      `„${pl.name}“ wirklich löschen?`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            const next = playlists.filter((p) => p.id !== pl.id);
            if (selectedId === pl.id) setSelectedId(null);
            await savePlaylists(next);
          },
        },
      ]
    );
  };

  const confirmRemoveTrack = (trackId: string) => {
    if (!selected) return;
    Alert.alert(
      "Track entfernen",
      "Diesen Track aus der Playlist entfernen?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Entfernen",
          style: "destructive",
          onPress: async () => {
            const next = playlists.map((pl) => {
              if (pl.id !== selected.id) return pl;
              const newTracks = pl.tracks.filter((t) => t.id !== trackId);
              const newCover =
                newTracks.length > 0
                  ? newTracks[0].cover || pl.cover || null
                  : null;
              return {
                ...pl,
                tracks: newTracks,
                cover: newCover,
              };
            });
            await savePlaylists(next);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.loadingText}>Lade Playlists…</Text>
      </View>
    );
  }

  // ▶ Ansicht: Tracks in einer Playlist
  if (selected) {
    const tracks = selected.tracks;

    if (!tracks.length) {
      return (
        <View style={{ paddingHorizontal: 14, marginTop: 6 }}>
          <View style={styles.playlistHeaderRow}>
            <TouchableOpacity
              style={styles.playlistBackBtn}
              onPress={() => setSelectedId(null)}
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={TXT}
              />
            </TouchableOpacity>
            <Text
              style={styles.playlistHeaderTitle}
              numberOfLines={1}
            >
              {selected.name}
            </Text>
            <View style={{ width: 32 }} />
          </View>

          <View style={styles.loadingBox}>
            <Text style={styles.emptyText}>
              Diese Playlist ist noch leer.
            </Text>
            <Text style={styles.cardMetaSmall}>
              Füge Songs über das Drei-Punkte-Menü im Feed hinzu.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={{ paddingHorizontal: 14, marginTop: 6 }}>
        <View style={styles.playlistHeaderRow}>
          <TouchableOpacity
            style={styles.playlistBackBtn}
            onPress={() => setSelectedId(null)}
          >
            <Ionicons name="chevron-back" size={18} color={TXT} />
          </TouchableOpacity>
          <Text
            style={styles.playlistHeaderTitle}
            numberOfLines={1}
          >
            {selected.name}
          </Text>
          <View style={{ width: 32 }} />
        </View>

        {tracks.map((t, idx) => (
          <View key={`${t.id}-${idx}`} style={styles.playlistRow}>
            <Image
              source={{ uri: t.cover || FALLBACK_COVER }}
              style={styles.playlistCover}
            />
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text
                style={styles.playlistTitle}
                numberOfLines={1}
              >
                {t.title}
              </Text>
              <Text style={styles.cardMetaSmall}>
                Track #{idx + 1}
              </Text>
            </View>
            <TrackPlayButton
              track={{
                id: t.id,
                title: t.title,
                url: t.url,
                cover: t.cover || undefined,
              }}
              playlist={tracks as any}
              index={idx}
              size={30}
            />
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => confirmRemoveTrack(t.id)}
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color="#ff6b81"
              />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  }

  // ▶ Ansicht: Playlist-Ordner
  if (!playlists.length) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.emptyText}>
          Noch keine Playlists angelegt.
        </Text>
        <Text style={styles.cardMetaSmall}>
          Erstelle deine erste Playlist unten.
        </Text>

        <TouchableOpacity
          style={styles.createPlaylistBtn}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color="#000" />
          <Text style={styles.createPlaylistText}>
            Neue Playlist erstellen
          </Text>
        </TouchableOpacity>

        {/* Create Modal */}
        <CreatePlaylistModal
          visible={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          name={newName}
          setName={setNewName}
          onCreate={handleCreatePlaylist}
        />
      </View>
    );
  }

  return (
    <>
      <View style={{ paddingHorizontal: 14, marginTop: 6 }}>
        <View style={styles.playlistHeaderRow}>
          <Text style={styles.playlistHeaderTitle}>
            Deine Playlists
          </Text>
          <TouchableOpacity
            style={styles.playlistAddBtn}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={18} color="#000" />
          </TouchableOpacity>
        </View>

        <View style={styles.playlistGrid}>
          {playlists.map((pl) => {
            const cover =
              pl.cover ||
              pl.tracks[0]?.cover ||
              FALLBACK_COVER;
            return (
              <TouchableOpacity
                key={pl.id}
                style={styles.playlistFolderCard}
                activeOpacity={0.9}
                onPress={() => setSelectedId(pl.id)}
                onLongPress={() => confirmDeletePlaylist(pl)}
              >
                <Image
                  source={{ uri: cover }}
                  style={styles.playlistFolderCover}
                />
                <View style={styles.playlistFolderOverlay} />
                <View style={styles.playlistFolderInfo}>
                  <Text
                    style={styles.playlistFolderName}
                    numberOfLines={1}
                  >
                    {pl.name}
                  </Text>
                  <Text style={styles.playlistFolderMeta}>
                    {pl.tracks.length} Track
                    {pl.tracks.length === 1 ? "" : "s"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Create Modal */}
      <CreatePlaylistModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        name={newName}
        setName={setNewName}
        onCreate={handleCreatePlaylist}
      />
    </>
  );
}

/* ───────────── Create-Playlist-Modal ───────────── */

function CreatePlaylistModal({
  visible,
  onClose,
  name,
  setName,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  name: string;
  setName: (v: string) => void;
  onCreate: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.createModalBackdrop}>
        <View style={styles.createModalCard}>
          <Text style={styles.createModalTitle}>
            Neue Playlist erstellen
          </Text>
          <TextInput
            style={styles.createModalInput}
            placeholder="Playlist-Name"
            placeholderTextColor="#777"
            value={name}
            onChangeText={setName}
          />

          <View style={styles.createModalButtonsRow}>
            <TouchableOpacity
              style={styles.createModalCancel}
              onPress={onClose}
            >
              <Text style={styles.createModalCancelText}>
                Abbrechen
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.createModalCreate}
              onPress={onCreate}
            >
              <Text style={styles.createModalCreateText}>
                Erstellen
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function absolutize(rel: string): string {
  if (!rel) return "";
  if (/^https?:\/\//i.test(rel)) return rel;
  const base = API.replace(/\/$/, "");
  const clean = rel.replace(/^\/+/, "");
  return `${base}/${clean}`;
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 6,
    alignItems: "center",
  },

  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  avatarImg: { width: "100%", height: "100%" },

  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },

  searchRow: {
    marginHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: BORDER,
  },
  searchInput: { flex: 1, color: TXT, fontSize: 13 },

  tabbarWrap: { marginTop: 10, position: "relative" },

  chip: {
    height: 34,
    paddingHorizontal: 14,
    marginRight: 12,
    borderRadius: 17,
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: 110,
  },
  chipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
    shadowColor: ACCENT,
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 8,
  },
  chipText: { color: TXT_DIM, fontWeight: "800", fontSize: 12 },
  chipTextActive: { color: "#0b0b0b", fontWeight: "900" },

  chipIndicator: {
    position: "absolute",
    left: 14,
    top: 0,
    bottom: 0,
    borderRadius: 18,
    backgroundColor: "rgba(255,79,216,0.20)",
  },

  hero: {
    marginTop: 14,
    marginHorizontal: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#12121a",
    borderWidth: 1,
    borderColor: "#1e1e2a",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  heroTitle: { color: TXT, fontSize: 18, fontWeight: "800" },
  heroSub: { color: TXT_DIM, fontSize: 12 },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 10,
    alignItems: "center",
  },
  sectionTitle: { color: TXT, fontSize: 18, fontWeight: "800" },
  sectionMore: { color: TXT_DIM, fontWeight: "700" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "48%",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardImg: { width: "100%", aspectRatio: 1 },
  cardOverlay: { padding: 10 },
  cardTitle: { color: TXT, fontWeight: "800" },

  cardMeta: { color: TXT_DIM, marginTop: 2, fontSize: 12 },
  cardLink: {
    color: ACCENT,
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
  },

  cardMetaSmall: { color: TXT_DIM, fontSize: 11 },

  cardFooterRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  loadingBox: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: TXT, fontWeight: "700" },
  emptyText: { color: TXT_DIM, fontSize: 12 },

  // Menü-Styles
  moreBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  menuCard: {
    backgroundColor: "#111",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  menuHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#555",
    marginBottom: 10,
  },
  menuTitle: {
    color: TXT,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  menuItemText: {
    marginLeft: 10,
    color: TXT,
    fontSize: 14,
  },

  // Playlist-Tab Rows & Ordner
  playlistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#1d1d1d",
  },
  playlistCover: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: CARD,
    marginRight: 10,
  },
  playlistTitle: {
    color: TXT,
    fontSize: 14,
    fontWeight: "700",
  },

  playlistHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  playlistHeaderTitle: {
    color: TXT,
    fontSize: 16,
    fontWeight: "800",
  },
  playlistBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: BORDER,
  },
  playlistAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT,
  },

  playlistGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  playlistFolderCard: {
    width: "48%",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  playlistFolderCover: {
    width: "100%",
    aspectRatio: 1,
  },
  playlistFolderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  playlistFolderInfo: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
  },
  playlistFolderName: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },
  playlistFolderMeta: {
    color: "#ddd",
    fontSize: 11,
  },

  createPlaylistBtn: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  createPlaylistText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 13,
  },

  // Create-Playlist-Modal
  createModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  createModalCard: {
    width: "85%",
    borderRadius: 18,
    backgroundColor: "#111",
    padding: 16,
  },
  createModalTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  createModalInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333",
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#fff",
    fontSize: 14,
    marginBottom: 12,
  },
  createModalButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  createModalCancel: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  createModalCancelText: {
    color: "#aaa",
    fontSize: 13,
  },
  createModalCreate: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  createModalCreateText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 13,
  },

  removeBtn: {
    marginLeft: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
});

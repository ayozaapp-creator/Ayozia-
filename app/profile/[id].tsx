// app/profile/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AudioMiniPlayer from "../../components/audiominiplayer";
import TrackPlayButton from "../../components/trackplaybutton";

const API = "http://192.168.0.224:5000";
const http = axios.create({ baseURL: API, timeout: 15000 });

type PublicUser = {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  bio?: string;
  isVerified?: boolean;
  createdAt?: string | null;
};

type Relations = {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isSelf: boolean;
};

type ActiveTab = "images" | "snippets" | "music";

type ImageItem = {
  id: string;
  userId: string;
  url: string;
  createdAt?: string;
};

type TrackItem = {
  id: string;
  userId: string | null;
  title: string;
  url: string;
  cover?: string | null;
  createdAt?: string | null;
  durationMs?: number | null;
  snippetStartMs?: number | null;
  snippetDurationMs?: number | null;
};

type SnippetItem = {
  id: string;
  musicId?: string;
  userId: string | null;
  title: string;
  url: string;
  thumbnail?: string | null;
  createdAt?: string | null;
  startMs?: number | null;
  durationMs?: number | null;
};

const BG = "#0b0b0b";
const CARD = "#111";
const BORDER = "#1e1e1e";
const TXT = "#fff";
const TXT_DIM = "#bdbdbd";
const ACCENT = "#ff4fd8";

const FALLBACK_AVATAR =
  "https://upload.wikimedia.org/wikipedia/commons/2/2c/Default_pfp.svg";
const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=1200&auto=format&fit=crop";

function absolutize(rel?: string | null): string {
  if (!rel) return "";
  if (/^https?:\/\//i.test(rel)) return rel;
  const base = API.replace(/\/$/, "");
  const clean = rel.replace(/^\/+/, "");
  if (/^(uploads\/|music\/|covers\/)/i.test(clean)) return `${base}/${clean}`;
  return `${base}/${clean}`;
}

export default function ProfileById() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    username?: string;
  }>();

  const id = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const router = useRouter();
  const alive = useRef(true);

  const [viewer, setViewer] = useState<PublicUser | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [rel, setRel] = useState<Relations>({
    followersCount: 0,
    followingCount: 0,
    isFollowing: false,
    isSelf: false,
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>("images");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [snippets, setSnippets] = useState<SnippetItem[]>([]);
  const [tracks, setTracks] = useState<TrackItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [snippetsLoading, setSnippetsLoading] = useState(false);
  const [tracksLoading, setTracksLoading] = useState(false);

  const [listOpen, setListOpen] = useState<null | "followers" | "following">(
    null
  );
  const [followersList, setFollowersList] = useState<PublicUser[]>([]);
  const [followingList, setFollowingList] = useState<PublicUser[]>([]);
  const [listBusy, setListBusy] = useState(false);

  // 🔥 Story-Info
  const [hasStories, setHasStories] = useState(false);

  const loadViewer = useCallback(async (): Promise<PublicUser | null> => {
    const keys = ["user", "@user", "ayo_user", "auth_user"];
    for (const k of keys) {
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      try {
        const j = JSON.parse(raw);
        const u = j?.user?.id ? j.user : j;
        if (u?.id) {
          return {
            id: String(u.id),
            email: u.email || "",
            username: u.username || "",
            avatarUrl: u.avatarUrl ?? null,
            bio: u.bio ?? "",
            isVerified: !!u.isVerified,
            createdAt: u.createdAt ?? null,
          };
        }
      } catch {}
    }
    return null;
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!id) return;

    const v = await loadViewer();
    const uRes = await http.get<{ user: PublicUser }>(`/users/${id}`);

    if (!alive.current) return;

    setViewer(v);
    setUser(uRes.data.user);

    // Relations laden
    try {
      const r = await http.get<Relations>(`/users/${id}/relations`, {
        params: { viewer: v?.id || "" },
      });
      alive.current && setRel(r.data);
    } catch {
      alive.current &&
        setRel({
          followersCount: 0,
          followingCount: 0,
          isFollowing: false,
          isSelf: v?.id === id,
        });
    }

    // ✅ Stories für diesen User laden
    try {
      const base = API.replace(/\/$/, "");
      const res = await fetch(
        `${base}/stories/users/${id}?viewer=${v?.id || ""}`
      );
      if (!res.ok) {
        setHasStories(false);
      } else {
        const json = await res.json();
        const arr = (json?.stories || json || []) as any[];
        setHasStories(arr.length > 0);
      }
    } catch {
      setHasStories(false);
    }
  }, [id, loadViewer]);

  const loadImages = useCallback(async () => {
    if (!id) return;
    setImagesLoading(true);
    try {
      const r = await http.get<{ images?: ImageItem[] }>(
        `/users/${id}/images`
      );
      const arr = Array.isArray(r.data.images) ? r.data.images : [];
      setImages(arr.map((im) => ({ ...im, url: absolutize(im.url) })));
    } catch {
      setImages([]);
    } finally {
      setImagesLoading(false);
    }
  }, [id]);

  const loadTracks = useCallback(async () => {
    if (!id) return;
    setTracksLoading(true);
    try {
      const r = await http.get<{ music?: any[]; items?: any[] }>(
        `/users/${id}/music`
      );
      const src = Array.isArray(r.data.music)
        ? r.data.music
        : Array.isArray(r.data.items)
        ? r.data.items
        : [];
      const out: TrackItem[] = src
        .map((raw) => {
          const url = absolutize(
            raw.absUrl || raw.url || raw.path || raw.relPath || ""
          );
          const coverRaw =
            raw.absCover ||
            raw.cover ||
            raw.coverUrl ||
            raw.coverRelPath ||
            null;
          const cover = coverRaw ? absolutize(coverRaw) : null;
          return {
            id: String(raw.id || raw._id || raw.uuid || Date.now()),
            userId: raw.userId ? String(raw.userId) : String(id),
            title: raw.title || raw.name || "Unbenannter Track",
            url,
            cover,
            createdAt: raw.createdAt || null,
            durationMs: raw.durationMs ?? null,
            snippetStartMs: raw.snippetStartMs ?? raw.snippet_start_ms ?? null,
            snippetDurationMs:
              raw.snippetDurationMs ?? raw.snippet_duration_ms ?? null,
          };
        })
        .filter((t) => !!t.url);
      setTracks(out);
    } catch {
      setTracks([]);
    } finally {
      setTracksLoading(false);
    }
  }, [id]);

  // 🔄 NEU: Snippets unabhängig von tracks/loadTracks
  const loadSnippets = useCallback(async () => {
    if (!id) return;
    setSnippetsLoading(true);
    try {
      const r = await http.get<{ snippets?: any[] }>(
        `/users/${id}/snippets`
      );
      const arr = Array.isArray(r.data.snippets) ? r.data.snippets : [];

      if (arr.length) {
        const norm: SnippetItem[] = arr
          .map((raw) => {
            const url = absolutize(
              raw.absUrl || raw.url || raw.path || raw.relPath || ""
            );
            const thumbRaw =
              raw.thumbnail ||
              raw.cover ||
              raw.absCover ||
              raw.coverRelPath ||
              null;
            const thumbnail = thumbRaw ? absolutize(thumbRaw) : null;
            const start =
              typeof raw.startMs === "number"
                ? raw.startMs
                : typeof raw.snippetStartMs === "number"
                ? raw.snippetStartMs
                : 0;
            const duration =
              typeof raw.durationMs === "number"
                ? raw.durationMs
                : typeof raw.snippetDurationMs === "number"
                ? raw.snippetDurationMs
                : 30000;

            return {
              id: String(raw.id || raw._id || raw.uuid || Date.now()),
              musicId: raw.musicId ? String(raw.musicId) : undefined,
              userId: raw.userId ? String(raw.userId) : String(id),
              title: raw.title || "Snippet",
              url,
              thumbnail,
              createdAt: raw.createdAt || null,
              startMs: start,
              durationMs: duration,
            };
          })
          .filter((s) => !!s.url);

        setSnippets(norm);
        return;
      }

      // Fallback: Musik direkt laden und daraus Snippets bauen
      const rMusic = await http.get<{ music?: any[]; items?: any[] }>(
        `/users/${id}/music`
      );
      const src = Array.isArray(rMusic.data.music)
        ? rMusic.data.music
        : Array.isArray(rMusic.data.items)
        ? rMusic.data.items
        : [];
      const tracksAsSnippets: SnippetItem[] = src
        .map((raw) => {
          const url = absolutize(
            raw.absUrl || raw.url || raw.path || raw.relPath || ""
          );
          const coverRaw =
            raw.absCover ||
            raw.cover ||
            raw.coverUrl ||
            raw.coverRelPath ||
            null;
          const cover = coverRaw ? absolutize(coverRaw) : null;

          return {
            id: `snip-${String(raw.id || raw._id || raw.uuid || Date.now())}`,
            musicId: String(raw.id || raw._id || raw.uuid || Date.now()),
            userId: raw.userId ? String(raw.userId) : String(id),
            title: raw.title || raw.name || "Snippet",
            url,
            thumbnail: cover,
            createdAt: raw.createdAt || null,
            startMs: raw.snippetStartMs ?? 0,
            durationMs: raw.snippetDurationMs ?? 30000,
          };
        })
        .filter((s) => !!s.url);

      setSnippets(tracksAsSnippets);
    } catch {
      setSnippets([]);
    } finally {
      setSnippetsLoading(false);
    }
  }, [id]);

  const openFollowers = useCallback(async () => {
    if (!id) return;
    setListOpen("followers");
    setListBusy(true);
    try {
      const r = await http.get<{ followers: PublicUser[] }>(
        `/users/${id}/followers`
      );
      setFollowersList(
        (r.data.followers || []).map((u) => ({
          ...u,
          avatarUrl: u.avatarUrl ?? null,
        }))
      );
    } catch {
      setFollowersList([]);
    } finally {
      setListBusy(false);
    }
  }, [id]);

  const openFollowing = useCallback(async () => {
    if (!id) return;
    setListOpen("following");
    setListBusy(true);
    try {
      const r = await http.get<{ following: PublicUser[] }>(
        `/users/${id}/following`
      );
      setFollowingList(
        (r.data.following || []).map((u) => ({
          ...u,
          avatarUrl: u.avatarUrl ?? null,
        }))
      );
    } catch {
      setFollowingList([]);
    } finally {
      setListBusy(false);
    }
  }, [id]);

  const toggleFollow = useCallback(async () => {
    if (!viewer?.id || !user?.id || viewer.id === user.id) return;
    try {
      if (rel.isFollowing) {
        await http.post("/unfollow", { fromId: viewer.id, toId: user.id });
        setRel((r) => ({
          ...r,
          isFollowing: false,
          followersCount: Math.max(0, r.followersCount - 1),
        }));
      } else {
        await http.post("/follow", { fromId: viewer.id, toId: user.id });
        setRel((r) => ({
          ...r,
          isFollowing: true,
          followersCount: r.followersCount + 1,
        }));
      }
    } catch (e: any) {
      Alert.alert(
        "Fehler",
        e?.response?.data?.message || e?.message || "Aktion fehlgeschlagen."
      );
    }
  }, [viewer?.id, user?.id, rel.isFollowing]);

  const handleMessagePress = useCallback(() => {
    if (!user?.id) return;

    router.push({
      pathname: "/chat/[id]",
      params: {
        id: user.id,
        username: user.username || "",
      },
    });
  }, [router, user]);

  const doRefresh = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      await fetchProfile();
      await Promise.all([loadImages(), loadSnippets(), loadTracks()]);
    } finally {
      setRefreshing(false);
    }
  }, [id, fetchProfile, loadImages, loadSnippets, loadTracks]);

  // ❌ Loop-Fix: nur von id abhängig
  useEffect(() => {
    if (!id) return;
    alive.current = true;

    (async () => {
      try {
        setLoading(true);
        await fetchProfile();
        await Promise.all([loadImages(), loadSnippets(), loadTracks()]);
      } catch (e: any) {
        Alert.alert(
          "Fehler",
          e?.response?.data?.message ||
            e?.message ||
            "Profil konnte nicht geladen werden."
        );
      } finally {
        alive.current && setLoading(false);
      }
    })();

    return () => {
      alive.current = false;
    };
    // nur id – keine Functions, damit kein Dauer-Reload
  }, [id]);

  // Tabs nachladen, ohne die Callbacks in den deps
  useEffect(() => {
    if (!id) return;
    if (activeTab === "images") {
      loadImages();
    } else if (activeTab === "snippets") {
      loadSnippets();
    } else if (activeTab === "music") {
      loadTracks();
    }
  }, [activeTab, id, loadImages, loadSnippets, loadTracks]);

  const Header = () => (
    <View style={styles.headerWrap} pointerEvents="box-none">
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          activeOpacity={0.9}
        >
          <Ionicons name="chevron-back" size={20} color={TXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          @{user?.username || "User"}
        </Text>
        <View style={styles.iconBtn}>
          <Ionicons name="notifications-outline" size={20} color={TXT} />
        </View>
      </View>

      <View style={styles.heroRow}>
        {/* 🔥 Avatar + Story-Ring + Klick öffnet Story-Viewer */}
        <TouchableOpacity
          activeOpacity={hasStories ? 0.9 : 1}
          onPress={() => {
            if (!hasStories || !user?.id) return;
            router.push({
              pathname: "/stories/[userId]",
              params: { userId: String(user.id) },
            });
          }}
        >
          <View
            style={[
              styles.avatarWrap,
              hasStories && styles.avatarHasStories,
            ]}
          >
            <Image
              source={{
                uri: user?.avatarUrl || FALLBACK_AVATAR,
              }}
              style={styles.avatarImg}
            />
          </View>
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.nameTxt} numberOfLines={1}>
            {user?.username || "Unbekannt"}
          </Text>
          <Text style={styles.bioTxt} numberOfLines={2}>
            {user?.bio || "—"}
          </Text>
        </View>

        {!!viewer?.id && viewer.id !== user?.id && (
          <TouchableOpacity
            onPress={toggleFollow}
            activeOpacity={0.9}
            style={[
              styles.followBtn,
              rel.isFollowing ? styles.followed : styles.toFollow,
            ]}
          >
            <Text
              style={[
                styles.followTxt,
                rel.isFollowing && { color: TXT },
              ]}
            >
              {rel.isFollowing ? "Gefolgt" : "Folgen"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statsLeftRow}>
          <TouchableOpacity
            onPress={openFollowers}
            activeOpacity={0.85}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.statNum}>{rel.followersCount}</Text>
            <Text style={styles.statLbl}>Follower</Text>
          </TouchableOpacity>
          <View style={styles.statDot} />
          <TouchableOpacity
            onPress={openFollowing}
            activeOpacity={0.85}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.statNum}>{rel.followingCount}</Text>
            <Text style={styles.statLbl}>Following</Text>
          </TouchableOpacity>
        </View>

        {!!viewer?.id && viewer.id !== user?.id && (
          <TouchableOpacity
            onPress={handleMessagePress}
            activeOpacity={0.9}
            style={styles.messageBtn}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={16}
              color={TXT}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.messageTxt}>Nachricht</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabsRow}>
        <TabChip
          label="Bilder"
          icon="images-outline"
          active={activeTab === "images"}
          onPress={() => setActiveTab("images")}
        />
        <TabChip
          label="Snippets"
          icon="musical-note-outline"
          active={activeTab === "snippets"}
          onPress={() => setActiveTab("snippets")}
        />
        <TabChip
          label="Musik"
          icon="headset-outline"
          active={activeTab === "music"}
          onPress={() => setActiveTab("music")}
        />
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <View style={styles.center}>
          <ActivityIndicator color={TXT} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {activeTab === "images" && (
        <FlatList
          key="images"
          data={images}
          keyExtractor={(it) => it.id}
          ListHeaderComponent={Header}
          ListEmptyComponent={
            imagesLoading ? (
              <View style={styles.empty}>
                <ActivityIndicator color={TXT} />
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={{ color: "#777" }}>Noch keine Bilder</Text>
              </View>
            )
          }
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 12, gap: 12 }}
          renderItem={({ item }) => (
            <View style={styles.imageCard}>
              <Image
                source={{ uri: item.url }}
                style={{ width: "100%", aspectRatio: 1 }}
                resizeMode="cover"
              />
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 90 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={doRefresh}
              tintColor={TXT}
            />
          }
          removeClippedSubviews
          windowSize={9}
          initialNumToRender={6}
        />
      )}

      {activeTab === "snippets" && (
        <FlatList
          key="snippets"
          data={snippets}
          keyExtractor={(it) => it.id}
          ListHeaderComponent={Header}
          ListEmptyComponent={
            snippetsLoading ? (
              <View style={styles.empty}>
                <ActivityIndicator color={TXT} />
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={{ color: "#777" }}>Noch keine Snippets</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.snippetCard}>
              <Image
                source={{ uri: item.thumbnail || FALLBACK_COVER }}
                style={{ width: "100%", aspectRatio: 1 }}
              />
              <View style={styles.snippetRow}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: TXT, fontWeight: "900" }}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text style={{ color: TXT_DIM, marginTop: 2 }}>
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleDateString()
                      : ""}
                  </Text>
                </View>
                <TrackPlayButton
                  track={{
                    id: item.musicId || item.id,
                    title: item.title,
                    url: item.url,
                    cover: item.thumbnail || undefined,
                    snippetStartMs: item.startMs ?? 0,
                    snippetDurationMs: item.durationMs ?? 30000,
                  }}
                  size={38}
                />
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 90 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={doRefresh}
              tintColor={TXT}
            />
          }
          removeClippedSubviews
          windowSize={9}
          initialNumToRender={6}
        />
      )}

      {activeTab === "music" && (
        <FlatList
          key="music"
          data={tracks}
          keyExtractor={(it) => it.id}
          ListHeaderComponent={Header}
          ListEmptyComponent={
            tracksLoading ? (
              <View style={styles.empty}>
                <ActivityIndicator color={TXT} />
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={{ color: "#777" }}>Noch keine Musik</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.trackCard}>
              <Image
                source={{ uri: item.cover || FALLBACK_COVER }}
                style={styles.trackCover}
              />
              <View
                style={{
                  flex: 1,
                  paddingVertical: 6,
                  paddingRight: 8,
                }}
              >
                <TouchableOpacity
                  onPress={() => router.push(`/profile/${user?.id}`)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.trackMeta} numberOfLines={1}>
                    @{user?.username || "user"}
                  </Text>
                </TouchableOpacity>
              </View>
              <TrackPlayButton
                track={{
                  id: item.id,
                  title: item.title,
                  url: item.url,
                  cover: item.cover || undefined,
                }}
                size={30}
              />
            </View>
          )}
          contentContainerStyle={{
            paddingBottom: 90,
            paddingHorizontal: 12,
            gap: 12,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={doRefresh}
              tintColor={TXT}
            />
          }
          removeClippedSubviews
          windowSize={9}
          initialNumToRender={8}
        />
      )}

      <AudioMiniPlayer />

      <Modal
        visible={!!listOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setListOpen(null)}
      >
        <View style={styles.modalBg}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject as any}
            activeOpacity={1}
            onPress={() => setListOpen(null)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {listOpen === "followers" ? "Follower" : "Following"}
            </Text>
            {listBusy ? (
              <View
                style={{ paddingVertical: 12, alignItems: "center" }}
              >
                <ActivityIndicator color={TXT} />
              </View>
            ) : (
              <FlatList
                data={
                  listOpen === "followers"
                    ? followersList
                    : followingList
                }
                keyExtractor={(u) => u.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setListOpen(null);
                      router.push(`/profile/${item.id}`);
                    }}
                    activeOpacity={0.9}
                    style={styles.userRow}
                  >
                    <Image
                      source={{
                        uri: item.avatarUrl || FALLBACK_AVATAR,
                      }}
                      style={styles.userAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ color: TXT, fontWeight: "900" }}
                        numberOfLines={1}
                      >
                        @{item.username || "user"}
                      </Text>
                      <Text
                        style={{ color: TXT_DIM }}
                        numberOfLines={1}
                      >
                        {item.email}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#888"
                    />
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => (
                  <View style={{ height: 10 }} />
                )}
                contentContainerStyle={{ paddingBottom: 8 }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function TabChip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Ionicons
        name={icon}
        size={14}
        color={active ? "#0b0b0b" : TXT_DIM}
        style={{ marginRight: 6 }}
      />
      <Text
        style={[styles.chipTxt, active && styles.chipTxtActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { paddingVertical: 24, alignItems: "center" },

  headerWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: "#050505",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  headerTitle: {
    color: TXT,
    fontWeight: "900",
    fontSize: 16,
    maxWidth: "68%",
  },

  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: BORDER,
  },

  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 10,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    backgroundColor: "#111",
    borderWidth: 2,
    borderColor: BORDER,
  },
  avatarHasStories: {
    borderColor: ACCENT,
    shadowColor: ACCENT,
    shadowOpacity: 0.8,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  avatarImg: { width: "100%", height: "100%" },
  nameTxt: { color: TXT, fontSize: 18, fontWeight: "900" },
  bioTxt: { color: TXT_DIM, marginTop: 4 },

  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    marginLeft: 8,
  },
  toFollow: { backgroundColor: ACCENT, borderColor: ACCENT },
  followed: { backgroundColor: "#1c1c1c", borderColor: BORDER },
  followTxt: { color: "#0b0b0b", fontWeight: "900" },

  statsRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statsLeftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statNum: {
    color: TXT,
    fontWeight: "900",
    fontSize: 16,
    textAlign: "center",
  },
  statLbl: {
    color: TXT_DIM,
    fontWeight: "700",
    textAlign: "center",
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#333",
    marginHorizontal: 8,
  },

  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ACCENT,
    backgroundColor: "#151515",
  },
  messageTxt: {
    color: TXT,
    fontWeight: "800",
    fontSize: 12,
  },

  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    marginBottom: 4,
  },
  chip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
  },
  chipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
    shadowColor: ACCENT,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  chipTxt: { color: TXT_DIM, fontWeight: "800", fontSize: 12 },
  chipTxtActive: { color: "#0b0b0b", fontWeight: "900" },

  imageCard: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
  },

  snippetCard: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  snippetRow: {
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  trackCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 6,
  },
  trackCover: {
    width: 58,
    height: 58,
    borderRadius: 10,
    backgroundColor: "#222",
    marginRight: 10,
  },
  trackTitle: { color: TXT, fontWeight: "900" },
  trackMeta: { color: TXT_DIM, marginTop: 2 },

  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxHeight: "75%",
    backgroundColor: "#101010",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  modalTitle: {
    color: TXT,
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f0f0f",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 8,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: "#222",
  },
});

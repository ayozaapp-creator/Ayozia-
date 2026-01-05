// app/profile/index.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Link, useFocusEffect, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AudioMiniPlayer from "../../components/audiominiplayer";
import SnippetPlayerButton from "../../components/snippetplayerbutton";
import TrackPlayButton from "../../components/trackplaybutton";

type PublicUser = {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  bio?: string;
  isVerified: boolean;
  createdAt: string | null;
};

type Relations = {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isSelf: boolean;
};

type UploadTab = "snippet" | "music" | "image";
type ActiveTab = "snippets" | "music" | "images";

type ImageItem = {
  id: string;
  userId: string;
  url: string;
  kind: "image";
  createdAt: string;
  width?: number | null;
  height?: number | null;
};

type SnippetItem = {
  id: string;
  userId: string;
  musicId?: string;
  title?: string;
  url: string;
  thumbnail?: string | null;
  startMs?: number | null;
  durationMs?: number | null;
  createdAt: string;
};

type TrackItem = {
  id: string;
  userId: string;
  title: string;
  url: string;
  cover?: string | null;
  durationMs?: number | null;
  createdAt: string;
};

type StorySummary = {
  id: string;
  userId: string;
  imageUrl: string;
  createdAt: string;
  hasNew?: boolean;
};

const ACCENT = "#ff4fd8";
const ACCENT_DIM = "#b63aa0";
const BG = "#000";
const CARD_BG = "#0f0f0f";
const BORDER = "#1e1e1e";
const TEXT = "#fff";
const TEXT_DIM = "#bbb";

const AVATAR = 96;
const STORY_SIZE = 64;

const API = process.env.EXPO_PUBLIC_API_URL || "http://192.168.0.224:5000";

/* ───────────────── Helpers ───────────────── */
function absolutizeUrl(url?: string | null) {
  if (!url) return "";
  const s = String(url);
  if (s.startsWith("file://") || /^https?:\/\//i.test(s)) {
    return s;
  }
  const base = API.replace(/\/$/, "");
  return `${base}/${s.replace(/^\/+/, "")}`;
}

/* ───────────────── NotificationBell ───────────────── */
type BellProps = {
  unreadCount?: number;
  onPress?: () => void;
  size?: number;
  color?: string;
  accent?: string;
};

function NotificationBell({
  unreadCount = 0,
  onPress,
  size = 22,
  color = TEXT,
  accent = ACCENT,
}: BellProps) {
  const showGlow = unreadCount > 0;

  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!showGlow) {
      pulseScale.stopAnimation();
      pulseOpacity.stopAnimation();
      pulseScale.setValue(1);
      pulseOpacity.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.35,
            duration: 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.45,
            duration: 500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.12,
            duration: 1300,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [showGlow, pulseScale, pulseOpacity]);

  const badgeText =
    unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : "";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {showGlow && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glowRing,
            {
              backgroundColor: accent,
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
              shadowColor: accent,
              shadowOpacity: 0.9,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 0 },
              ...(Platform.OS === "android" ? { borderWidth: 0 } : null),
            },
          ]}
        />
      )}
      <Ionicons
        name={unreadCount > 0 ? "notifications" : "notifications-outline"}
        size={size}
        color={color}
      />
      {unreadCount > 0 && (
        <View style={styles.notifBadge}>
          <Text style={styles.notifBadgeText}>{badgeText}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/* ───────────────── Screen ───────────────── */
export default function MyProfileScreen() {
  const router = useRouter();
  const aliveRef = useRef(true);

  const [me, setMe] = useState<PublicUser | null>(null);
  const [rel, setRel] = useState<Relations>({
    followersCount: 0,
    followingCount: 0,
    isFollowing: false,
    isSelf: true,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [avatarUploading, setAvatarUploading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [formUsername, setFormUsername] = useState("");
  const [formBio, setFormBio] = useState("");
  const [formAvatar, setFormAvatar] = useState("");
  const canSave = useMemo(
    () => formUsername.trim().length >= 2,
    [formUsername]
  );

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTab, setUploadTab] = useState<UploadTab>("snippet");

  const [menuOpen, setMenuOpen] = useState(false);

  const [stories, setStories] = useState<StorySummary[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>("snippets");

  const [images, setImages] = useState<ImageItem[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);

  const [snippets, setSnippets] = useState<SnippetItem[]>([]);
  const [snippetsLoading, setSnippetsLoading] = useState(false);
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);

  const [unreadCount, setUnreadCount] = useState<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fallbackAvatar =
    "https://upload.wikimedia.org/wikipedia/commons/2/2c/Default_pfp.svg";

  const hasStories = stories.length > 0;

  const loadLocal = useCallback(async (): Promise<PublicUser | null> => {
    const candidates = ["user", "@user", "ayo_user", "auth_user"];
    for (const key of candidates) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      try {
        const obj = JSON.parse(raw);
        const u = obj?.user?.id ? obj.user : obj;
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

  const refreshFromServer = useCallback(async (u: PublicUser) => {
    const prof: PublicUser = {
      id: u.id,
      email: u.email,
      username: u.username || u.email?.split("@")[0] || "User",
      avatarUrl: u.avatarUrl ?? null,
      bio: u.bio ?? "",
      isVerified: !!u.isVerified,
      createdAt: u.createdAt,
    };

    if (!aliveRef.current) return;

    await AsyncStorage.setItem("user", JSON.stringify(prof));
    setMe(prof);
  }, []);

  const loadMySnippets = useCallback(async (userId: string) => {
    try {
      setSnippetsLoading(true);
      const res = await fetch(`${API}/users/${userId}/snippets`);
      const json = await res.json();
      if (json?.snippets && Array.isArray(json.snippets)) {
        setSnippets(json.snippets);
      } else {
        setSnippets([]);
      }
    } catch (e) {
      console.log("loadMySnippets error", e);
      setSnippets([]);
    } finally {
      setSnippetsLoading(false);
    }
  }, []);

  const loadMyTracks = useCallback(async (userId: string) => {
    try {
      setTracksLoading(true);
      const res = await fetch(`${API}/users/${userId}/music`);
      const json = await res.json();
      if (json?.music && Array.isArray(json.music)) {
        setTracks(json.music);
      } else {
        setTracks([]);
      }
    } catch (e) {
      console.log("loadMyTracks error", e);
      setTracks([]);
    } finally {
      setTracksLoading(false);
    }
  }, []);

  const loadMyImages = useCallback(async (userId: string) => {
    try {
      setImagesLoading(true);
      const res = await fetch(`${API}/users/${userId}/images`);
      const json = await res.json();
      if (json?.images && Array.isArray(json.images)) {
        setImages(json.images);
      } else {
        setImages([]);
      }
    } catch (e) {
      console.log("loadMyImages error", e);
      setImages([]);
    } finally {
      setImagesLoading(false);
    }
  }, []);

  // 🔄 Stories des eigenen Profils laden
  const loadMyStories = useCallback(async (userId: string) => {
    try {
      setStoriesLoading(true);
      const viewerParam = userId;
      const res = await fetch(
        `${API}/stories/users/${userId}?viewer=${viewerParam}`
      );
      if (!res.ok) {
        console.log("loadMyStories status", res.status);
        setStories([]);
        return;
      }
      const json = await res.json();
      const rawList = (json?.stories || json || []) as any[];

      const mapped: StorySummary[] = rawList
        .map((s) => ({
          id: String(s.id),
          userId: String(s.userId || userId),
          imageUrl: s.thumbnail || s.imageUrl || s.url || "",
          createdAt: s.createdAt || new Date().toISOString(),
          hasNew: s.hasNew ?? s.isNew ?? false,
        }))
        .filter((s) => !!s.imageUrl);

      setStories(mapped);
    } catch (e) {
      console.log("loadMyStories error", e);
      setStories([]);
    } finally {
      setStoriesLoading(false);
    }
  }, []);

  const loadRelations = useCallback(async (userId: string) => {
    try {
      const base = API.replace(/\/$/, "");
      let followersCount = 0;
      let followingCount = 0;
      let isFollowing = false;
      let isSelf = true;

      try {
        const res = await fetch(`${base}/users/${userId}/relations`);
        if (res.ok) {
          const json = await res.json();
          followersCount = json.followersCount ?? followersCount;
          followingCount = json.followingCount ?? followingCount;
          isFollowing = json.isFollowing ?? isFollowing;
          isSelf = json.isSelf ?? isSelf;
        } else {
          throw new Error("relations not ok");
        }
      } catch {
        const [followersRes, followingRes] = await Promise.all([
          fetch(`${base}/users/${userId}/followers`),
          fetch(`${base}/users/${userId}/following`),
        ]);

        if (followersRes.ok) {
          const j1 = await followersRes.json();
          const arr = j1.users || j1.followers || j1.data || [];
          if (Array.isArray(arr)) followersCount = arr.length;
        }
        if (followingRes.ok) {
          const j2 = await followingRes.json();
          const arr2 = j2.users || j2.following || j2.data || [];
          if (Array.isArray(arr2)) followingCount = arr2.length;
        }
      }

      setRel({
        followersCount,
        followingCount,
        isFollowing,
        isSelf,
      });
    } catch (e) {
      console.log("loadRelations error", e);
    }
  }, []);

  const fetchUnread = useCallback(async (_uid?: string | null) => {
    setUnreadCount(0);
  }, []);

  const doRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const local = await loadLocal();
      if (local) {
        await refreshFromServer(local);
        await Promise.all([
          loadMyImages(local.id),
          loadMySnippets(local.id),
          loadMyTracks(local.id),
          loadMyStories(local.id),
          loadRelations(local.id),
          fetchUnread(local.id),
        ]);
      }
    } finally {
      setRefreshing(false);
    }
  }, [
    loadLocal,
    refreshFromServer,
    loadMyImages,
    loadMySnippets,
    loadMyTracks,
    loadMyStories,
    loadRelations,
    fetchUnread,
  ]);

  useEffect(() => {
    aliveRef.current = true;
    (async () => {
      try {
        setLoading(true);
        const local = await loadLocal();
        if (!local) {
          Alert.alert("Nicht eingeloggt", "Bitte melde dich an.");
          router.replace("/login");
          return;
        }
        await refreshFromServer(local);
        await Promise.all([
          loadMyImages(local.id),
          loadMySnippets(local.id),
          loadMyTracks(local.id),
          loadMyStories(local.id),
          loadRelations(local.id),
          fetchUnread(local.id),
        ]);
      } catch (e: any) {
        if (aliveRef.current) {
          Alert.alert(
            "Fehler",
            e?.message || "Profil konnte nicht geladen werden."
          );
        }
      } finally {
        aliveRef.current && setLoading(false);
      }
    })();
    return () => {
      aliveRef.current = false;
    };
  }, [
    loadLocal,
    refreshFromServer,
    loadMyImages,
    loadMySnippets,
    loadMyTracks,
    loadMyStories,
    loadRelations,
    fetchUnread,
    router,
  ]);

  useEffect(() => {
    if (!me?.id) return;
    if (activeTab === "music") loadMyTracks(me.id);
    if (activeTab === "images") loadMyImages(me.id);
    if (activeTab === "snippets") loadMySnippets(me.id);
  }, [activeTab, me?.id, loadMyTracks, loadMyImages, loadMySnippets]);

  useFocusEffect(
    useCallback(() => {
      if (me?.id && activeTab === "music") loadMyTracks(me.id);
      if (me?.id && activeTab === "snippets") loadMySnippets(me.id);
      if (me?.id) loadMyStories(me.id);
      return () => {};
    }, [me?.id, activeTab, loadMyTracks, loadMySnippets, loadMyStories])
  );

  useEffect(() => {
    if (!me?.id) return;
    pollRef.current = setInterval(() => fetchUnread(me.id), 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [me?.id, fetchUnread]);

  const joined = useMemo(() => {
    if (!me?.createdAt) return "—";
    const d = new Date(me.createdAt);
    return isNaN(d.getTime()) ? me.createdAt : d.toLocaleDateString();
  }, [me?.createdAt]);

  const openEdit = useCallback(() => {
    if (!me) return;
    setFormUsername(me.username || "");
    setFormBio(me.bio || "");
    setFormAvatar(me.avatarUrl || "");
    setEditOpen(true);
  }, [me]);

  const saveEdit = useCallback(async () => {
    if (!me || !canSave) return;
    try {
      const updated: PublicUser = {
        ...me,
        username: formUsername.trim(),
        bio: formBio,
        avatarUrl: formAvatar || me.avatarUrl,
      };

      await AsyncStorage.setItem("user", JSON.stringify(updated));
      setMe(updated);
      setEditOpen(false);
      Alert.alert("Gespeichert", "Dein Profil wurde aktualisiert (lokal).");
    } catch (e: any) {
      Alert.alert("Fehler", e?.message || "Konnte nicht speichern.");
    }
  }, [me, canSave, formUsername, formBio, formAvatar]);

  const pickAndUploadAvatar = useCallback(async () => {
    try {
      if (!me?.id) return;

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Berechtigung", "Bitte erlaube Zugriff auf Fotos.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.length) return;

      const uri = result.assets[0].uri;
      setAvatarUploading(true);

      const uriParts = uri.split(".");
      const ext = uriParts[uriParts.length - 1];
      const mimeType =
        ext === "png"
          ? "image/png"
          : ext === "webp"
          ? "image/webp"
          : "image/jpeg";

      const form = new FormData();
      form.append("file", {
        uri,
        name: `avatar-${me.id}.${ext || "jpg"}`,
        type: mimeType,
      } as any);

      const res = await fetch(`${API}/users/${me.id}/avatar`, {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data",
        },
        body: form,
      });

      if (!res.ok) {
        const txt = await res.text();
        console.log("avatar upload status", res.status, txt);
        Alert.alert("Fehler", "Avatar-Upload fehlgeschlagen.");
        return;
      }

      const json = await res.json();
      const newAvatar = json?.avatarUrl || json?.user?.avatarUrl || uri;

      const updated: PublicUser = {
        ...me,
        avatarUrl: newAvatar,
      };

      await AsyncStorage.setItem("user", JSON.stringify(updated));
      setMe(updated);
      Alert.alert("Erfolgreich", "Avatar aktualisiert.");
    } catch (e: any) {
      console.log("avatar upload error", e);
      Alert.alert(
        "Upload fehlgeschlagen",
        e?.message || "Bitte erneut versuchen."
      );
    } finally {
      setAvatarUploading(false);
    }
  }, [me]);

  const shareProfile = async () => {
    if (!me) return;
    try {
      const deepLink = `ayozia://profile/${me.id}`;
      await Share.share({
        title: `Profil von @${me.username}`,
        message: `Check mein Ayozia-Profil: @${me.username}\n${deepLink}`,
        url: deepLink,
      });
    } catch {}
  };

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <View style={styles.leftHeader}>
          <Text style={styles.usernameTop}>{me?.username}</Text>
          {!!me?.isVerified && (
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={ACCENT}
              style={{ marginLeft: 6 }}
            />
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <NotificationBell
            unreadCount={unreadCount}
            onPress={() => {
              try {
                (router as any).push("/notifications");
              } catch {
                Alert.alert(
                  "Benachrichtigungen",
                  "Der Notifications-Screen ist noch nicht vorhanden."
                );
              }
            }}
            size={22}
            color={TEXT}
            accent={ACCENT}
          />

          <TouchableOpacity
            onPress={() => {
              setUploadTab("image");
              setUploadOpen(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={24} color={TEXT} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.85}
          >
            <Ionicons name="menu" size={22} color={TEXT} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ alignItems: "center", marginTop: 8 }}>
        <View style={[styles.avatarWrap, hasStories && styles.avatarHasStory]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (!me?.id) return;
              if (hasStories) {
                router.push({
                  pathname: "/stories/[userId]",
                  params: { userId: String(me.id) },
                });
              } else {
                pickAndUploadAvatar();
              }
            }}
            onLongPress={pickAndUploadAvatar}
          >
            <Image
              source={{
                uri: absolutizeUrl(me?.avatarUrl || fallbackAvatar),
              }}
              style={styles.avatar}
            />
            {avatarUploading && (
              <View
                style={{
                  position: "absolute",
                  inset: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0,0,0,0.4)",
                  borderRadius: AVATAR / 2,
                }}
              >
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.countersRow}>
          <Link
            href={{
              pathname: "/profile/[id]/followers",
              params: { id: String(me?.id) },
            }}
            asChild
          >
            <TouchableOpacity style={styles.counterBox} activeOpacity={0.85}>
              <Text style={styles.counterNum}>{rel.followersCount}</Text>
              <Text style={styles.counterLabel}>Follower</Text>
            </TouchableOpacity>
          </Link>

          <Link
            href={{
              pathname: "/profile/[id]/following",
              params: { id: String(me?.id) },
            }}
            asChild
          >
            <TouchableOpacity style={styles.counterBox} activeOpacity={0.85}>
              <Text style={styles.counterNum}>{rel.followingCount}</Text>
              <Text style={styles.counterLabel}>Gefolgt</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      {me?.bio ? (
        <View
          style={{ paddingHorizontal: 16, marginTop: 6, alignItems: "center" }}
        >
          <Text style={styles.bioText}>{me.bio}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={{
            paddingHorizontal: 16,
            marginTop: 6,
            alignItems: "center",
          }}
          onPress={openEdit}
          activeOpacity={0.85}
        >
          <Text style={{ color: ACCENT, fontWeight: "700" }}>
            Bio hinzufügen
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.btnEdit}
          onPress={openEdit}
          activeOpacity={0.9}
        >
          <Text style={styles.btnEditText}>Profil bearbeiten</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnEdit}
          onPress={shareProfile}
          activeOpacity={0.9}
        >
          <Text style={styles.btnEditText}>Profil teilen</Text>
        </TouchableOpacity>
      </View>

      {/* Stories-Zeile – "Neu" + echte Stories */}
      <View style={styles.highlightsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          <TouchableOpacity
            style={styles.storyItem}
            activeOpacity={0.9}
            onPress={() => {
              try {
                router.push("/stories/create");
              } catch {
                Alert.alert(
                  "Story",
                  "Upload-Screen /stories/create nicht gefunden."
                );
              }
            }}
          >
            <View style={styles.storyCircle}>
              <Ionicons name="add" size={24} color={TEXT} />
            </View>
            <Text style={styles.storyLabel}>Neu</Text>
          </TouchableOpacity>

          {stories.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.storyItem}
              activeOpacity={0.9}
              onPress={() => {
                if (!me?.id) return;
                router.push({
                  pathname: "/stories/[userId]",
                  params: { userId: String(me.id) },
                });
              }}
            >
              <View
                style={[
                  styles.storyCircle,
                  s.hasNew && { borderColor: ACCENT },
                ]}
              >
                <Image
                  source={{ uri: absolutizeUrl(s.imageUrl) }}
                  style={styles.storyImage}
                />
              </View>
              <Text style={styles.storyLabel} numberOfLines={1}>
                Story
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity onPress={() => setActiveTab("snippets")}>
          <Text
            style={[styles.tab, activeTab === "snippets" && styles.tabActive]}
          >
            Snippets
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab("music")}>
          <Text
            style={[styles.tab, activeTab === "music" && styles.tabActive]}
          >
            Musik
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab("images")}>
          <Text
            style={[styles.tab, activeTab === "images" && styles.tabActive]}
          >
            Bilder
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  /* ───────────────── Tabs Render ───────────────── */

  if (loading) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  // SNIPPETS
  if (activeTab === "snippets") {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <FlatList
          key="tab-snippets"
          data={snippets}
          keyExtractor={(it) => it.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            snippetsLoading ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <ActivityIndicator color={TEXT} />
              </View>
            ) : (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <Text style={{ color: "#777" }}>Noch keine Snippets</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View
              style={{
                marginHorizontal: 12,
                marginTop: 10,
                borderRadius: 12,
                overflow: "hidden",
                backgroundColor: "#111",
                borderWidth: 1,
                borderColor: BORDER,
              }}
            >
              <Image
                source={{
                  uri: absolutizeUrl(
                    item.thumbnail ||
                      "https://via.placeholder.com/800x800?text=Snippet"
                  ),
                }}
                style={{ width: "100%", aspectRatio: 1 }}
                resizeMode="cover"
              />
              <View
                style={{
                  padding: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: "#fff", fontWeight: "800" }}
                    numberOfLines={1}
                  >
                    {item.title || "Snippet"}
                  </Text>
                  <Text style={{ color: "#aaa", marginTop: 2 }}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>

                <SnippetPlayerButton
                  snippet={{
                    id: item.musicId || item.id,
                    title: item.title || "Snippet",
                    url: absolutizeUrl(item.url),
                    startMs: item.startMs ?? 0,
                    durationMs: item.durationMs ?? 30000,
                  }}
                  size={42}
                />
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 90 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={doRefresh}
              tintColor={TEXT}
            />
          }
          removeClippedSubviews
          windowSize={7}
          initialNumToRender={6}
        />

        <TouchableOpacity
          onPress={() => {
            setUploadOpen(true);
            setUploadTab("snippet");
          }}
          activeOpacity={0.9}
          style={fabStyle}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>

        <AudioMiniPlayer />
        {renderModals()}
      </SafeAreaView>
    );
  }

  // MUSIK
  if (activeTab === "music") {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <FlatList
          key="tab-music"
          data={tracks}
          keyExtractor={(it) => it.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            tracksLoading ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <ActivityIndicator color={TEXT} />
              </View>
            ) : (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <Text style={{ color: "#777" }}>Noch keine Musik</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View
              style={{
                marginHorizontal: 12,
                marginTop: 10,
                borderRadius: 12,
                overflow: "hidden",
                backgroundColor: "#111",
                borderWidth: 1,
                borderColor: BORDER,
                flexDirection: "row",
                alignItems: "center",
                padding: 12,
                gap: 12,
              }}
            >
              <Image
                source={{
                  uri: absolutizeUrl(
                    item.cover ||
                      "https://via.placeholder.com/200x200?text=Track"
                  ),
                }}
                style={{ width: 64, height: 64, borderRadius: 8 }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: "#fff", fontWeight: "800" }}
                  numberOfLines={1}
                >
                  {item.title || "Unbenannter Track"}
                </Text>
                <Text style={{ color: "#aaa", marginTop: 4 }}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>

              <TrackPlayButton
                track={{
                  id: item.id,
                  title: item.title || "Unbenannter Track",
                  url: absolutizeUrl(item.url),
                  cover: absolutizeUrl(item.cover || undefined),
                }}
              />
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 90 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={doRefresh}
              tintColor={TEXT}
            />
          }
          removeClippedSubviews
          windowSize={7}
          initialNumToRender={8}
        />

        <TouchableOpacity
          onPress={() => {
            setUploadOpen(true);
            setUploadTab("music");
          }}
          activeOpacity={0.9}
          style={fabStyle}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>

        <AudioMiniPlayer />
        {renderModals()}
      </SafeAreaView>
    );
  }

  // BILDER
  if (activeTab === "images") {
    const IMAGE_COLS = 1;
    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <FlatList
          key={`images-cols-${IMAGE_COLS}`}
          data={images}
          keyExtractor={(it) => it.id}
          numColumns={IMAGE_COLS}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            imagesLoading ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <ActivityIndicator color={TEXT} />
              </View>
            ) : (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <Text style={{ color: "#777" }}>Noch keine Bilder</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View
              style={{
                marginHorizontal: 12,
                marginTop: 8,
                borderRadius: 12,
                overflow: "hidden",
                backgroundColor: "#111",
                borderWidth: 1,
                borderColor: BORDER,
              }}
            >
              <Image
                source={{ uri: absolutizeUrl(item.url) }}
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
              tintColor={TEXT}
            />
          }
          removeClippedSubviews
          windowSize={7}
          initialNumToRender={6}
        />

        <TouchableOpacity
          onPress={() => {
            setUploadOpen(true);
            setUploadTab("image");
          }}
          activeOpacity={0.9}
          style={fabStyle}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>

        <AudioMiniPlayer />
        {renderModals()}
      </SafeAreaView>
    );
  }

  // Fallback
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={doRefresh}
            tintColor={TEXT}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderHeader()}
      </ScrollView>

      <AudioMiniPlayer />
      {renderModals()}
    </SafeAreaView>
  );

  /* ───────────── Modals ───────────── */
  function renderModals() {
    return (
      <>
        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <View style={styles.menuBackdrop}>
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject as any}
              activeOpacity={1}
              onPress={() => setMenuOpen(false)}
            />
            <View style={styles.menuCard}>
              <Text style={styles.menuTitle}>Menü</Text>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  openEdit();
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="create-outline" size={18} color="#fff" />
                <Text style={styles.menuItemText}>Profil bearbeiten</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push("/profile/settings");
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="settings-outline" size={18} color="#fff" />
                <Text style={styles.menuItemText}>Einstellungen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { justifyContent: "center" }]}
                onPress={() => setMenuOpen(false)}
                activeOpacity={0.85}
              >
                <Text style={[styles.menuItemText, { color: "#9aa2c9" }]}>
                  Schließen
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={uploadOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setUploadOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Upload</Text>

              <View style={styles.uploadTabBar}>
                <TouchableOpacity
                  style={styles.uploadTabBtn}
                  onPress={() => setUploadTab("snippet")}
                  activeOpacity={0.9}
                >
                  <Text
                    style={[
                      styles.uploadTabText,
                      uploadTab === "snippet" && styles.uploadTabTextActive,
                    ]}
                  >
                    Snippets
                  </Text>
                  {uploadTab === "snippet" && (
                    <View style={styles.uploadTabIndicator} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.uploadTabBtn}
                  onPress={() => setUploadTab("music")}
                  activeOpacity={0.9}
                >
                  <Text
                    style={[
                      styles.uploadTabText,
                      uploadTab === "music" && styles.uploadTabTextActive,
                    ]}
                  >
                    Musik
                  </Text>
                  {uploadTab === "music" && (
                    <View style={styles.uploadTabIndicator} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.uploadTabBtn}
                  onPress={() => setUploadTab("image")}
                  activeOpacity={0.9}
                >
                  <Text
                    style={[
                      styles.uploadTabText,
                      uploadTab === "image" && styles.uploadTabTextActive,
                    ]}
                  >
                    Bilder
                  </Text>
                  {uploadTab === "image" && (
                    <View style={styles.uploadTabIndicator} />
                  )}
                </TouchableOpacity>
              </View>

              {uploadTab === "snippet" && (
                <View style={{ paddingTop: 8 }}>
                  <Text style={styles.uploadInfo}>
                    Kurzclip hochladen oder aus Musik wählen (30s).
                  </Text>
                  <TouchableOpacity
                    style={styles.uploadPrimary}
                    onPress={() => {
                      setUploadOpen(false);
                      router.push("/profile/upload/music");
                    }}
                    activeOpacity={0.9}
                  >
                    <Ionicons
                      name="flame-outline"
                      size={18}
                      color={TEXT}
                    />
                    <Text style={styles.uploadPrimaryText}>
                      Snippet aus Musik erstellen
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {uploadTab === "music" && (
                <View style={{ paddingTop: 8 }}>
                  <Text style={styles.uploadInfo}>
                    Track/Audio hochladen (MP3/M4A/WAV…)
                  </Text>
                  <TouchableOpacity
                    style={styles.uploadPrimary}
                    onPress={() => {
                      setUploadOpen(false);
                      router.push("/profile/upload/music");
                    }}
                    activeOpacity={0.9}
                  >
                    <Ionicons
                      name="musical-notes-outline"
                      size={18}
                      color={TEXT}
                    />
                    <Text style={styles.uploadPrimaryText}>
                      Musik hochladen
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {uploadTab === "image" && (
                <View style={{ paddingTop: 8 }}>
                  <Text style={styles.uploadInfo}>
                    Lade ein Bild hoch (JPG/PNG/WEBP).
                  </Text>
                  <TouchableOpacity
                    style={styles.uploadPrimary}
                    onPress={() => {
                      setUploadOpen(false);
                      router.push("/profile/upload/image");
                    }}
                    activeOpacity={0.9}
                  >
                    <Ionicons
                      name="images-outline"
                      size={18}
                      color={TEXT}
                    />
                    <Text style={styles.uploadPrimaryText}>
                      Bild auswählen
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setUploadOpen(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalCancelText}>Schließen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={editOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setEditOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Profil bearbeiten</Text>

              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder="@username"
                placeholderTextColor="#888"
                value={formUsername}
                onChangeText={setFormUsername}
              />

              <Text style={styles.inputLabel}>Bio</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                placeholder="Sag etwas über dich…"
                placeholderTextColor="#888"
                multiline
                value={formBio}
                onChangeText={setFormBio}
              />

              <Text style={styles.inputLabel}>Avatar URL (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://…"
                placeholderTextColor="#888"
                value={formAvatar}
                onChangeText={setFormAvatar}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setEditOpen(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalCancelText}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalCancel,
                    {
                      backgroundColor: ACCENT,
                      borderColor: ACCENT,
                    },
                  ]}
                  disabled={!canSave}
                  onPress={saveEdit}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.modalCancelText, { color: "#fff" }]}>
                    Speichern
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
  }
}

const fabStyle = {
  position: "absolute" as const,
  right: 16,
  bottom: 24,
  width: 54,
  height: 54,
  borderRadius: 27,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  backgroundColor: ACCENT,
  shadowColor: ACCENT,
  shadowOpacity: 0.6,
  shadowRadius: 10,
  elevation: 8,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    paddingTop: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  leftHeader: { flexDirection: "row", alignItems: "center" },
  usernameTop: { color: TEXT, fontSize: 18, fontWeight: "700" },

  glowRing: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    zIndex: -1,
  },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#ff374a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#18010f",
  },
  notifBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  avatarWrap: {
    width: AVATAR + 10,
    height: AVATAR + 10,
    borderRadius: (AVATAR + 10) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHasStory: {
    borderWidth: 3,
    borderColor: ACCENT,
    shadowColor: ACCENT,
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    backgroundColor: "#13000e",
    elevation: 10,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#111",
  },

  countersRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
  },
  counterBox: { alignItems: "center", minWidth: 88 },
  counterNum: { color: TEXT, fontSize: 18, fontWeight: "800" },
  counterLabel: { color: "#9a9a9a", fontSize: 12 },

  bioText: { color: "#ddd", textAlign: "center" },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  btnEdit: {
    flex: 1,
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  btnEditText: { color: TEXT, fontWeight: "700" },

  highlightsWrap: { marginTop: 16 },
  storyItem: { alignItems: "center", marginRight: 14, width: STORY_SIZE },
  storyCircle: {
    width: STORY_SIZE,
    height: STORY_SIZE,
    borderRadius: STORY_SIZE / 2,
    borderWidth: 2,
    borderColor: BORDER,
    overflow: "hidden",
    backgroundColor: CARD_BG,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  storyImage: { width: "100%", height: "100%" },
  storyLabel: {
    color: TEXT_DIM,
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
  },

  tabs: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#0a0a0a",
  },
  tab: { color: "#aaa", fontWeight: "700", fontSize: 13 },
  tabActive: {
    color: TEXT,
    borderBottomWidth: 2,
    borderBottomColor: ACCENT,
    paddingBottom: 6,
    textShadowColor: ACCENT_DIM,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#0f0f1d",
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: "#222344",
  },
  modalTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  inputLabel: { color: TEXT_DIM, marginTop: 8, marginBottom: 6 },
  input: {
    backgroundColor: "#151528",
    color: TEXT,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#222344",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  modalCancel: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#1b1b2e",
    borderWidth: 1,
    borderColor: "#222344",
  },
  modalCancelText: { color: TEXT, fontWeight: "700" },

  uploadTabBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    borderBottomWidth: 1,
    borderBottomColor: "#222344",
    paddingBottom: 6,
    marginBottom: 12,
  },
  uploadTabBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  uploadTabText: { color: "#9aa2c9", fontWeight: "800", letterSpacing: 0.4 },
  uploadTabTextActive: {
    color: TEXT,
    textShadowColor: ACCENT_DIM,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  uploadTabIndicator: {
    marginTop: 6,
    height: 3,
    borderRadius: 3,
    width: 42,
    backgroundColor: ACCENT,
  },
  uploadInfo: { color: "#c9ccec", marginBottom: 10 },

  uploadPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#151528",
    borderWidth: 1,
    borderColor: "#222344",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  uploadPrimaryText: { color: TEXT, fontWeight: "800" },

  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 60,
    paddingRight: 12,
  },
  menuCard: {
    width: 220,
    backgroundColor: "#0f0f1d",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#222344",
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  menuTitle: {
    color: "#c9ccec",
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#222344",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  menuItemText: { color: "#fff", fontWeight: "700", flex: 1 },
});

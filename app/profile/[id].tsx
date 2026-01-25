// app/profile/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  isRequested?: boolean; // ✅ Follow-Anfrage läuft
  isSelf: boolean;
};

type PrivacyChoice = "everyone" | "followers" | "nobody";

type AccountPrivacy = {
  privateAccount: boolean;
  mentions: PrivacyChoice;
  comments: PrivacyChoice;
  tagsAllowed: PrivacyChoice;
  allowMessages: boolean;
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
  const params = useLocalSearchParams<{ id?: string | string[]; username?: string }>();
  const id = useMemo(
    () => (Array.isArray(params?.id) ? params.id[0] : params?.id || ""),
    [params?.id]
  );

  const router = useRouter();
  const alive = useRef(true);

  const [viewer, setViewer] = useState<PublicUser | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);

  const [rel, setRel] = useState<Relations>({
    followersCount: 0,
    followingCount: 0,
    isFollowing: false,
    isRequested: false,
    isSelf: false,
  });

  const [canViewContent, setCanViewContent] = useState<boolean>(true);
  const [privacy, setPrivacy] = useState<AccountPrivacy | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>("images");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [snippets, setSnippets] = useState<SnippetItem[]>([]);
  const [tracks, setTracks] = useState<TrackItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [snippetsLoading, setSnippetsLoading] = useState(false);
  const [tracksLoading, setTracksLoading] = useState(false);

  const [listOpen, setListOpen] = useState<null | "followers" | "following">(null);
  const [followersList, setFollowersList] = useState<PublicUser[]>([]);
  const [followingList, setFollowingList] = useState<PublicUser[]>([]);
  const [listBusy, setListBusy] = useState(false);

  const [hasStories, setHasStories] = useState(false);

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);

  const isPrivateLocked = useMemo(() => {
    return !!privacy?.privateAccount && !rel.isSelf && !rel.isFollowing;
  }, [privacy?.privateAccount, rel.isSelf, rel.isFollowing]);

  const closeAllOverlays = useCallback(() => {
    setOptionsOpen(false);
    setListOpen(null);
  }, []);

  const loadViewer = useCallback(async (): Promise<PublicUser | null> => {
    const keys = ["user", "me", "@user", "ayo_user", "auth_user", "ayozia_user", "currentUser"];
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

  const fetchBlockedState = useCallback(async (viewerId: string, targetId: string) => {
    try {
      const r = await http.get<{ blocked?: any[] }>(`/users/${viewerId}/blocked`, {
        params: { viewer: viewerId },
      });
      const arr = Array.isArray(r.data?.blocked) ? r.data.blocked : [];
      const isBlocked = arr.some(
        (x: any) => String(x?.blockedId ?? x?.id ?? x?.userId) === String(targetId)
      );
      setBlockedByMe(isBlocked);
      return isBlocked;
    } catch {
      setBlockedByMe(false);
      return false;
    }
  }, []);

  const doBlock = useCallback(
    async (reason?: string) => {
      if (!viewer?.id || !user?.id || viewer.id === user.id) return;

      try {
        setBlockBusy(true);

        await http.post(`/users/${viewer.id}/block`, {
          viewerId: viewer.id,
          blockedId: user.id,
          reason,
        });

        // ✅ Overlays schließen, damit nichts mehr Touches blockiert
        closeAllOverlays();

        // ✅ UI sofort aktualisieren – DU BLEIBST AUF DEM PROFIL
        setBlockedByMe(true);
        setCanViewContent(false);
        setImages([]);
        setSnippets([]);
        setTracks([]);
        setRel((r) => ({ ...r, isFollowing: false, isRequested: false }));

        Alert.alert("Blockiert", `@${user.username} wurde blockiert.`, [{ text: "OK" }]);
      } catch (e: any) {
        Alert.alert(
          "Fehler",
          e?.response?.data?.message || e?.message || "Blockieren fehlgeschlagen."
        );
      } finally {
        setBlockBusy(false);
      }
    },
    [viewer?.id, user?.id, user?.username, closeAllOverlays]
  );

  const doUnblock = useCallback(async () => {
    if (!viewer?.id || !user?.id) return;

    try {
      setBlockBusy(true);

      await http.post(`/users/${viewer.id}/unblock`, {
        viewerId: viewer.id,
        blockedId: user.id,
      });

      setBlockedByMe(false);
      closeAllOverlays();

      await fetchProfile();
      Alert.alert("Entblockt", `@${user.username} wurde entblockt.`);
    } catch (e: any) {
      Alert.alert("Fehler", e?.response?.data?.message || e?.message || "Entblocken fehlgeschlagen.");
    } finally {
      setBlockBusy(false);
    }
  }, [viewer?.id, user?.id, user?.username, closeAllOverlays]);

  const confirmBlock = useCallback(() => {
    if (!viewer?.id || !user?.id || viewer.id === user.id) return;

    const uname = user?.username || "diesem Nutzer";

    // ✅ Wichtig: zuerst alle Overlays schließen, sonst kann ein unsichtbarer Touch-Blocker hängen bleiben
    closeAllOverlays();

    // Alert im nächsten Tick öffnen (Modal-State muss erst committen)
    setTimeout(() => {
      Alert.alert(
        "Blockieren",
        `Möchtest du @${uname} blockieren?\n\n• Dieser Account kann dir keine Nachrichten senden\n• Er kann dein Profil & Inhalte nicht sehen\n• Follow/Anfragen werden gestoppt`,
        [
          { text: "Abbrechen", style: "cancel" },
          {
            text: "Blockieren",
            style: "destructive",
            onPress: () => {
              Alert.alert("Grund auswählen (optional)", "Warum blockierst du diesen Account?", [
                { text: "Spam", onPress: () => doBlock("Spam") },
                { text: "Belästigung", onPress: () => doBlock("Belästigung") },
                { text: "Beleidigung", onPress: () => doBlock("Beleidigung") },
                { text: "Anderer Grund", onPress: () => doBlock("Anderer Grund") },
                { text: "Ohne Grund", style: "cancel", onPress: () => doBlock(undefined) },
              ]);
            },
          },
        ]
      );
    }, 50);
  }, [viewer?.id, user?.id, user?.username, closeAllOverlays]);

  const confirmUnblock = useCallback(() => {
    if (!viewer?.id || !user?.id) return;

    closeAllOverlays();

    setTimeout(() => {
      Alert.alert("Entblocken", `Möchtest du @${user.username} wirklich entblocken?`, [
        { text: "Abbrechen", style: "cancel" },
        { text: "Entblocken", style: "default", onPress: doUnblock },
      ]);
    }, 50);
  }, [viewer?.id, user?.id, user?.username, closeAllOverlays]);

  const fetchProfile = useCallback(async () => {
    if (!id) return;

    const v = await loadViewer();
    if (!alive.current) return;

    setViewer(v);

    const fallbackUser: PublicUser = {
      id: String(id),
      email: "",
      username: String(params?.username || "User"),
      avatarUrl: null,
      bio: "",
      isVerified: false,
      createdAt: null,
    };

    let uRes: any;
    try {
      uRes = await http.get(`/users/${id}`, { params: { viewer: v?.id || "" } });
    } catch (e: any) {
      if (!alive.current) return;

      if (e?.response?.status === 404) {
        setUser(fallbackUser);
        setCanViewContent(false);
        setBlockedByMe(true);
        setPrivacy(null);
        setRel({
          followersCount: 0,
          followingCount: 0,
          isFollowing: false,
          isRequested: false,
          isSelf: (v?.id || "") === id,
        });
        setImages([]);
        setSnippets([]);
        setTracks([]);
        setHasStories(false);
        return;
      }

      throw e;
    }

    if (!alive.current) return;

    // ✅ Block: Server liefert { blocked: true } (kein 404)
    if (uRes?.data?.blocked === true) {
      setUser(uRes?.data?.user || fallbackUser);
      setCanViewContent(false);
      setBlockedByMe(true);
      setPrivacy(null);
      setRel({
        followersCount: 0,
        followingCount: 0,
        isFollowing: false,
        isRequested: false,
        isSelf: (v?.id || "") === id,
      });
      setImages([]);
      setSnippets([]);
      setTracks([]);
      setHasStories(false);
      return;
    }

    const u = uRes?.data?.user || fallbackUser;
    setUser(u);

    const canView = uRes.data?.canViewContent !== false;
    setCanViewContent(canView);

    // Relations (404-safe)
    try {
      const r = await http.get<Relations>(`/users/${id}/relations`, {
        params: { viewer: v?.id || "" },
      });
      if (!alive.current) return;
      setRel({
        followersCount: Number((r.data as any).followersCount || 0),
        followingCount: Number((r.data as any).followingCount || 0),
        isFollowing: !!(r.data as any).isFollowing,
        isRequested: !!(r.data as any).isRequested,
        isSelf: !!(r.data as any).isSelf,
      });

      if ((r.data as any)?.blocked === true) {
        setBlockedByMe(true);
        setCanViewContent(false);
        setImages([]);
        setSnippets([]);
        setTracks([]);
        setHasStories(false);
        return;
      }
    } catch (e: any) {
      if (!alive.current) return;

      if (e?.response?.status === 404) {
        setCanViewContent(false);
        setBlockedByMe(true);
        setImages([]);
        setSnippets([]);
        setTracks([]);
        setHasStories(false);
      }

      setRel({
        followersCount: 0,
        followingCount: 0,
        isFollowing: false,
        isRequested: false,
        isSelf: (v?.id || "") === id,
      });
    }

    // Privacy
    try {
      const p = await http.get<{ privacy?: AccountPrivacy }>(`/users/${id}/account-privacy`);
      const pr: any = p.data?.privacy;
      if (!alive.current) return;
      if (pr && typeof pr === "object") {
        setPrivacy({
          privateAccount: !!pr.privateAccount,
          mentions: pr.mentions || "everyone",
          comments: pr.comments || "everyone",
          tagsAllowed: pr.tagsAllowed || "everyone",
          allowMessages: pr.allowMessages !== false,
        });
      } else {
        setPrivacy(null);
      }
    } catch {
      alive.current && setPrivacy(null);
    }

    // Block-State check (nur wenn nicht self)
    if (v?.id && v.id !== id) {
      const isB = await fetchBlockedState(v.id, id);
      if (!alive.current) return;

      if (isB) {
        setCanViewContent(false);
        setImages([]);
        setSnippets([]);
        setTracks([]);
        setHasStories(false);
      }
    } else {
      alive.current && setBlockedByMe(false);
    }

    // Stories
    if (canView || (v?.id || "") === id) {
      try {
        const base = API.replace(/\/$/, "");
        const res = await fetch(`${base}/stories/users/${id}?viewer=${v?.id || ""}`);
        if (!alive.current) return;
        if (!res.ok) {
          setHasStories(false);
        } else {
          const json = await res.json();
          const arr = (json?.stories || json || []) as any[];
          setHasStories(arr.length > 0);
        }
      } catch {
        alive.current && setHasStories(false);
      }
    } else {
      alive.current && setHasStories(false);
    }

    if (!canView) {
      setImages([]);
      setSnippets([]);
      setTracks([]);
    }
  }, [id, loadViewer, fetchBlockedState, params?.username]);

  const loadImages = useCallback(async () => {
    if (!id) return;
    if (!canViewContent || blockedByMe) {
      setImages([]);
      return;
    }
    setImagesLoading(true);
    try {
      const r = await http.get<{ images?: ImageItem[] }>(`/users/${id}/images`, {
        params: { viewer: viewer?.id || "" },
      });
      const arr = Array.isArray(r.data.images) ? r.data.images : [];
      setImages(arr.map((im) => ({ ...im, url: absolutize(im.url) })));
    } catch {
      setImages([]);
    } finally {
      setImagesLoading(false);
    }
  }, [id, viewer?.id, canViewContent, blockedByMe]);

  const loadTracks = useCallback(async () => {
    if (!id) return;
    if (!canViewContent || blockedByMe) {
      setTracks([]);
      return;
    }
    setTracksLoading(true);
    try {
      const r = await http.get<{ music?: any[]; items?: any[] }>(`/users/${id}/music`, {
        params: { viewer: viewer?.id || "" },
      });
      const src = Array.isArray(r.data.music)
        ? r.data.music
        : Array.isArray(r.data.items)
          ? r.data.items
          : [];

      const out: TrackItem[] = src
        .map((raw) => {
          const url = absolutize(raw.absUrl || raw.url || raw.path || raw.relPath || "");
          const coverRaw = raw.absCover || raw.cover || raw.coverUrl || raw.coverRelPath || null;
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
            snippetDurationMs: raw.snippetDurationMs ?? raw.snippet_duration_ms ?? null,
          };
        })
        .filter((t) => !!t.url);

      setTracks(out);
    } catch {
      setTracks([]);
    } finally {
      setTracksLoading(false);
    }
  }, [id, viewer?.id, canViewContent, blockedByMe]);

  const loadSnippets = useCallback(async () => {
    if (!id) return;
    if (!canViewContent || blockedByMe) {
      setSnippets([]);
      return;
    }
    setSnippetsLoading(true);
    try {
      const r = await http.get<{ snippets?: any[] }>(`/users/${id}/snippets`, {
        params: { viewer: viewer?.id || "" },
      });
      const arr = Array.isArray(r.data.snippets) ? r.data.snippets : [];

      if (arr.length) {
        const norm: SnippetItem[] = arr
          .map((raw) => {
            const url = absolutize(raw.absUrl || raw.url || raw.path || raw.relPath || "");
            const thumbRaw = raw.thumbnail || raw.cover || raw.absCover || raw.coverRelPath || null;
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

      const rMusic = await http.get<{ music?: any[]; items?: any[] }>(`/users/${id}/music`, {
        params: { viewer: viewer?.id || "" },
      });
      const src = Array.isArray(rMusic.data.music)
        ? rMusic.data.music
        : Array.isArray(rMusic.data.items)
          ? rMusic.data.items
          : [];

      const tracksAsSnippets: SnippetItem[] = src
        .map((raw) => {
          const url = absolutize(raw.absUrl || raw.url || raw.path || raw.relPath || "");
          const coverRaw = raw.absCover || raw.cover || raw.coverUrl || raw.coverRelPath || null;
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
  }, [id, viewer?.id, canViewContent, blockedByMe]);

  const openFollowers = useCallback(async () => {
    if (!id) return;
    if (isPrivateLocked || blockedByMe) {
      Alert.alert("Nicht verfügbar", "Du kannst diese Liste aktuell nicht ansehen.");
      return;
    }
    setListOpen("followers");
    setListBusy(true);
    try {
      const r = await http.get<{ followers: PublicUser[] }>(`/users/${id}/followers`, {
        params: { viewer: viewer?.id || "" },
      });
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
  }, [id, viewer?.id, isPrivateLocked, blockedByMe]);

  const openFollowing = useCallback(async () => {
    if (!id) return;
    if (isPrivateLocked || blockedByMe) {
      Alert.alert("Nicht verfügbar", "Du kannst diese Liste aktuell nicht ansehen.");
      return;
    }
    setListOpen("following");
    setListBusy(true);
    try {
      const r = await http.get<{ following: PublicUser[] }>(`/users/${id}/following`, {
        params: { viewer: viewer?.id || "" },
      });
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
  }, [id, viewer?.id, isPrivateLocked, blockedByMe]);

  const toggleFollow = useCallback(async () => {
    if (!viewer?.id || !user?.id || viewer.id === user.id) return;
    if (blockedByMe) {
      Alert.alert("Blockiert", "Du hast diesen Nutzer blockiert.");
      return;
    }

    try {
      if (rel.isFollowing) {
        await http.post("/unfollow", { fromId: viewer.id, toId: user.id });
        setRel((r) => ({
          ...r,
          isFollowing: false,
          isRequested: false,
          followersCount: Math.max(0, r.followersCount - 1),
        }));
        await fetchProfile();
        return;
      }

      if (rel.isRequested) {
        await http.post("/follow-requests/cancel", { fromId: viewer.id, toId: user.id });
        setRel((r) => ({ ...r, isRequested: false }));
        await fetchProfile();
        return;
      }

      const r = await http.post<{ status?: "following" | "requested" }>("/follow", {
        fromId: viewer.id,
        toId: user.id,
      });

      const status = r?.data?.status;

      if (status === "requested") {
        setRel((prev) => ({ ...prev, isRequested: true }));
        Alert.alert("Anfrage gesendet", "Warte, bis der Account dich akzeptiert.");
      } else {
        setRel((prev) => ({
          ...prev,
          isFollowing: true,
          isRequested: false,
          followersCount: prev.followersCount + 1,
        }));
      }

      await fetchProfile();

      if (!privacy?.privateAccount || status === "following") {
        if (activeTab === "images") await loadImages();
        if (activeTab === "snippets") await loadSnippets();
        if (activeTab === "music") await loadTracks();
      }
    } catch (e: any) {
      Alert.alert("Fehler", e?.response?.data?.message || e?.message || "Aktion fehlgeschlagen.");
    }
  }, [
    viewer?.id,
    user?.id,
    rel.isFollowing,
    rel.isRequested,
    privacy?.privateAccount,
    activeTab,
    fetchProfile,
    loadImages,
    loadSnippets,
    loadTracks,
    blockedByMe,
  ]);

  const handleMessagePress = useCallback(() => {
    if (!user?.id) return;

    if (blockedByMe) {
      Alert.alert("Blockiert", "Du hast diesen Nutzer blockiert.");
      return;
    }

    if (privacy?.privateAccount && !rel.isSelf && !rel.isFollowing) {
      Alert.alert("Privater Account", "Du musst dem Account folgen, um zu chatten.");
      return;
    }

    if (privacy?.allowMessages === false && !rel.isSelf && !rel.isFollowing) {
      Alert.alert("Nachrichten gesperrt", "Dieser Account akzeptiert Nachrichten nur von Followern.");
      return;
    }

    router.push({
      pathname: "/chat/[id]",
      params: { id: user.id, username: user.username || "" },
    });
  }, [router, user, privacy, rel.isFollowing, rel.isSelf, blockedByMe]);

  const doRefresh = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      await fetchProfile();
      if (canViewContent && !blockedByMe) {
        await Promise.all([loadImages(), loadSnippets(), loadTracks()]);
      }
    } finally {
      setRefreshing(false);
    }
  }, [id, fetchProfile, canViewContent, blockedByMe, loadImages, loadSnippets, loadTracks]);

  useEffect(() => {
    if (!id) return;
    alive.current = true;

    (async () => {
      try {
        setLoading(true);
        await fetchProfile();
        if (canViewContent && !blockedByMe) {
          await Promise.all([loadImages(), loadSnippets(), loadTracks()]);
        }
      } catch (e: any) {
        Alert.alert("Fehler", e?.response?.data?.message || e?.message || "Profil konnte nicht geladen werden.");
      } finally {
        alive.current && setLoading(false);
      }
    })();

    return () => {
      alive.current = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (!canViewContent) return;
    if (blockedByMe) return;

    if (activeTab === "images") loadImages();
    else if (activeTab === "snippets") loadSnippets();
    else if (activeTab === "music") loadTracks();
  }, [activeTab, id, canViewContent, blockedByMe, loadImages, loadSnippets, loadTracks]);

  const FollowButtonText = useMemo(() => {
    if (rel.isFollowing) return "Gefolgt";
    if (rel.isRequested) return "Angefragt";
    return "Folgen";
  }, [rel.isFollowing, rel.isRequested]);

  const FollowButtonStyle = useMemo(() => {
    if (rel.isFollowing) return styles.followed;
    if (rel.isRequested) return styles.requested;
    return styles.toFollow;
  }, [rel.isFollowing, rel.isRequested]);

  const FollowTextStyle = useMemo(() => {
    if (rel.isFollowing) return { color: TXT };
    if (rel.isRequested) return { color: TXT };
    return { color: "#0b0b0b" };
  }, [rel.isFollowing, rel.isRequested]);

  const Header = () => (
    <View style={styles.headerWrap} pointerEvents="box-none">
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.9}>
          <Ionicons name="chevron-back" size={20} color={TXT} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          @{user?.username || "User"}
        </Text>

        {!!viewer?.id && viewer.id !== user?.id ? (
          <TouchableOpacity onPress={() => setOptionsOpen(true)} style={styles.iconBtn} activeOpacity={0.9}>
            <Ionicons name="ellipsis-vertical" size={18} color={TXT} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={20} color={TXT} />
          </View>
        )}
      </View>

      <View style={styles.heroRow}>
        <TouchableOpacity
          activeOpacity={hasStories ? 0.9 : 1}
          onPress={() => {
            if (!hasStories || !user?.id) return;

            if (!canViewContent && !rel.isSelf) {
              Alert.alert("Privater Account", "Folge dem Account, um Stories zu sehen.");
              return;
            }

            router.push({
              pathname: "/stories/[userId]",
              params: { userId: String(user.id) },
            });
          }}
        >
          <View style={[styles.avatarWrap, hasStories && styles.avatarHasStories]}>
            <Image source={{ uri: user?.avatarUrl || FALLBACK_AVATAR }} style={styles.avatarImg} />
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

        {!!viewer?.id && viewer.id !== user?.id && !blockedByMe && (
          <TouchableOpacity onPress={toggleFollow} activeOpacity={0.9} style={[styles.followBtn, FollowButtonStyle]}>
            <Text style={[styles.followTxt, FollowTextStyle]}>{FollowButtonText}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statsLeftRow}>
          <TouchableOpacity onPress={openFollowers} activeOpacity={0.85} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.statNum}>{rel.followersCount}</Text>
            <Text style={styles.statLbl}>Follower</Text>
          </TouchableOpacity>

          <View style={styles.statDot} />

          <TouchableOpacity onPress={openFollowing} activeOpacity={0.85} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.statNum}>{rel.followingCount}</Text>
            <Text style={styles.statLbl}>Following</Text>
          </TouchableOpacity>
        </View>

        {!!viewer?.id && viewer.id !== user?.id && !blockedByMe && (
          <TouchableOpacity
            onPress={handleMessagePress}
            activeOpacity={0.9}
            style={[styles.messageBtn, isPrivateLocked && { borderColor: BORDER, opacity: 0.55 }]}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={TXT} style={{ marginRight: 6 }} />
            <Text style={styles.messageTxt}>Nachricht</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabsRow}>
        <TabChip label="Bilder" icon="images-outline" active={activeTab === "images"} onPress={() => setActiveTab("images")} />
        <TabChip label="Snippets" icon="musical-note-outline" active={activeTab === "snippets"} onPress={() => setActiveTab("snippets")} />
        <TabChip label="Musik" icon="headset-outline" active={activeTab === "music"} onPress={() => setActiveTab("music")} />
      </View>

      {!canViewContent && !rel.isSelf && !blockedByMe && (
        <View style={styles.privateWallInHeader}>
          <Ionicons name="lock-closed-outline" size={20} color={ACCENT} />
          <View style={{ flex: 1 }}>
            <Text style={styles.privateTitle}>Privater Account</Text>
            <Text style={styles.privateDesc}>Folge diesem Account, um Bilder, Snippets, Musik und Stories zu sehen.</Text>
            {rel.isRequested && <Text style={styles.privateDesc2}>Status: Anfrage gesendet (Warten auf Bestätigung)</Text>}
          </View>
        </View>
      )}

      {blockedByMe && !rel.isSelf && (
        <View style={styles.privateWallInHeader}>
          <Ionicons name="hand-left-outline" size={20} color={ACCENT} />
          <View style={{ flex: 1 }}>
            <Text style={styles.privateTitle}>Du hast diesen Nutzer blockiert</Text>
            <Text style={styles.privateDesc}>Du kannst Inhalte und Interaktionen erst wieder sehen, wenn du den Account entblockst.</Text>
            <TouchableOpacity
              onPress={confirmUnblock}
              activeOpacity={0.9}
              style={[styles.followBtn, styles.requested, { alignSelf: "flex-start", marginTop: 10 }]}
              disabled={blockBusy}
            >
              {blockBusy ? <ActivityIndicator color={TXT} /> : <Text style={[styles.followTxt, { color: TXT }]}>Entblocken</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Options Modal */}
      <Modal visible={optionsOpen} transparent animationType="fade" onRequestClose={() => setOptionsOpen(false)}>
        <View style={styles.modalBg}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject as any}
            activeOpacity={1}
            onPress={() => setOptionsOpen(false)}
          />

          <View style={styles.optionsCard}>
            <Text style={styles.optionsTitle}>Optionen</Text>

            <View style={{ height: 10 }} />

            {!blockedByMe ? (
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.optionRow, { borderColor: "#3a1212" }]}
                onPress={confirmBlock}
                disabled={blockBusy}
              >
                <Ionicons name="hand-left-outline" size={18} color="#ff6b6b" />
                <Text style={[styles.optionText, { color: "#ff6b6b" }]}>
                  {blockBusy ? "Bitte warten…" : `@${user?.username || "user"} blockieren`}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.optionRow}
                onPress={confirmUnblock}
                disabled={blockBusy}
              >
                <Ionicons name="remove-circle-outline" size={18} color={ACCENT} />
                <Text style={[styles.optionText, { color: ACCENT }]}>
                  {blockBusy ? "Bitte warten…" : `@${user?.username || "user"} entblocken`}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.optionRow}
              onPress={() => {
                setOptionsOpen(false);
                Alert.alert("Gemeldet", "Danke. Wir prüfen das.");
              }}
            >
              <Ionicons name="flag-outline" size={18} color={TXT} />
              <Text style={styles.optionText}>Melden</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.optionRow, { borderColor: BORDER }]}
              onPress={() => setOptionsOpen(false)}
            >
              <Ionicons name="close-outline" size={18} color={TXT_DIM} />
              <Text style={[styles.optionText, { color: TXT_DIM }]}>Schließen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

      {activeTab === "images" && canViewContent && !blockedByMe && (
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
              <Image source={{ uri: item.url }} style={{ width: "100%", aspectRatio: 1 }} resizeMode="cover" />
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 90 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={doRefresh} tintColor={TXT} />}
          removeClippedSubviews
          windowSize={9}
          initialNumToRender={6}
        />
      )}

      {activeTab === "snippets" && canViewContent && !blockedByMe && (
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
              <Image source={{ uri: item.thumbnail || FALLBACK_COVER }} style={{ width: "100%", aspectRatio: 1 }} />
              <View style={styles.snippetRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: TXT, fontWeight: "900" }} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={{ color: TXT_DIM, marginTop: 2 }}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={doRefresh} tintColor={TXT} />}
          removeClippedSubviews
          windowSize={9}
          initialNumToRender={6}
        />
      )}

      {activeTab === "music" && canViewContent && !blockedByMe && (
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
              <Image source={{ uri: item.cover || FALLBACK_COVER }} style={styles.trackCover} />
              <View style={{ flex: 1, paddingVertical: 6, paddingRight: 8 }}>
                <TouchableOpacity onPress={() => router.push(`/profile/${user?.id}`)} activeOpacity={0.85}>
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.trackMeta} numberOfLines={1}>
                    @{user?.username || "user"}
                  </Text>
                </TouchableOpacity>
              </View>
              <TrackPlayButton track={{ id: item.id, title: item.title, url: item.url, cover: item.cover || undefined }} size={30} />
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 90, paddingHorizontal: 12, gap: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={doRefresh} tintColor={TXT} />}
          removeClippedSubviews
          windowSize={9}
          initialNumToRender={8}
        />
      )}

      {(!canViewContent || blockedByMe) && (
        <FlatList
          key="locked"
          data={[]}
          keyExtractor={() => "locked"}
          ListHeaderComponent={Header}
          renderItem={null as any}
          contentContainerStyle={{ paddingBottom: 90 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={doRefresh} tintColor={TXT} />}
        />
      )}

      <AudioMiniPlayer />

      <Modal visible={!!listOpen} transparent animationType="fade" onRequestClose={() => setListOpen(null)}>
        <View style={styles.modalBg}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject as any} activeOpacity={1} onPress={() => setListOpen(null)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{listOpen === "followers" ? "Follower" : "Following"}</Text>

            {listBusy ? (
              <View style={{ paddingVertical: 12, alignItems: "center" }}>
                <ActivityIndicator color={TXT} />
              </View>
            ) : (
              <FlatList
                data={listOpen === "followers" ? followersList : followingList}
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
                    <Image source={{ uri: item.avatarUrl || FALLBACK_AVATAR }} style={styles.userAvatar} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: TXT, fontWeight: "900" }} numberOfLines={1}>
                        @{item.username || "user"}
                      </Text>
                      <Text style={{ color: TXT_DIM }} numberOfLines={1}>
                        {item.email}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#888" />
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.chip, active && styles.chipActive]}>
      <Ionicons name={icon} size={14} color={active ? "#0b0b0b" : TXT_DIM} style={{ marginRight: 6 }} />
      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{label}</Text>
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
  headerTitle: { color: TXT, fontWeight: "900", fontSize: 16, maxWidth: "68%" },

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

  heroRow: { flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 10 },
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

  followBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, marginLeft: 8 },
  toFollow: { backgroundColor: ACCENT, borderColor: ACCENT },
  followed: { backgroundColor: "#1c1c1c", borderColor: BORDER },
  requested: { backgroundColor: "#1c1c1c", borderColor: ACCENT },
  followTxt: { color: "#0b0b0b", fontWeight: "900" },

  statsRow: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statsLeftRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  statNum: { color: TXT, fontWeight: "900", fontSize: 16, textAlign: "center" },
  statLbl: { color: TXT_DIM, fontWeight: "700", textAlign: "center" },
  statDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#333", marginHorizontal: 8 },

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
  messageTxt: { color: TXT, fontWeight: "800", fontSize: 12 },

  tabsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 4 },
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
  snippetRow: { padding: 10, flexDirection: "row", alignItems: "center", gap: 10 },

  trackCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 6,
  },
  trackCover: { width: 58, height: 58, borderRadius: 10, backgroundColor: "#222", marginRight: 10 },
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
  modalTitle: { color: TXT, fontWeight: "900", fontSize: 16, marginBottom: 8 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f0f0f",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 8,
  },
  userAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: "#222" },

  privateWallInHeader: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: CARD,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  privateTitle: { color: TXT, fontWeight: "900", fontSize: 14 },
  privateDesc: { color: TXT_DIM, marginTop: 2, lineHeight: 18 },
  privateDesc2: { color: ACCENT, marginTop: 6, fontWeight: "800" },

  optionsCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#101010",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  optionsTitle: { color: TXT, fontWeight: "900", fontSize: 16 },
  optionRow: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#0f0f0f",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  optionText: { color: TXT, fontWeight: "800", fontSize: 13, flex: 1 },
});

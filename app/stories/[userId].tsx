// app/stories/[userId].tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ResizeMode, Video } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const BG = "#000";
const TEXT = "#fff";
const TEXT_DIM = "#aaa";
const ACCENT = "#ff4fd8";

const API = process.env.EXPO_PUBLIC_API_URL || "http://192.168.0.224:5000";
const STORY_DURATION = 7000; // 7s pro Story

type StoryKind = "image" | "video";

type StoryItem = {
  id: string;
  userId: string;

  // Backwards compatibility
  imageUrl?: string;

  // optional
  videoUrl?: string;
  kind?: StoryKind;

  createdAt: string;

  viewsCount?: number;
  likesCount?: number;
  likedByMe?: boolean;

  viewers?: string[]; // userIds
  likers?: string[]; // userIds
};

type MiniUser = {
  id: string;
  username?: string;
  name?: string;
  avatarUrl?: string;
};

export default function StoryViewerScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets(); // ✅ NOTCH / SAFE AREA

  const [stories, setStories] = useState<StoryItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const [viewerId, setViewerId] = useState<string | null>(null);

  // Reply (nur bei fremder Story)
  const [comment, setComment] = useState("");

  // progress
  const progress = useRef(new Animated.Value(0)).current;

  // viewed anti-spam
  const viewedRef = useRef<Set<string>>(new Set());

  // like animation
  const likeScale = useRef(new Animated.Value(1)).current;

  // Video ref (wichtig für stop/pause beim wechseln)
  const videoRef = useRef<Video | null>(null);

  // Activity modal (nur bei eigener Story)
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [viewerUsers, setViewerUsers] = useState<MiniUser[]>([]);
  const [likerUsers, setLikerUsers] = useState<MiniUser[]>([]);
  const sheetY = useRef(new Animated.Value(500)).current;

  // Cache user fetches
  const userCacheRef = useRef<Map<string, MiniUser>>(new Map());

  const absolutizeUrl = (url?: string | null) => {
    if (!url) return "";
    const s = String(url);
    if (s.startsWith("file://") || /^https?:\/\//i.test(s)) return s;
    return `${API.replace(/\/$/, "")}/${s.replace(/^\/+/, "")}`;
  };

  const safeBack = useCallback(() => {
    requestAnimationFrame(() => {
      try {
        router.back();
      } catch {}
    });
  }, [router]);

  const loadViewerId = useCallback(async (): Promise<string | null> => {
    const candidates = ["user", "@user", "ayo_user", "auth_user"];
    for (const key of candidates) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      try {
        const obj = JSON.parse(raw);
        const u = obj?.user?.id ? obj.user : obj;
        if (u?.id) return String(u.id);
      } catch {}
    }
    return null;
  }, []);

  const fetchMiniUser = useCallback(async (uid: string): Promise<MiniUser> => {
    const cached = userCacheRef.current.get(uid);
    if (cached) return cached;

    try {
      const res = await fetch(`${API.replace(/\/$/, "")}/users/${uid}`);
      if (!res.ok) {
        // fallback: KEINE ID anzeigen später, aber intern behalten wir id natürlich
        const fallback = { id: uid, username: uid.slice(0, 8) } as MiniUser;
        userCacheRef.current.set(uid, fallback);
        return fallback;
      }
      const json = await res.json();
      const u = (json?.user || json || {}) as any;

      const mini: MiniUser = {
        id: String(u.id || uid),
        username: u.username ? String(u.username) : undefined,
        name: u.name ? String(u.name) : undefined,
        avatarUrl: u.avatarUrl ? absolutizeUrl(String(u.avatarUrl)) : undefined,
      };
      userCacheRef.current.set(uid, mini);
      return mini;
    } catch {
      const fallback = { id: uid, username: uid.slice(0, 8) } as MiniUser;
      userCacheRef.current.set(uid, fallback);
      return fallback;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const guessKindFromUrl = (url: string): StoryKind => {
    const u = (url || "").toLowerCase();
    if (
      u.includes(".mp4") ||
      u.includes(".mov") ||
      u.includes(".m4v") ||
      u.includes(".webm")
    ) {
      return "video";
    }
    return "image";
  };

  const loadStories = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const vId = await loadViewerId();
      setViewerId(vId);

      const viewerParam = vId || String(userId);

      const res = await fetch(
        `${API.replace(/\/$/, "")}/stories/users/${userId}?viewer=${viewerParam}`
      );

      if (!res.ok) {
        console.log("story viewer status", res.status);
        setStories([]);
        return;
      }

      const json = await res.json();
      const rawList = (json?.stories || json || []) as any[];

      const mapped: StoryItem[] = rawList
        .map((s) => {
          const viewersArr: string[] = Array.isArray(s.viewers)
            ? s.viewers.map((x: any) => String(x))
            : Array.isArray(s.views)
            ? s.views.map((v: any) => String(v.userId || v))
            : [];

          const likersArr: string[] = Array.isArray(s.likers)
            ? s.likers.map((x: any) => String(x))
            : Array.isArray(s.likes)
            ? s.likes.map((v: any) => String(v.userId || v))
            : [];

          // ✅ Medien-URL aus allen möglichen Feldern ziehen
          const imageUrl = s.imageUrl || s.url || s.image || "";
          const videoUrl = s.videoUrl || s.video || s.video_path || "";

          const kindFromServer: StoryKind | undefined =
            s.kind === "video" || s.kind === "image" ? s.kind : undefined;

          const resolvedUrl = videoUrl || imageUrl || "";
          const resolvedKind: StoryKind =
            kindFromServer || guessKindFromUrl(resolvedUrl);

          return {
            id: String(s.id),
            userId: String(s.userId || userId),

            imageUrl: imageUrl || undefined,
            videoUrl: videoUrl || undefined,
            kind: resolvedKind,

            createdAt: s.createdAt || new Date().toISOString(),

            viewsCount:
              typeof s.viewsCount === "number" ? s.viewsCount : viewersArr.length,
            likesCount:
              typeof s.likesCount === "number" ? s.likesCount : likersArr.length,
            likedByMe: !!s.likedByMe,

            viewers: viewersArr,
            likers: likersArr,
          } as StoryItem;
        })
        .filter((s) => !!(s.videoUrl || s.imageUrl));

      setStories(mapped);
      viewedRef.current = new Set();
      setIndex(0);
      setComment("");
    } catch (e) {
      console.log("loadStories viewer error", e);
      Alert.alert("Fehler", "Stories konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [userId, loadViewerId]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const story = stories[index];

  const storyMedia = useMemo(() => {
    if (!story) return { kind: "image" as StoryKind, url: "" };
    const url = absolutizeUrl(story.videoUrl || story.imageUrl || "");
    const kind = story.kind || guessKindFromUrl(url);
    return { kind, url };
  }, [story]);

  const isOwnStory = useMemo(() => {
    if (!viewerId || !story?.userId) return false;
    return String(viewerId) === String(story.userId);
  }, [viewerId, story?.userId]);

  // ---- SERVER: mark viewed
  const markViewed = useCallback(
    async (storyId: string) => {
      if (!viewerId) return;
      if (viewedRef.current.has(storyId)) return;
      viewedRef.current.add(storyId);

      try {
        const res = await fetch(
          `${API.replace(/\/$/, "")}/stories/${storyId}/view`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ viewerId }),
          }
        );
        if (!res.ok) return;
        const json = await res.json();

        setStories((prev) =>
          prev.map((s) =>
            s.id === storyId
              ? {
                  ...s,
                  viewsCount:
                    typeof json.viewsCount === "number"
                      ? json.viewsCount
                      : s.viewsCount ?? 0,
                }
              : s
          )
        );
      } catch (e) {
        console.log("markViewed error", e);
      }
    },
    [viewerId]
  );

  // ✅ FIX: Video stoppen beim Wechseln
  const stopVideo = useCallback(async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.stopAsync();
      }
    } catch {}
  }, []);

  const goNext = useCallback(() => {
    progress.stopAnimation();
    setComment("");
    stopVideo();

    const next = index + 1;
    if (next >= stories.length) {
      safeBack();
      return;
    }
    setIndex(next);
  }, [index, stories.length, progress, safeBack, stopVideo]);

  const goPrev = useCallback(() => {
    progress.stopAnimation();
    setComment("");
    stopVideo();

    const prev = index - 1;
    if (prev < 0) {
      safeBack();
      return;
    }
    setIndex(prev);
  }, [index, progress, safeBack, stopVideo]);

  // progress animation + mark viewed
  useEffect(() => {
    if (!stories.length) return;
    const current = stories[index];
    if (current?.id) markViewed(current.id);

    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION,
      easing: Easing.linear,
      useNativeDriver: false,
    });

    anim.start(({ finished }) => {
      if (finished) goNext();
    });

    return () => {
      progress.stopAnimation();
    };
  }, [index, stories, goNext, markViewed, progress]);

  // swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, g) => {
        const { dx, dy } = g;
        return Math.abs(dx) > 10 || Math.abs(dy) > 10;
      },
      onPanResponderRelease: (_evt, g) => {
        const { dx, dy } = g;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // swipe down -> close
        if (absDy > absDx && dy > 25) {
          progress.stopAnimation();
          stopVideo();
          safeBack();
          return;
        }

        if (absDx > 25) {
          if (dx < 0) goNext();
          else goPrev();
        }
      },
    })
  ).current;

  // ---- Like
  const toggleLike = useCallback(async () => {
    const current = stories[index];
    if (!current || !viewerId) return;

    try {
      const res = await fetch(
        `${API.replace(/\/$/, "")}/stories/${current.id}/like`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: viewerId }),
        }
      );
      if (!res.ok) return;
      const json = await res.json();

      setStories((prev) =>
        prev.map((s, i) =>
          i === index
            ? {
                ...s,
                likedByMe:
                  typeof json.liked === "boolean" ? json.liked : !s.likedByMe,
                likesCount:
                  typeof json.likesCount === "number"
                    ? json.likesCount
                    : s.likesCount ?? 0,
              }
            : s
        )
      );

      likeScale.setValue(1);
      Animated.sequence([
        Animated.timing(likeScale, {
          toValue: 1.25,
          duration: 110,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(likeScale, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (e) {
      console.log("toggleLike error", e);
    }
  }, [stories, index, viewerId, likeScale]);

  // ---- Activity (eigene Story)
  const openActivity = useCallback(async () => {
    if (!isOwnStory) return;

    setActivityOpen(true);
    setActivityLoading(true);

    sheetY.setValue(500);
    Animated.timing(sheetY, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    try {
      const current = stories[index];
      const viewIds = (current?.viewers || []).filter(Boolean);
      const likeIds = (current?.likers || []).filter(Boolean);

      const viewers = await Promise.all(viewIds.map(fetchMiniUser));
      const likers = await Promise.all(likeIds.map(fetchMiniUser));

      setViewerUsers(viewers);
      setLikerUsers(likers);
    } catch (e) {
      console.log("openActivity error", e);
    } finally {
      setActivityLoading(false);
    }
  }, [isOwnStory, stories, index, fetchMiniUser, sheetY]);

  const closeActivity = useCallback(() => {
    Animated.timing(sheetY, {
      toValue: 500,
      duration: 180,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setActivityOpen(false);
    });
  }, [sheetY]);

  // ---- Reply send (nur bei fremder Story)
  const sendCommentToChat = useCallback(() => {
    const text = comment.trim();
    if (!text) return;

    const current = stories[index];
    if (!current) return;

    if (viewerId && String(viewerId) === String(current.userId)) {
      Alert.alert("Hinweis", "Du kannst deine eigene Story nicht kommentieren.");
      return;
    }

    progress.stopAnimation();
    stopVideo();

    router.push({
      pathname: "/chat/[id]",
      params: {
        id: current.userId,
        fromStory: "1",
        storyId: current.id,
        storyImage: absolutizeUrl(current.imageUrl || current.videoUrl || ""),
        storyCreatedAt: current.createdAt,
        presetText: text,
      },
    });

    setComment("");
  }, [comment, stories, index, router, progress, viewerId, stopVideo]);

  const addEmoji = (emoji: string) => {
    setComment((prev) => (prev ? prev + " " + emoji : emoji));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  if (!stories.length || !story) {
    return (
      <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.center}>
          <Text style={{ color: TEXT_DIM }}>Keine Stories vorhanden.</Text>
          <TouchableOpacity onPress={() => safeBack()} style={{ marginTop: 16 }}>
            <Text style={{ color: ACCENT, fontWeight: "700" }}>Zurück</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const viewsCount = story.viewsCount ?? story.viewers?.length ?? 0;
  const likesCount = story.likesCount ?? story.likers?.length ?? 0;

  return (
    <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ✅ TOP OVERLAY MIT NOTCH-INSETS */}
      <View
        style={[
          styles.topOverlay,
          { paddingTop: insets.top + 8 }, // ✅ unter den Notch
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.progressBarWrap}>
          {stories.map((s, i) => {
            const isPast = i < index;
            const isActive = i === index;

            return (
              <View key={s.id} style={styles.progressItem}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    isPast && { width: "100%" },
                    !isPast && !isActive && { width: "0%" },
                    isActive && {
                      width: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0%", "100%"],
                      }),
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>

        <View style={[styles.topRightRow, { top: insets.top + 10 }]}>
          {isOwnStory && (
            <TouchableOpacity
              onPress={openActivity}
              activeOpacity={0.9}
              style={styles.topEyeBtn}
            >
              <Ionicons name="eye-outline" size={20} color={TEXT} />
              <Text style={styles.topEyeText}>{viewsCount}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              progress.stopAnimation();
              stopVideo();
              safeBack();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.topCloseBtn}
          >
            <Ionicons name="close" size={24} color={TEXT} />
          </TouchableOpacity>
        </View>
      </View>

      {/* STORY */}
      <View style={styles.storyContainer} {...panResponder.panHandlers}>
        <View style={styles.touchRow} pointerEvents="box-none">
          <TouchableOpacity style={{ flex: 1 }} onPress={goPrev} />
          <TouchableOpacity style={{ flex: 1 }} onPress={goNext} />
        </View>

        {/* ✅ Video vs Image */}
        {storyMedia.kind === "video" ? (
          <Video
            ref={videoRef}
            source={{ uri: storyMedia.url }}
            style={styles.storyImage}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            useNativeControls={false}
          />
        ) : (
          <Image
            source={{ uri: storyMedia.url }}
            style={styles.storyImage}
            resizeMode="cover"
          />
        )}

        <View style={styles.bottomLeftOverlay}>
          <Text style={styles.metaText}>
            {index + 1}/{stories.length} •{" "}
            {new Date(story.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>

          {isOwnStory && (
            <TouchableOpacity
              onPress={openActivity}
              activeOpacity={0.9}
              style={styles.seenBubble}
            >
              <Text style={styles.seenBubbleText}>
                {viewsCount > 0 ? `Gesehen von ${viewsCount}` : "Noch keine Aufrufe"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {!isOwnStory && (
          <View style={styles.bottomRightOverlay}>
            <TouchableOpacity
              onPress={toggleLike}
              activeOpacity={0.9}
              style={styles.iconBubble}
            >
              <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                <Ionicons
                  name={story.likedByMe ? "heart" : "heart-outline"}
                  size={22}
                  color={story.likedByMe ? ACCENT : TEXT}
                />
              </Animated.View>
              <Text style={styles.iconCount}>{likesCount}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* BOTTOM */}
      {isOwnStory ? (
        <View style={styles.ownActionBar}>
          <TouchableOpacity style={styles.actionItem} onPress={openActivity}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="person-outline" size={20} color={TEXT} />
            </View>
            <Text style={styles.actionLabel}>Aktivität</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => Alert.alert("Highlight", "Kommt als nächstes 😉")}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons name="heart-outline" size={20} color={TEXT} />
            </View>
            <Text style={styles.actionLabel}>Highlight</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => Alert.alert("Erwähnen", "Kommt als nächstes 😉")}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons name="at" size={20} color={TEXT} />
            </View>
            <Text style={styles.actionLabel}>Erwähnen</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => Alert.alert("Senden", "Kommt als nächstes 😉")}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons name="paper-plane-outline" size={20} color={TEXT} />
            </View>
            <Text style={styles.actionLabel}>Senden</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => Alert.alert("Mehr", "Kommt als nächstes 😉")}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons name="ellipsis-horizontal" size={20} color={TEXT} />
            </View>
            <Text style={styles.actionLabel}>Mehr</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
        >
          <View style={styles.replyBar}>
            <View style={styles.inputWrap}>
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Schreib etwas…"
                placeholderTextColor={TEXT_DIM}
                style={styles.input}
                multiline={false}
                returnKeyType="send"
                onSubmitEditing={sendCommentToChat}
              />

              <View style={styles.emojiRow}>
                <TouchableOpacity onPress={() => addEmoji("😍")}>
                  <Text style={styles.emoji}>😍</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => addEmoji("😂")}>
                  <Text style={styles.emoji}>😂</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => addEmoji("😳")}>
                  <Text style={styles.emoji}>😳</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={sendCommentToChat}
              activeOpacity={0.9}
              style={styles.sendBtn}
            >
              <Ionicons name="send" size={18} color={TEXT} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ACTIVITY MODAL */}
      <Modal visible={activityOpen} transparent animationType="none">
        <Pressable style={styles.modalBackdrop} onPress={closeActivity} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Aktivität</Text>
            <TouchableOpacity onPress={closeActivity} hitSlop={12}>
              <Ionicons name="close" size={22} color={TEXT} />
            </TouchableOpacity>
          </View>

          <View style={styles.sheetStatsRow}>
            <View style={styles.statPill}>
              <Ionicons name="eye-outline" size={18} color={TEXT} />
              <Text style={styles.statText}>{viewsCount} Aufrufe</Text>
            </View>

            <View style={styles.statPill}>
              <Ionicons name="heart-outline" size={18} color={TEXT} />
              <Text style={styles.statText}>{likesCount} Likes</Text>
            </View>
          </View>

          {activityLoading ? (
            <View style={{ paddingVertical: 18 }}>
              <ActivityIndicator color={TEXT} />
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Gesehen von</Text>
              {viewerUsers.length ? (
                <View style={styles.list}>
                  {viewerUsers.map((u) => (
                    <View key={u.id} style={styles.userRow}>
                      <View style={styles.avatar}>
                        {u.avatarUrl ? (
                          <Image source={{ uri: u.avatarUrl }} style={styles.avatarImg} />
                        ) : (
                          <Ionicons name="person" size={16} color={TEXT_DIM} />
                        )}
                      </View>

                      {/* ✅ NUR NAME/USERNAME — KEINE ID */}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userName}>
                          {u.username ? `@${u.username}` : u.name || "Unbekannt"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>Noch niemand.</Text>
              )}

              <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Geliked von</Text>
              {likerUsers.length ? (
                <View style={styles.list}>
                  {likerUsers.map((u) => (
                    <View key={u.id} style={styles.userRow}>
                      <View style={styles.avatar}>
                        {u.avatarUrl ? (
                          <Image source={{ uri: u.avatarUrl }} style={styles.avatarImg} />
                        ) : (
                          <Ionicons name="person" size={16} color={TEXT_DIM} />
                        )}
                      </View>

                      {/* ✅ NUR NAME/USERNAME — KEINE ID */}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userName}>
                          {u.username ? `@${u.username}` : u.name || "Unbekannt"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>Noch niemand.</Text>
              )}
            </>
          )}
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  topOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 50,
    paddingHorizontal: 10,
  },
  progressBarWrap: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 8,
  },
  progressItem: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: ACCENT,
  },
  topRightRow: {
    position: "absolute",
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  topEyeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  topEyeText: {
    color: TEXT,
    marginLeft: 6,
    fontWeight: "800",
    fontSize: 12,
  },
  topCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  storyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  touchRow: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    zIndex: 5,
  },
  storyImage: {
    width: "100%",
    height: "100%",
  },

  bottomLeftOverlay: {
    position: "absolute",
    left: 12,
    bottom: 88,
    zIndex: 10,
    gap: 6,
  },
  metaText: {
    color: TEXT,
    fontSize: 13,
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  seenBubble: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  seenBubbleText: {
    color: TEXT_DIM,
    fontSize: 12,
    fontWeight: "700",
  },

  bottomRightOverlay: {
    position: "absolute",
    right: 12,
    bottom: 92,
    zIndex: 10,
    alignItems: "flex-end",
  },
  iconBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  iconCount: {
    color: TEXT,
    fontWeight: "800",
    fontSize: 13,
  },

  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.9)",
  },
  inputWrap: {
    flex: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#111",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  input: {
    flex: 1,
    color: TEXT,
    fontSize: 14,
    paddingVertical: 4,
    paddingRight: 8,
  },
  emojiRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  emoji: { fontSize: 18 },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT,
  },

  ownActionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0,0,0,0.92)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  actionItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: 64,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  actionLabel: {
    color: TEXT,
    fontSize: 11,
    fontWeight: "700",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0b0b0b",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
  },
  sheetTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "900",
  },
  sheetStatsRow: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 10,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  statText: {
    color: TEXT,
    fontWeight: "800",
    fontSize: 13,
  },
  sectionTitle: {
    color: TEXT_DIM,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 6,
    marginBottom: 8,
  },
  list: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    paddingVertical: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  userName: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 13,
  },
  emptyText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    paddingVertical: 8,
  },
});

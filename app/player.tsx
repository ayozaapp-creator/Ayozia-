// app/player.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  GestureResponderEvent,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import audio, { useAudioSnapshot } from "../server/lib/audiocontroller";
import socket from "./lib/socket"; // 🔌 Socket.IO-Client

const API = "http://192.168.0.224:5000";

const http = axios.create({ baseURL: API, timeout: 15000 });

const PINK = "#ff2fb6";

function formatTime(ms?: number | null) {
  if (!ms || ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

type LiveStats = {
  plays: number;
  likes: number;
  saves: number;
};

export default function PlayerScreen() {
  const router = useRouter();
  const { snapshot, subscribe } = useAudioSnapshot();
  const [snap, setSnap] = useState<any>(snapshot as any);

  const [progressWidth, setProgressWidth] = useState(0);

  // aktueller User
  const [meId, setMeId] = useState<string | null>(null);

  // Likes nur 1x pro Account+Track (persistiert)
  const [hasLiked, setHasLiked] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  // Live-Stats von Socket + HTTP
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);

  // Einfaches Kommentar-Overlay (Frontend only)
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    const unsubscribe = subscribe(setSnap);
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [subscribe]);

  // User aus AsyncStorage holen
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("user");
        if (!raw) {
          setMeId(null);
          return;
        }
        const parsed = JSON.parse(raw);
        if (parsed?.id) {
          setMeId(String(parsed.id));
        } else {
          setMeId(null);
        }
      } catch {
        setMeId(null);
      }
    })();
  }, []);

  const track = snap?.current ?? null;
  const isPlaying = !!snap?.isPlaying;
  const positionMs: number = snap?.positionMs ?? 0;
  const durationMs: number =
    snap?.durationMs ?? track?.durationMs ?? 0;

  // ───────────── Keine Musik aktiv ─────────────
  if (!track) {
    return (
      <View style={styles.emptyContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.emptyText}>
          Kein Track aktiv. Starte etwas im Feed.
        </Text>
      </View>
    );
  }

  const title = track.title || track.name || "Unbenannter Track";
  const artist =
    track.user?.username ||
    track.username ||
    track.artist ||
    "Unbekannt";
  const coverUri = track.cover || track.artwork || null;

  // Basis-Stats aus Track / Snapshot
  const baseStats = track.stats || snap?.stats || {};
  const basePlays =
    typeof baseStats.plays === "number"
      ? baseStats.plays
      : typeof track.playCount === "number"
      ? track.playCount
      : typeof track.plays === "number"
      ? track.plays
      : 0;

  const baseLikes =
    typeof baseStats.likes === "number"
      ? baseStats.likes
      : typeof track.likeCount === "number"
      ? track.likeCount
      : typeof track.likes === "number"
      ? track.likes
      : 0;

  const coins =
    typeof baseStats.coins === "number"
      ? baseStats.coins
      : typeof track.coins === "number"
      ? track.coins
      : 0;

  // Schlüssel für Local-Like (User+Track)
  const likeKey =
    meId && track?.id ? `like:${meId}:${String(track.id)}` : null;

  // Beim Track-Wechsel / User-Wechsel: prüfen, ob bereits geliked
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!likeKey) {
        setHasLiked(false);
        return;
      }
      try {
        const v = await AsyncStorage.getItem(likeKey);
        if (!cancelled) {
          setHasLiked(v === "1");
        }
      } catch {
        if (!cancelled) setHasLiked(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [likeKey]);

  // Effektive Zahlen (Socket > Track)
  const effectivePlays = liveStats?.plays ?? basePlays;
  const effectiveLikes = liveStats?.likes ?? baseLikes;

  // ───────────── Socket-Listener für track:update ─────────────
  useEffect(() => {
    const trackId = track?.id ? String(track.id) : null;
    if (!trackId) return;

    // Initiale Stats aus Track setzen
    setLiveStats((prev) => ({
      plays: prev?.plays ?? basePlays,
      likes: prev?.likes ?? baseLikes,
      saves: prev?.saves ?? 0,
    }));

    const handler = (payload: any) => {
      if (!payload) return;
      if (String(payload.trackId) !== trackId) return;

      setLiveStats({
        plays:
          typeof payload.plays === "number"
            ? payload.plays
            : basePlays,
        likes:
          typeof payload.likes === "number"
            ? payload.likes
            : baseLikes,
        saves:
          typeof payload.saves === "number"
            ? payload.saves
            : 0,
      });
    };

    socket.on("track:update", handler);

    return () => {
      socket.off("track:update", handler);
    };
  }, [track?.id, basePlays, baseLikes]);

  // ───────────── Player Actions ─────────────
  const handleTogglePlay = () => {
    audio.toggle(track);
  };

  const handleSeekOnBar = (e: GestureResponderEvent) => {
    if (!durationMs || durationMs <= 0 || !progressWidth) return;
    const x = e.nativeEvent.locationX;
    const ratio = Math.min(Math.max(x / progressWidth, 0), 1);
    const target = ratio * durationMs;

    const anyAudio: any = audio;
    if (typeof anyAudio.seekTo === "function") {
      anyAudio.seekTo(target);
    } else if (typeof anyAudio.seek === "function") {
      anyAudio.seek(ratio);
    }
  };

  // ▶️◀️ Track vorher / nächster Track über AudioController
  const handlePrev = () => {
    const anyAudio: any = audio;
    if (typeof anyAudio.prev === "function") {
      anyAudio.prev();
    }
  };

  const handleNext = () => {
    const anyAudio: any = audio;
    if (typeof anyAudio.next === "function") {
      anyAudio.next();
    }
  };

  const handleLike = async () => {
    if (!track.id) return;

    if (!meId) {
      Alert.alert(
        "Nicht eingeloggt",
        "Bitte logge dich ein, um Tracks zu liken."
      );
      return;
    }

    if (hasLiked || isLiking) return; // nur 1x pro Account+Track

    try {
      setIsLiking(true);

      // Optimistisch vorziehen
      setLiveStats((prev) => ({
        plays: prev?.plays ?? basePlays,
        likes: (prev?.likes ?? baseLikes) + 1,
        saves: prev?.saves ?? 0,
      }));

      const { data } = await http.post<{
        likes?: number;
        plays?: number;
        saves?: number;
      }>(`/tracks/${track.id}/like`, {
        userId: meId, // ⚠️ Server kann das später nutzen, um pro User zu limitieren
      });

      setLiveStats((prev) => ({
        plays:
          typeof data?.plays === "number"
            ? data.plays
            : prev?.plays ?? basePlays,
        likes:
          typeof data?.likes === "number"
            ? data.likes
            : prev?.likes ?? baseLikes + 1,
        saves:
          typeof data?.saves === "number"
            ? data.saves
            : prev?.saves ?? 0,
      }));

      setHasLiked(true);
      if (likeKey) {
        await AsyncStorage.setItem(likeKey, "1");
      }
    } catch (e) {
      Alert.alert("Fehler", "Like konnte nicht gespeichert werden.");
      // Optimistischen Like wieder zurücknehmen
      setLiveStats((prev) => ({
        plays: prev?.plays ?? basePlays,
        likes: baseLikes,
        saves: prev?.saves ?? 0,
      }));
      setHasLiked(false);
      if (likeKey) {
        await AsyncStorage.removeItem(likeKey);
      }
    } finally {
      setIsLiking(false);
    }
  };

  const handleReport = () => {
    // TODO: später echten /tracks/:id/report Endpoint anbinden
    Alert.alert(
      "Song gemeldet",
      "Danke dir! Unser Team prüft diesen Upload."
    );
  };

  const handleShare = () => {
    Alert.alert("Teilen", "Share-Feature kommt noch 😉");
  };

  const handleOpenComments = () => {
    setShowCommentModal(true);
  };

  const handleSendComment = () => {
    if (!commentText.trim()) {
      Alert.alert("Hinweis", "Bitte gib einen Kommentar ein.");
      return;
    }
    // TODO: später an Backend senden
    Alert.alert("Kommentar", "Kommentar wird später gespeichert 👍");
    setCommentText("");
    setShowCommentModal(false);
  };

  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  // ───────────── Render ─────────────
  return (
    <View style={styles.container}>
      {/* Top: Back + Stats + Like + Report + Coins */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.topRightRow}>
          <View style={styles.statPill}>
            <Ionicons name="headset-outline" size={14} color="#fff" />
            <Text style={styles.statText}>{effectivePlays} Plays</Text>
          </View>

          <View style={styles.statPill}>
            <Ionicons name="logo-usd" size={14} color="#ffd54f" />
            <Text style={styles.statText}>{coins} Coins</Text>
          </View>

          <TouchableOpacity
            style={styles.likePill}
            onPress={handleLike}
            activeOpacity={hasLiked ? 0.6 : 0.9}
          >
            {isLiking ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Ionicons
                name={hasLiked ? "heart" : "heart-outline"}
                size={18}
                color="#000"
              />
            )}
            <Text style={styles.likeText}>{effectiveLikes}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.flagCircle}
            onPress={handleReport}
          >
            <Ionicons
              name="flag-outline"
              size={16}
              color="#ff4d79"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Cover */}
      <View style={styles.coverWrapper}>
        {coverUri ? (
          <Image
            source={{ uri: coverUri }}
            style={styles.coverImage}
          />
        ) : (
          <View style={styles.coverFallback}>
            <Ionicons name="musical-notes" size={40} color="#fff" />
          </View>
        )}
      </View>

      {/* Titel + Artist */}
      <View style={styles.textBlock}>
        <Text style={styles.trackTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {artist}
        </Text>
      </View>

      {/* Progress-Bar */}
      <View style={styles.progressBlock}>
        <View
          style={styles.progressBar}
          onLayout={(e) =>
            setProgressWidth(e.nativeEvent.layout.width)
          }
          onStartShouldSetResponder={() => true}
          onResponderGrant={handleSeekOnBar}
          onResponderMove={handleSeekOnBar}
        >
          <View
            style={[
              styles.progressFill,
              { flex: progress || 0 },
            ]}
          />
          <View
            style={[
              styles.progressRest,
              { flex: 1 - (progress || 0) },
            ]}
          />
          {/* kleiner Thumb */}
          <View
            style={[
              styles.progressThumb,
              {
                left: `${(progress || 0) * 100}%`,
              },
            ]}
          />
        </View>

        <View style={styles.timeRow}>
          <Text style={styles.timeText}>
            {formatTime(positionMs)}
          </Text>
          <Text style={styles.timeText}>
            {formatTime(durationMs)}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsRow}>
        {/* ◀️ vorheriger Track */}
        <TouchableOpacity
          style={styles.smallCircle}
          onPress={handlePrev}
        >
          <Ionicons name="play-skip-back" size={24} color="#fff" />
        </TouchableOpacity>

        {/* ▶️ / ⏸ Mitte */}
        <TouchableOpacity
          style={styles.playCircle}
          onPress={handleTogglePlay}
          activeOpacity={0.9}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={30}
            color="#000"
          />
        </TouchableOpacity>

        {/* ▶️ nächster Track */}
        <TouchableOpacity
          style={styles.smallCircle}
          onPress={handleNext}
        >
          <Ionicons
            name="play-skip-forward"
            size={24}
            color="#fff"
          />
        </TouchableOpacity>
      </View>

      {/* Kommentieren / Teilen */}
      <View className="bottomActions" style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.bottomItem}
          onPress={handleOpenComments}
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={20}
            color="#fff"
          />
          <Text style={styles.bottomLabel}>Kommentieren</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomItem}
          onPress={handleShare}
        >
          <Ionicons
            name="share-outline"
            size={20}
            color="#fff"
          />
          <Text style={styles.bottomLabel}>Teilen</Text>
        </TouchableOpacity>
      </View>

      {/* Kommentar-Overlay */}
      <Modal
        visible={showCommentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCommentModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Kommentar schreiben
            </Text>
            <Text style={styles.modalSubtitle} numberOfLines={1}>
              {title}
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Was möchtest du sagen?"
              placeholderTextColor="#777"
              multiline
              value={commentText}
              onChangeText={setCommentText}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setCommentText("");
                  setShowCommentModal(false);
                }}
              >
                <Text style={styles.modalCancelText}>
                  Abbrechen
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSend}
                onPress={handleSendComment}
              >
                <Text style={styles.modalSendText}>Senden</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ───────────── Styles ─────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050509",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: "#050509",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 12,
  },
  backButton: {
    position: "absolute",
    top: 52,
    left: 18,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  topRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  statText: {
    marginLeft: 4,
    color: "#fff",
    fontSize: 11,
  },
  likePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: PINK,
  },
  likeText: {
    marginLeft: 4,
    color: "#000",
    fontSize: 12,
    fontWeight: "600",
  },
  flagCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#444",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },

  coverWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  coverImage: {
    width: 260,
    height: 260,
    borderRadius: 24,
    backgroundColor: "#111",
  },
  coverFallback: {
    width: 260,
    height: 260,
    borderRadius: 24,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },

  textBlock: {
    alignItems: "center",
    marginBottom: 18,
  },
  trackTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  trackArtist: {
    color: "#bbb",
    fontSize: 14,
  },

  progressBlock: {
    marginBottom: 18,
  },
  progressBar: {
    position: "relative",
    flexDirection: "row",
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#222",
  },
  progressFill: {
    backgroundColor: PINK,
  },
  progressRest: {
    backgroundColor: "#444",
  },
  progressThumb: {
    position: "absolute",
    top: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#fff",
    transform: [{ translateX: -7 }],
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  timeText: {
    color: "#aaa",
    fontSize: 11,
  },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
    marginBottom: 18,
  },
  smallCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#444",
    alignItems: "center",
    justifyContent: "center",
  },
  playCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: PINK,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
    elevation: 10,
  },

  bottomActions: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginTop: 10,
  },
  bottomItem: {
    alignItems: "center",
    flex: 1,
  },
  bottomLabel: {
    marginTop: 4,
    color: "#ddd",
    fontSize: 11,
  },

  // Kommentar-Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCard: {
    width: "85%",
    borderRadius: 18,
    backgroundColor: "#111",
    padding: 16,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalSubtitle: {
    color: "#bbb",
    fontSize: 12,
    marginBottom: 8,
  },
  modalInput: {
    minHeight: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#fff",
    fontSize: 14,
    marginBottom: 12,
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancel: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modalCancelText: {
    color: "#aaa",
    fontSize: 13,
  },
  modalSend: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: PINK,
  },
  modalSendText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 13,
  },
});

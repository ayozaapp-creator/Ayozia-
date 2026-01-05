// components/audiominiplayer.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import audio, { useAudioSnapshot } from "../server/lib/audiocontroller";
// ⚠️ falls dein Controller unter server/lib/js/audiocontroller liegt,
// ändere den Pfad oben entsprechend: "../server/lib/js/audiocontroller";

interface AudioTrack {
  id?: string;
  url?: string;
  cover?: string;
  title?: string;
  durationMs?: number;
  stats?: {
    plays?: number;
    likes?: number;
  };
  playCount?: number;
  plays?: number;
  likeCount?: number;
  likes?: number;
}

interface AudioSnapshot {
  current: AudioTrack | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
}

const BG = "#000000";
const CARD = "#181818";
const TXT = "#ffffff";
const TXT_DIM = "#c4c4c4";
const ACCENT = "#ff4fd8";
const BORDER = "#262626";

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=1200&auto=format&fit=crop";

export default function AudioMiniPlayer() {
  const router = useRouter();
  const { snapshot, subscribe } = useAudioSnapshot();
  const [snap, setSnap] = useState<AudioSnapshot>(
    snapshot as AudioSnapshot
  );

  useEffect(() => {
    const unsubscribe = subscribe(setSnap);
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [subscribe]);

  const current: AudioTrack | null = snap.current;

  // Wenn kein Track läuft → gar nichts anzeigen
  if (!current || !current.url) {
    return null;
  }

  const isPlaying = !!snap.isPlaying;
  const cover = current.cover || FALLBACK_COVER;
  const title = current.title || "Unbenannter Track";

  // Stats wie im großen Player ableiten
  const baseStats = current.stats || {};
  const plays =
    typeof baseStats.plays === "number"
      ? baseStats.plays
      : typeof current.playCount === "number"
      ? current.playCount
      : typeof current.plays === "number"
      ? current.plays
      : 0;

  const likes =
    typeof baseStats.likes === "number"
      ? baseStats.likes
      : typeof current.likeCount === "number"
      ? current.likeCount
      : typeof current.likes === "number"
      ? current.likes
      : 0;

  const positionMs = snap.positionMs || 0;
  const durationMs = snap.durationMs || current.durationMs || 0;
  const progress =
    durationMs > 0 ? Math.min(Math.max(positionMs / durationMs, 0), 1) : 0;

  const openFullPlayer = () => {
    // 👉 öffnet deinen großen Player (app/player.tsx)
    router.push("/player");
  };

  const togglePlay = () => {
    audio.toggle(current);
  };

  const prevTrack = () => {
    // nutzt die Queue aus dem audiocontroller
    audio.prev();
  };

  const nextTrack = () => {
    audio.next();
  };

  return (
    <View style={styles.outerWrap}>
      <View style={styles.glowShadow} />

      <View style={styles.wrap}>
        {/* Klick auf linken Bereich → Fullscreen-Player */}
        <TouchableOpacity
          style={styles.left}
          activeOpacity={0.9}
          onPress={openFullPlayer}
        >
          <Image source={{ uri: cover }} style={styles.cover} />
          <View style={styles.textWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {plays} Plays · {likes} Likes
            </Text>
          </View>
        </TouchableOpacity>

        {/* ►◀️ / ▶️ / ▶️▶️ Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={prevTrack}
            activeOpacity={0.9}
            style={styles.ctrlBtn}
          >
            <Ionicons
              name="play-skip-back-outline"
              size={22}
              color={ACCENT}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={togglePlay}
            activeOpacity={0.9}
            style={styles.ctrlBtnMain}
          >
            <Ionicons
              name={isPlaying ? "pause-circle" : "play-circle"}
              size={32}
              color={ACCENT}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={nextTrack}
            activeOpacity={0.9}
            style={styles.ctrlBtn}
          >
            <Ionicons
              name="play-skip-forward-outline"
              size={22}
              color={ACCENT}
            />
          </TouchableOpacity>
        </View>

        {/* kleiner Progress-Balken unten */}
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { flex: progress || 0 }]}
          />
          <View
            style={[styles.progressRest, { flex: 1 - (progress || 0) }]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingBottom: 8,
    paddingTop: 2,
    backgroundColor: "transparent",
  },
  glowShadow: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 8,
    height: 48,
    borderRadius: 999,
    backgroundColor: ACCENT,
    opacity: 0.35,
  },
  wrap: {
    height: 60,
    paddingHorizontal: 10,
    backgroundColor: BG,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  cover: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: CARD,
  },
  textWrap: {
    marginLeft: 10,
    flex: 1,
  },
  title: {
    color: TXT,
    fontSize: 13,
    fontWeight: "700",
  },
  subtitle: {
    color: TXT_DIM,
    fontSize: 11,
    marginTop: 2,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  ctrlBtn: {
    paddingHorizontal: 4,
  },
  ctrlBtnMain: {
    paddingHorizontal: 2,
  },
  progressBar: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 4,
    height: 3,
    borderRadius: 999,
    flexDirection: "row",
    overflow: "hidden",
    backgroundColor: "#222",
  },
  progressFill: {
    backgroundColor: ACCENT,
  },
  progressRest: {
    backgroundColor: "#444",
  },
});

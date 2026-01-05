// app/nowplaying.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import audio, { useAudioSnapshot } from "../server/lib/audiocontroller";

const { width: W } = Dimensions.get("window");

const BG = "#000000";
const CARD = "#111111";
const TXT = "#ffffff";
const TXT_DIM = "#c4c4c4";
const ACCENT = "#ff4fd8";

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=1200&auto=format&fit=crop";

export default function NowPlayingScreen() {
  const router = useRouter();
  const { snapshot, subscribe } = useAudioSnapshot();
  const [snap, setSnap] = useState(snapshot);

  useEffect(() => {
    const unsubscribe = subscribe(setSnap);
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [subscribe]);

  const t: any = snap.current;
  const isPlaying = !!snap.isPlaying;
  const pos = snap.positionMs || 0;
  const dur = snap.durationMs || 0;
  const ratio = dur > 0 ? pos / dur : 0;

  const cover = t?.cover || FALLBACK_COVER;
  const title = t?.title || "Kein Track aktiv";

  const goBack = () => {
    router.back();
  };

  const togglePlay = () => {
    if (!t) return;
    audio.toggle(t);
  };

  // Nur UI – Likesystem/Report etc. steckt im PlayerScreen (player.tsx)
  const onLikePress = () => {
    console.log(
      "Like-Button in NowPlaying gedrückt (PlayerScreen hat die echte Logik)."
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBack}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10,
          }}
        >
          <Ionicons
            name="chevron-down"
            size={26}
            color={TXT}
          />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTop}>
            Wird wiedergegeben
          </Text>
          {t && (
            <Text
              style={styles.headerBottom}
              numberOfLines={1}
            >
              Aus deinem Feed
            </Text>
          )}
        </View>

        <TouchableOpacity onPress={onLikePress}>
          <Ionicons
            name="star-outline"
            size={24}
            color={ACCENT}
          />
        </TouchableOpacity>
      </View>

      {/* Cover */}
      <View style={styles.coverWrap}>
        <Image source={{ uri: cover }} style={styles.cover} />
      </View>

      {/* Titel + Artist */}
      <View style={styles.metaWrap}>
        <View style={{ flex: 1 }}>
          <Text
            style={styles.title}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={styles.artist}
            numberOfLines={1}
          >
            {t?.user?.username
              ? `@${t.user.username}`
              : "Unbekannter Artist"}
          </Text>
        </View>
      </View>

      {/* Progress-Bar (nur Anzeige) */}
      <View style={styles.progressWrap}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { flex: ratio },
            ]}
          />
          <View style={{ flex: 1 - ratio }} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>
            {formatMs(pos)}
          </Text>
          <Text style={styles.timeText}>
            {formatMs(dur)}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity activeOpacity={0.8}>
          <Ionicons
            name="play-skip-back-outline"
            size={30}
            color={TXT_DIM}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={togglePlay}
          activeOpacity={0.9}
          style={styles.playBig}
        >
          <Ionicons
            name={
              isPlaying ? "pause-circle" : "play-circle"
            }
            size={72}
            color={ACCENT}
          />
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.8}>
          <Ionicons
            name="play-skip-forward-outline"
            size={30}
            color={TXT_DIM}
          />
        </TouchableOpacity>
      </View>

      {/* Untere Icons (Deko) */}
      <View style={styles.bottomRow}>
        <Ionicons
          name="shuffle-outline"
          size={22}
          color={TXT_DIM}
        />
        <Ionicons
          name="repeat-outline"
          size={22}
          color={TXT_DIM}
        />
      </View>
    </SafeAreaView>
  );
}

function formatMs(ms: number) {
  const totalSec = Math.floor((ms || 0) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTop: {
    color: TXT_DIM,
    fontSize: 12,
  },
  headerBottom: {
    color: TXT,
    fontSize: 13,
    fontWeight: "600",
  },
  coverWrap: {
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cover: {
    width: W - 48,
    height: W - 48,
    borderRadius: 16,
    backgroundColor: CARD,
  },
  metaWrap: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
  },
  title: {
    color: TXT,
    fontSize: 20,
    fontWeight: "800",
  },
  artist: {
    color: TXT_DIM,
    fontSize: 14,
    marginTop: 4,
  },
  progressWrap: {
    marginTop: 20,
    paddingHorizontal: 22,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 999,
    backgroundColor: CARD,
    flexDirection: "row",
    overflow: "hidden",
  },
  progressBarFill: {
    backgroundColor: ACCENT,
  },
  timeRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    color: TXT_DIM,
    fontSize: 11,
  },
  controls: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 40,
  },
  playBig: {
    alignItems: "center",
    justifyContent: "center",
  },
  bottomRow: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 60,
  },
});

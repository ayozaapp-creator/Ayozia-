// components/snippetcard.tsx
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Dimensions, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import audio, { useAudioSnapshot } from "../server/lib/audiocontroller";

const { width: W, height: H } = Dimensions.get("window");
const TXT = "#fff";
const TXT_DIM = "#bdbdbd";
const ACCENT = "#ff4fd8";

export type SnippetCardProps = {
  item: {
    id: string;
    title: string;
    url: string;
    cover?: string | null;
    snippetStartMs?: number | null;
    snippetDurationMs?: number | null;
    user?: { username?: string } | null;
  };
  isActive: boolean;
  onEnded?: () => void;
};

export default function SnippetCard({ item, isActive, onEnded }: SnippetCardProps) {
  const { snapshot, subscribe } = useAudioSnapshot();
  const [snap, setSnap] = React.useState(snapshot);

  React.useEffect(() => {
    subscribe(setSnap);
  }, [subscribe]);

  const isThis = (snap.current as any)?.id === item.id;
  const isPlaying = isThis && snap.isPlaying;

  // Auto-Play wenn aktiv und noch nicht dieses Snippet
  React.useEffect(() => {
    if (!isActive) return;
    if (isThis && isPlaying) return;

    const track = {
      id: item.id,
      title: item.title,
      url: item.url,
      cover: item.cover || undefined,
      snippetStartMs: item.snippetStartMs ?? 0,
      snippetDurationMs: item.snippetDurationMs ?? 30000,
    };

    // toggle startet bei uns das Playback (wie beim TrackPlayButton)
    audio.toggle(track);

    // Stopp beim Unmount/Deaktivieren
    return () => {
      if (isThis) audio.stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, item.id, item.url]);

  return (
    <View style={styles.wrap}>
      <ImageBackground
        source={{ uri: item.cover || "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=1200&auto=format&fit=crop" }}
        style={styles.bg}
        resizeMode="cover"
      >
        <View style={styles.overlay} />

        <View style={styles.header}>
          <Text numberOfLines={1} style={styles.title}>{item.title}</Text>
          {!!item.user?.username && (
            <Text numberOfLines={1} style={styles.user}>@{item.user.username}</Text>
          )}
        </View>

        <View style={styles.center}>
          <TouchableOpacity
            onPress={() =>
              audio.toggle({
                id: item.id,
                title: item.title,
                url: item.url,
                cover: item.cover || undefined,
                snippetStartMs: item.snippetStartMs ?? 0,
                snippetDurationMs: item.snippetDurationMs ?? 30000,
              })
            }
            activeOpacity={0.9}
            style={styles.playBtn}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={28}
              color="#0b0b0b"
            />
          </TouchableOpacity>

          <Text style={styles.hint}>Swipe nach rechts/links nach kurzer Zeit</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.meta}>
            {Math.round((item.snippetDurationMs ?? 30000) / 1000)}s · Snippet
          </Text>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: W, height: "100%" },
  bg: { width: "100%", height: "100%", justifyContent: "space-between" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  header: { paddingTop: 16, paddingHorizontal: 16 },
  title: { color: TXT, fontSize: 22, fontWeight: "900" },
  user: { color: TXT_DIM, marginTop: 2 },
  center: { alignItems: "center", justifyContent: "center", flex: 1, gap: 10 },
  playBtn: {
    width: 66, height: 66, borderRadius: 33,
    alignItems: "center", justifyContent: "center",
    backgroundColor: ACCENT,
    shadowColor: ACCENT, shadowOpacity: 0.6, shadowRadius: 18, elevation: 10,
  },
  hint: { color: TXT_DIM, fontSize: 12, marginTop: 6 },
  footer: { paddingHorizontal: 16, paddingBottom: 24 },
  meta: { color: TXT_DIM, fontWeight: "600" },
});

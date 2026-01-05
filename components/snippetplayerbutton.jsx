// components/snippetplayerbutton.jsx
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const DEFAULT_SNIPPET_MS = 30_000; // 30 Sekunden

export default function SnippetPlayerButton({ snippet, size = 42 }) {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const startMs = snippet?.startMs ?? 0;
  const durationMs = snippet?.durationMs ?? DEFAULT_SNIPPET_MS;
  const endMs = startMs + durationMs;

  // Cleanup bei Unmount oder wenn Snippet wechselt
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound, snippet?.id]);

  const ensureLoaded = async () => {
    if (sound) return sound;

    setIsLoading(true);
    try {
      const { sound: s } = await Audio.Sound.createAsync(
        { uri: snippet.url },
        { shouldPlay: false }
      );

      // Auto-Stop, wenn wir hinter dem Snippet-Ende sind
      s.setOnPlaybackStatusUpdate((status) => {
        if (!status || !status.isLoaded) return;
        if (status.positionMillis >= endMs) {
          s
            .stopAsync()
            .then(() => {
              s.setPositionAsync(startMs);
              setIsPlaying(false);
            })
            .catch(() => {});
        }
      });

      await s.setPositionAsync(startMs);
      setSound(s);
      return s;
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlay = async () => {
    try {
      const s = await ensureLoaded();
      if (!s) return;
      const status = await s.getStatusAsync();
      if (!status.isLoaded) return;

      if (status.isPlaying) {
        await s.pauseAsync();
        setIsPlaying(false);
      } else {
        // immer vom Snippet-Start spielen
        await s.setPositionAsync(startMs);
        await s.playAsync();
        setIsPlaying(true);
      }
    } catch (e) {
      console.warn("Snippet play error", e);
      setIsPlaying(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        onPress={togglePlay}
        activeOpacity={0.85}
        style={[
          styles.btn,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#000" />
        ) : (
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={Math.round(size * 0.55)}
            color="#000"
          />
        )}
      </TouchableOpacity>

      {!!snippet?.title && (
        <Text style={styles.title} numberOfLines={1}>
          {snippet.title}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  btn: {
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
    flex: 1,
  },
});

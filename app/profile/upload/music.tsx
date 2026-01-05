// app/profile/upload/music.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Alert,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const API = "http://192.168.0.224:5000";

const http = axios.create({ baseURL: API, timeout: 20000 });

type UploadResponse = {
  ok: boolean;
  item?: {
    id: string;
    userId?: string | null;
    title?: string;
    url?: string;
    absUrl?: string;
    cover?: string | null;
    absCover?: string | null;
    createdAt?: string;
  };
  url?: string;
  cover?: string;
};

// 30-Sekunden-Snippet
const SNIPPET_MS = 30_000;

/* ───────────── userId Loader (gleiches Prinzip wie Profil) ───────────── */
async function loadUserIdFromStorage(): Promise<string | null> {
  const candidates = ["user", "@user", "ayo_user", "auth_user"];
  for (const key of candidates) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) continue;
    try {
      const obj = JSON.parse(raw);
      const u = obj?.user?.id ? obj.user : obj;
      if (u?.id) return String(u.id);
    } catch {
      // ignore parse error
    }
  }
  return null;
}

export default function UploadMusicScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState<string>("");
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string>("");

  const [loading, setLoading] = useState(false);

  // Audio
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Snippet-Fenster
  const [snippetStartMs, setSnippetStartMs] = useState(0);
  const snippetDurationMs = SNIPPET_MS;
  const snippetEndMs = useMemo(
    () => snippetStartMs + snippetDurationMs,
    [snippetStartMs]
  );

  // Breite der Wave
  const [waveWidth, setWaveWidth] = useState(1);

  // Cleanup Sound
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

  /* ───────────── Helpers ───────────── */

  const formatTime = (ms?: number | null) => {
    if (!ms || ms <= 0) return "0:00";
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const pickCover = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      setCoverUri(res.assets[0].uri);
    }
  }, []);

  const loadSoundFromUri = useCallback(
    async (uri: string) => {
      try {
        if (sound) {
          await sound.unloadAsync();
          setSound(null);
        }

        const { sound: s } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false }
        );
        setSound(s);

        const st = await s.getStatusAsync();
        if (st.isLoaded && st.durationMillis != null) {
          setDurationMs(st.durationMillis);
          setSnippetStartMs(0);
        } else {
          setDurationMs(null);
        }
      } catch (e) {
        console.warn("Audio load error", e);
        Alert.alert("Fehler", "Audio konnte nicht geladen werden.");
      }
    },
    [sound]
  );

  const pickAudio = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        "audio/*",
        "audio/mpeg",
        "audio/mp3",
        "audio/x-m4a",
        "audio/aac",
        "audio/wav",
        "audio/ogg",
        "audio/flac",
      ],
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (res.assets && res.assets.length > 0) {
      const asset = res.assets[0];
      setAudioUri(asset.uri);
      const name = asset.name || asset.uri.split("/").pop() || "track.mp3";
      setAudioName(name);

      if (!title.trim()) {
        const base = name.replace(/\.[^/.]+$/, "");
        setTitle(base);
      }

      await loadSoundFromUri(asset.uri);
    }
  }, [title, loadSoundFromUri]);

  const togglePlay = useCallback(async () => {
    if (!sound) return;
    const status = await sound.getStatusAsync();
    if (!status.isLoaded) return;

    if (status.isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
    } else {
      await sound.setPositionAsync(snippetStartMs);
      await sound.playAsync();
      setIsPlaying(true);
    }
  }, [sound, snippetStartMs]);

  const seekToSnippetStart = useCallback(async () => {
    if (!sound) return;
    const status = await sound.getStatusAsync();
    if (!status.isLoaded) return;
    await sound.setPositionAsync(snippetStartMs);
  }, [sound, snippetStartMs]);

  /* ───────────── Wave-/Snippet-Drag ───────────── */

  const handleWaveDrag = useCallback(
    (x: number) => {
      if (!durationMs || waveWidth <= 0) return;

      const maxOffset = Math.max(durationMs - snippetDurationMs, 0);
      if (maxOffset <= 0) {
        setSnippetStartMs(0);
        return;
      }

      const ratioRaw = x / waveWidth;
      const ratio = Math.min(Math.max(ratioRaw, 0), 1);

      const newStart = Math.round(ratio * maxOffset);
      setSnippetStartMs(newStart);
    },
    [durationMs, waveWidth, snippetDurationMs]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          handleWaveDrag(evt.nativeEvent.locationX);
        },
        onPanResponderMove: (evt) => {
          handleWaveDrag(evt.nativeEvent.locationX);
        },
        onPanResponderRelease: () => {
          seekToSnippetStart();
        },
      }),
    [handleWaveDrag, seekToSnippetStart]
  );

  /* ───────────── Upload ───────────── */

  const onSubmit = useCallback(async () => {
    try {
      if (!audioUri) {
        return Alert.alert("Fehlt", "Bitte eine Audiodatei auswählen.");
      }
      setLoading(true);

      // 🔐 userId stabil holen
      const userId = await loadUserIdFromStorage();
      if (!userId) {
        Alert.alert(
          "Fehler",
          "Kein Nutzer gefunden. Bitte neu einloggen, bevor du hochlädst."
        );
        setLoading(false);
        return;
      }

      const fd = new FormData();

      fd.append("file", {
        uri: audioUri,
        name: audioName || "track.mp3",
        type: guessAudioMime(audioUri) || "audio/mpeg",
      } as any);

      if (coverUri) {
        const name = `cover_${Date.now()}.jpg`;
        fd.append("cover", {
          uri: coverUri,
          name,
          type: "image/jpeg",
        } as any);
      }

      fd.append("title", title || "Ohne Titel");
      fd.append("userId", String(userId));

      // optional: Snippet-Infos im Upload mitschicken (Server darf sie ignorieren)
      fd.append("snippetStartMs", String(snippetStartMs));
      fd.append("snippetDurationMs", String(snippetDurationMs));

      const res = await http.post<UploadResponse>("/music/upload", fd);

      if (!res.data?.ok || !res.data.item) {
        throw new Error("Upload fehlgeschlagen");
      }

      const track = res.data.item;
      const trackUrl = track.absUrl || track.url || res.data.url;
      const trackCover = track.absCover || track.cover || res.data.cover || null;

      // 🔊 Direkt Snippet anlegen, damit es im Profil erscheint
      if (track.id && trackUrl) {
        try {
          const snippetBody = {
            userId,
            musicId: track.id,
            url: trackUrl,
            title: track.title || title || "Snippet",
            thumbnail: trackCover,
            startMs: snippetStartMs,
            durationMs: snippetDurationMs,
          };
          console.log("Snippet-Create body:", snippetBody);

          const snipRes = await http.post("/snippets/from-music", snippetBody);
          console.log("Snippet-Create result:", snipRes.data);
        } catch (err: any) {
          console.warn(
            "Snippet-Create fehlgeschlagen:",
            err?.response?.data || err?.message
          );
          // Track bleibt trotzdem hochgeladen
        }
      } else {
        console.warn("Kein track.id oder trackUrl → kein Snippet angelegt");
      }

      Alert.alert("Erfolgreich", "Dein Track wurde hochgeladen.", [
        {
          text: "OK",
          onPress: () => {
            try {
              router.back();
            } catch {}
          },
        },
      ]);
    } catch (e: any) {
      console.error(e);
      Alert.alert(
        "Fehler",
        e?.response?.data?.message || e?.message || "Upload fehlgeschlagen."
      );
    } finally {
      setLoading(false);
    }
  }, [
    audioUri,
    audioName,
    coverUri,
    title,
    snippetStartMs,
    snippetDurationMs,
    router,
  ]);

  /* ───────────── UI ───────────── */

  const snippetLabel = `${formatTime(snippetStartMs)} – ${formatTime(
    snippetEndMs
  )}`;
  const fullLabel = durationMs ? formatTime(durationMs) : "0:00";

  const snippetWidthRatio =
    durationMs && durationMs > 0
      ? Math.min(snippetDurationMs / durationMs, 1)
      : 1;
  const snippetOffsetRatio =
    durationMs && durationMs > snippetDurationMs
      ? snippetStartMs / (durationMs - snippetDurationMs)
      : 0;

  return (
    <SafeAreaView style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header mit X */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          style={styles.headerBtn}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Musik hochladen</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.content}>
        {/* Cover */}
        <TouchableOpacity
          onPress={pickCover}
          activeOpacity={0.9}
          style={styles.coverBox}
        >
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.coverImg} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="image-outline" size={28} color="#bbb" />
              <Text style={{ color: "#bbb", marginTop: 6 }}>Cover wählen</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Titel */}
        <Text style={styles.label}>Titel</Text>
        <TextInput
          style={styles.input}
          placeholder="Track-Titel"
          placeholderTextColor="#888"
          value={title}
          onChangeText={setTitle}
        />

        {/* Audio-Datei */}
        <Text style={styles.label}>Audio-Datei</Text>
        <TouchableOpacity
          onPress={pickAudio}
          activeOpacity={0.9}
          style={styles.fileBtn}
        >
          <Ionicons name="musical-note-outline" size={18} color="#fff" />
          <Text style={styles.fileBtnText}>
            {audioName || "Datei auswählen"}
          </Text>
        </TouchableOpacity>

        {/* Snippet-Selector */}
        <View style={styles.snipBlock}>
          <View className="snipHeader" style={styles.snipHeader}>
            <Text style={styles.snipTitle}>Snippet wählen</Text>
            <Text style={styles.snipTime}>
              {snippetLabel} / {fullLabel}
            </Text>
          </View>

          <View style={styles.snipMetaRow}>
            <View style={styles.snipBadge}>
              <Text style={styles.snipBadgeText}>
                {snippetDurationMs / 1000}s
              </Text>
            </View>

            <TouchableOpacity
              onPress={togglePlay}
              disabled={!sound || !durationMs}
              style={[
                styles.previewBtn,
                (!sound || !durationMs) && { opacity: 0.4 },
              ]}
              activeOpacity={0.85}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={16}
                color="#000"
              />
              <Text style={styles.previewBtnText}>Snippet anhören</Text>
            </TouchableOpacity>
          </View>

          <View
            style={styles.waveOuter}
            onLayout={(e) => setWaveWidth(e.nativeEvent.layout.width)}
            {...panResponder.panHandlers}
          >
            <View style={styles.waveBg}>
              {Array.from({ length: 40 }).map((_, idx) => (
                <View key={idx} style={styles.waveTick} />
              ))}
            </View>

            <View
              style={[
                styles.snipWindow,
                {
                  left: waveWidth * snippetOffsetRatio,
                  width: waveWidth * snippetWidthRatio,
                },
              ]}
            />
          </View>

          <Text style={styles.waveHint}>
            Tippe oder ziehe in der Leiste, um den 30-Sekunden-Ausschnitt zu
            verschieben.
          </Text>
        </View>

        <Text style={styles.hint}>
          Tipp: Der endgültige Dateiname orientiert sich am Titel. Du kannst ihn
          über das Titelfeld frei vergeben.
        </Text>

        <TouchableOpacity
          disabled={loading}
          onPress={onSubmit}
          activeOpacity={0.9}
          style={[styles.submit, loading && { opacity: 0.6 }]}
        >
          <Text style={styles.submitText}>
            {loading ? "Lade hoch…" : "Hochladen"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function guessAudioMime(uri?: string | null) {
  if (!uri) return null;
  const ext = uri.split("?")[0].split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/x-m4a";
    case "aac":
      return "audio/aac";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "flac":
      return "audio/flac";
    default:
      return "audio/*";
  }
}

const ACCENT = "#ff4fd8";
const BG = "#000";
const BORDER = "#1e1e1e";
const TEXT = "#fff";

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: TEXT,
    fontSize: 17,
    fontWeight: "800",
  },

  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },

  coverBox: {
    width: 190,
    height: 190,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER,
    alignSelf: "center",
    backgroundColor: "#101010",
    marginBottom: 16,
  },
  coverImg: { width: "100%", height: "100%" },
  coverPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },

  label: {
    color: "#c9c9c9",
    marginTop: 8,
    marginBottom: 6,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#151528",
    color: TEXT,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#222344",
  },

  fileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#151528",
    borderWidth: 1,
    borderColor: "#222344",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  fileBtnText: { color: TEXT, fontWeight: "800", flex: 1 },

  snipBlock: {
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#101018",
    borderWidth: 1,
    borderColor: "#222344",
  },
  snipHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  snipTitle: { color: TEXT, fontWeight: "800", fontSize: 14 },
  snipTime: { color: "#b7b7d5", fontSize: 12 },

  snipMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  snipBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,79,216,0.14)",
  },
  snipBadgeText: { color: ACCENT, fontWeight: "800", fontSize: 12 },

  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  previewBtnText: { color: "#000", fontWeight: "700", fontSize: 12 },

  waveOuter: {
    position: "relative",
    height: 46,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#050509",
    borderWidth: 1,
    borderColor: "#222344",
  },
  waveBg: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
  },
  waveTick: {
    width: 3,
    borderRadius: 2,
    height: 10 + Math.random() * 14,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  snipWindow: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 10,
    backgroundColor: "rgba(255,79,216,0.25)",
    borderWidth: 1,
    borderColor: ACCENT,
  },
  waveHint: {
    marginTop: 6,
    color: "#9aa2c9",
    fontSize: 11,
  },

  hint: { color: "#9aa2c9", marginTop: 10, fontSize: 12 },

  submit: {
    marginTop: 18,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 18,
  },
  submitText: { color: "#fff", fontWeight: "900" },
});

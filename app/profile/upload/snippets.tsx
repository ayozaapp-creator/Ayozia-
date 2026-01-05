// app/profile/upload/snippet.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const API = "http://192.168.0.224:5000";

const http = axios.create({ baseURL: API, timeout: 20000 });

type UploadResponse = { ok: boolean; message?: string; id?: string; url?: string };

export default function UploadSnippetScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string>("");
  const [startSec, setStartSec] = useState<string>("0");   // Start in Sekunden
  const [durSec, setDurSec] = useState<string>("20");      // Dauer in Sekunden (max 30)
  const [loading, setLoading] = useState(false);

  const safeTop = Math.max(insets.top, 10);
  const MAX_SNIPPET = 30;

  const hintText = useMemo(
    () => `Dein Snippet ist ein 20–30s Ausschnitt deines Tracks. 
Gib Start (Sekunden) und Dauer an. Dauer maximal ${MAX_SNIPPET}s.`,
    []
  );

  const pickCover = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Berechtigung", "Bitte erlaube den Zugriff auf Fotos.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!res.canceled && res.assets?.[0]?.uri) setCoverUri(res.assets[0].uri);
  }, []);

  const pickAudio = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["audio/mpeg", "audio/mp3", "audio/x-m4a", "audio/aac", "audio/wav", "audio/ogg", "audio/flac"],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (res.assets && res.assets.length > 0) {
      const asset = res.assets[0];
      setAudioUri(asset.uri);
      const name = asset.name || asset.uri.split("/").pop() || "snippet.mp3";
      setAudioName(name);
      if (!title.trim()) {
        const base = name.replace(/\.[^/.]+$/, "");
        setTitle(base);
      }
    }
  }, [title]);

  const onClose = useCallback(() => {
    try { router.back(); } catch {}
  }, [router]);

  const onSubmit = useCallback(async () => {
    try {
      if (!audioUri) return Alert.alert("Fehlt", "Bitte eine Audio-Datei auswählen.");
      const start = Math.max(0, parseInt(startSec || "0", 10) || 0);
      let dur = Math.max(1, parseInt(durSec || "20", 10) || 20);
      if (dur > MAX_SNIPPET) dur = MAX_SNIPPET;

      setLoading(true);

      // userId aus AsyncStorage (robust)
      let userId: string | null = null;
      try {
        const raw = await AsyncStorage.getItem("user");
        if (raw) {
          const obj = JSON.parse(raw);
          userId = obj?.id || obj?.user?.id || null;
        }
      } catch {}

      const fd = new FormData();
      fd.append("file", {
        uri: audioUri,
        name: audioName || "snippet.mp3",
        type: guessAudioMime(audioUri) || "audio/mpeg",
      } as any);

      if (coverUri) {
        fd.append("cover", {
          uri: coverUri,
          name: `cover_${Date.now()}.jpg`,
          type: "image/jpeg",
        } as any);
      }

      fd.append("title", title || "Snippet");
      if (userId) fd.append("userId", userId);

      // ► WICHTIG: Snippet-Flags für den Server
      fd.append("snippetDurMs", String(dur * 1000));

      const res = await http.post<UploadResponse>("/music/upload", fd); // server/routes/music.js verarbeitet das
      if (!res.data?.ok) throw new Error("Upload fehlgeschlagen");

      Alert.alert("Erfolgreich", "Snippet wurde hochgeladen.", [
        { text: "OK", onPress: onClose },
      ]);
    } catch (e: any) {
      Alert.alert("Fehler", e?.response?.data?.message || e?.message || "Upload fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [audioUri, audioName, coverUri, title, startSec, durSec, onClose]);

  return (
    <KeyboardAvoidingView
      style={[styles.screen]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header mit Safe-Area + X */}
      <View style={[styles.header, { paddingTop: safeTop }]}>
        <Text style={styles.headerTitle}>Snippet hochladen</Text>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Cover */}
      <TouchableOpacity onPress={pickCover} activeOpacity={0.9} style={styles.coverBox}>
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
        placeholder="Snippet-Titel"
        placeholderTextColor="#888"
        value={title}
        onChangeText={setTitle}
      />

      {/* Audio */}
      <Text style={styles.label}>Audio-Datei</Text>
      <TouchableOpacity onPress={pickAudio} activeOpacity={0.9} style={styles.fileBtn}>
        <Ionicons name="musical-note-outline" size={18} color="#fff" />
        <Text style={styles.fileBtnText}>{audioName || "Datei auswählen"}</Text>
      </TouchableOpacity>

      {/* Snippet-Parameter */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Start (Sek.)</Text>
          <TextInput
            style={styles.input}
            placeholder="z.B. 15"
            placeholderTextColor="#888"
            value={startSec}
            keyboardType="numeric"
            onChangeText={(t) => setStartSec(t.replace(/[^\d]/g, ""))}
          />
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Dauer (Sek., max {MAX_SNIPPET})</Text>
          <TextInput
            style={styles.input}
            placeholder={`max. ${MAX_SNIPPET}`}
            placeholderTextColor="#888"
            value={durSec}
            keyboardType="numeric"
            onChangeText={(t) => setDurSec(t.replace(/[^\d]/g, ""))}
          />
        </View>
      </View>

      <Text style={styles.hint}>{hintText}</Text>

      <TouchableOpacity
        disabled={loading}
        onPress={onSubmit}
        activeOpacity={0.9}
        style={[styles.submit, loading && { opacity: 0.6 }]}
      >
        <Text style={styles.submitText}>{loading ? "Lade hoch…" : "Snippet erstellen"}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

/* ───────── helpers ───────── */
function guessAudioMime(uri?: string | null) {
  if (!uri) return null;
  const ext = uri.split("?")[0].split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp3": return "audio/mpeg";
    case "m4a": return "audio/x-m4a";
    case "aac": return "audio/aac";
    case "wav": return "audio/wav";
    case "ogg": return "audio/ogg";
    case "flac": return "audio/flac";
    default: return null;
  }
}

/* ───────── styles ───────── */
const ACCENT = "#ff4fd8";
const BG = "#000";
const BORDER = "#1e1e1e";
const TEXT = "#fff";

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, paddingHorizontal: 16 },
  header: {
    position: "relative",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 12,
  },
  headerTitle: { color: TEXT, fontSize: 18, fontWeight: "900", textAlign: "center" },
  closeBtn: { position: "absolute", right: 6, top: "50%", marginTop: -11 },

  coverBox: {
    width: 180,
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER,
    alignSelf: "center",
    backgroundColor: "#101010",
    marginVertical: 12,
  },
  coverImg: { width: "100%", height: "100%" },
  coverPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },

  label: { color: "#c9c9c9", marginTop: 8, marginBottom: 6, fontWeight: "700" },
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

  row: { flexDirection: "row", alignItems: "flex-start", marginTop: 8 },

  hint: { color: "#9aa2c9", marginTop: 8 },

  submit: {
    marginTop: 16,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  submitText: { color: "#fff", fontWeight: "900" },
});

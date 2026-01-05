// app/stories/upload.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ResizeMode, Video } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const BG = "#000";
const CARD = "#080808";
const TEXT = "#ffffff";
const TEXT_DIM = "#b5b5b5";
const ACCENT = "#ff4fd8";
const BORDER = "#1e1e1e";

const API = process.env.EXPO_PUBLIC_API_URL || "http://192.168.0.224:5000";

type Params = {
  uri?: string | string[];
  type?: string | string[];
};

export default function StoryUploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const videoRef = useRef<Video | null>(null);

  const params = useLocalSearchParams<Params>();

  const uri = useMemo(() => {
    if (!params.uri) return "";
    return Array.isArray(params.uri) ? params.uri[0] : params.uri;
  }, [params.uri]);

  const mediaType = useMemo(() => {
    if (!params.type) return "image";
    const t = Array.isArray(params.type) ? params.type[0] : params.type;
    return t === "video" ? "video" : "image";
  }, [params.type]);

  const isVideo = mediaType === "video";

  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  if (!uri) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color={TEXT} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Neue Story</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.center}>
          <Text style={{ color: TEXT_DIM }}>
            Kein Medium ausgewählt. Bitte gehe zurück.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleSend = async () => {
    if (uploading) return;
    try {
      setUploading(true);

      // User-ID aus AsyncStorage holen
      const stored = await AsyncStorage.getItem("user");
      let userId: string | null = null;
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          userId = parsed?.id || parsed?.user?.id || null;
        } catch {}
      }

      if (!userId) {
        Alert.alert(
          "Nicht eingeloggt",
          "Bitte melde dich neu an, bevor du eine Story postest."
        );
        return;
      }

      const filenameFromUri =
        uri.split("/").pop() || (isVideo ? "story.mp4" : "story.jpg");
      const ext = filenameFromUri.split(".").pop() || (isVideo ? "mp4" : "jpg");
      const fileName = `story-${Date.now()}.${ext}`;
      const mime = isVideo ? "video/mp4" : "image/jpeg";

      const form = new FormData();
      form.append("userId", String(userId));
      form.append("caption", caption);
      form.append("kind", isVideo ? "video" : "image");

      form.append(
        "file",
        {
          uri,
          name: fileName,
          type: mime,
        } as any
      );

      const res = await fetch(`${API}/stories`, {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data",
        },
        body: form,
      });

      if (!res.ok) {
        const txt = await res.text();
        console.log("story upload status", res.status, txt);
        throw new Error("Upload fehlgeschlagen");
      }

      Alert.alert("Story gepostet", "Deine Story ist jetzt 24h sichtbar.");
      router.replace("/profile");
    } catch (e: any) {
      console.log("story upload error", e);
      Alert.alert(
        "Fehler",
        e?.message || "Deine Story konnte nicht hochgeladen werden."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header immer unter dem Notch */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={26} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Neue Story</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
      >
        {/* Preview-Bereich */}
        <View style={styles.previewWrap}>
          {isVideo ? (
            <Video
              ref={videoRef}
              source={{ uri }}
              style={styles.previewMedia}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
            />
          ) : (
            <Image
              source={{ uri }}
              style={styles.previewMedia}
              resizeMode="cover"
            />
          )}
        </View>

        {/* Caption + Info + Senden – alles im sichtbaren Bereich,
            kein absolute bottom, damit nichts hinter der NaBa verschwindet */}
        <View
          style={[
            styles.bottomArea,
            { paddingBottom: insets.bottom + 12 }, // extra Platz für iOS + NaBa
          ]}
        >
          <Text style={styles.captionLabel}>Bildunterschrift hinzufügen …</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Schreib etwas zu deiner Story…"
            placeholderTextColor="#777"
            style={styles.captionInput}
            multiline
          />

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={ACCENT} />
            <Text style={styles.infoText}>
              Stories sind 24 Stunden sichtbar – danach verschwinden sie
              automatisch.
            </Text>
          </View>

          <View style={styles.sendRow}>
            <TouchableOpacity
              style={styles.sendLeft}
              activeOpacity={0.9}
              onPress={handleSend}
            >
              <Ionicons name="people-circle-outline" size={20} color={TEXT} />
              <Text style={styles.sendLeftText}>Deine Stories</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sendRight}
              activeOpacity={0.9}
              onPress={handleSend}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="arrow-forward" size={22} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  headerTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  previewWrap: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  previewMedia: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
  },

  bottomArea: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: BG,
  },
  captionLabel: {
    color: TEXT_DIM,
    fontSize: 13,
    marginBottom: 4,
  },
  captionInput: {
    minHeight: 44,
    maxHeight: 90,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: TEXT,
    backgroundColor: CARD,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
    color: TEXT_DIM,
    fontSize: 12,
  },

  sendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sendLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: BORDER,
  },
  sendLeftText: {
    color: TEXT,
    fontWeight: "700",
    fontSize: 14,
  },
  sendRight: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT,
    shadowColor: ACCENT,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
});

// app/upload/image.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const API = "http://192.168.0.224:5000";
const http = axios.create({ baseURL: API, timeout: 15000 });

type PublicUser = { id: string; email: string; username: string; avatarUrl: string | null };
type UploadResponse = {
  message?: string;
  image?: { id: string; userId: string; url: string; createdAt: string; width?: number | null; height?: number | null };
};

export default function UploadImageScreen() {
  const router = useRouter();
  const [me, setMe] = useState<PublicUser | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem("user");
      if (!raw) {
        Alert.alert("Nicht eingeloggt", "Bitte melde dich an.");
        router.replace("/login");
        return;
      }
      setMe(JSON.parse(raw) as PublicUser);
    })();
  }, [router]);

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Berechtigung", "Bitte Zugriff auf Fotos erlauben.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.length) return;
    setImageUri(result.assets[0].uri);
  }, []);

  const uploadImage = useCallback(async () => {
    if (!me?.id) {
      Alert.alert("Fehler", "Benutzer nicht gefunden. Bitte neu einloggen.");
      return;
    }
    if (!imageUri) {
      Alert.alert("Fehler", "Bitte zuerst ein Bild auswählen.");
      return;
    }

    try {
      setLoading(true);
      const ext = imageUri.toLowerCase().endsWith(".png") ? "png" : "jpg";
      const form = new FormData();
      form.append("file", {
        uri: imageUri,
        name: `upload.${ext}`,
        type: ext === "png" ? "image/png" : "image/jpeg",
      } as any);

      const res = await http.post<UploadResponse>(`/users/${me.id}/images`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.status === 201) {
        Alert.alert("✅ Erfolgreich", res.data?.message || "Bild wurde hochgeladen.");
        router.replace("/profile"); // zurück zum eigenen Profil (Grid lädt neu)
      } else {
        Alert.alert("Fehler", res.data?.message || "Upload fehlgeschlagen.");
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Serverfehler beim Hochladen.";
      Alert.alert("Fehler", msg);
    } finally {
      setLoading(false);
    }
  }, [me?.id, imageUri, router]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Bild hochladen</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {!imageUri ? (
          <TouchableOpacity style={styles.pickBtn} onPress={pickImage} activeOpacity={0.9}>
            <Ionicons name="images-outline" size={22} color="#fff" />
            <Text style={styles.pickText}>Bild auswählen</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Image source={{ uri: imageUri }} style={styles.preview} />
            <TouchableOpacity style={styles.pickBtn} onPress={pickImage} activeOpacity={0.9}>
              <Text style={styles.pickText}>Anderes Bild wählen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.uploadBtn, loading && { opacity: 0.5 }]}
              onPress={uploadImage}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.uploadText}>Hochladen</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  container: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#111",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#222",
  },
  pickText: { color: "#fff", fontWeight: "700" },
  preview: { width: 300, height: 300, borderRadius: 14, marginBottom: 16 },
  uploadBtn: { backgroundColor: "#ff4fd8", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, marginTop: 10 },
  uploadText: { color: "#fff", fontWeight: "800" },
});

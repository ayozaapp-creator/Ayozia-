// app/playlist.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNavbar from "../components/bottomnavbar";
import TrackPlayButton from "../components/trackplaybutton";

const BG = "#050509";
const CARD = "#141414";
const TXT = "#ffffff";
const TXT_DIM = "#bdbdbd";
const BORDER = "#292929";

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=1200&auto=format&fit=crop";

type StoredTrack = {
  id: string;
  title: string;
  url: string;
  cover?: string | null;
};

export default function PlaylistScreen() {
  const router = useRouter();
  const [tracks, setTracks] = useState<StoredTrack[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPlaylist = async () => {
    try {
      setLoading(true);
      const raw = await AsyncStorage.getItem("playlist:default");
      const list: StoredTrack[] = raw ? JSON.parse(raw) : [];
      setTracks(Array.isArray(list) ? list : []);
    } catch {
      Alert.alert("Fehler", "Playlist konnte nicht geladen werden.");
      setTracks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlaylist();
  }, []);

  const clearPlaylist = async () => {
    Alert.alert(
      "Playlist leeren",
      "Willst du wirklich alle Titel aus deiner Playlist entfernen?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Leeren",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem("playlist:default");
            setTracks([]);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color={TXT} />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle}>Meine Playlist</Text>
          <Text style={styles.headerSubtitle}>
            Songs, die du über das Menü gespeichert hast.
          </Text>
        </View>

        <View style={{ width: 32 }} />
      </View>

      {/* Aktionen */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={loadPlaylist}
        >
          <Ionicons name="refresh" size={18} color={TXT} />
          <Text style={styles.actionText}>Aktualisieren</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: "#ff4d79" }]}
          onPress={clearPlaylist}
        >
          <Ionicons name="trash-outline" size={18} color="#ff4d79" />
          <Text
            style={[styles.actionText, { color: "#ff4d79" }]}
          >
            Leeren
          </Text>
        </TouchableOpacity>
      </View>

      {/* Inhalt */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={TXT} />
        </View>
      ) : !tracks.length ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>
            Noch keine Titel in deiner Playlist.
          </Text>
          <Text style={styles.emptySub}>
            Füge Songs über das Drei-Punkte-Menü auf der Startseite hinzu.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
        >
          {tracks.map((t, idx) => (
            <View key={`${t.id}-${idx}`} style={styles.row}>
              <Image
                source={{ uri: t.cover || FALLBACK_COVER }}
                style={styles.cover}
              />
              <View style={styles.rowText}>
                <Text style={styles.title} numberOfLines={1}>
                  {t.title}
                </Text>
                <Text style={styles.subtitle}>Playlist · Track #{idx + 1}</Text>
              </View>
              <TrackPlayButton
                track={{
                  id: t.id,
                  title: t.title,
                  url: t.url,
                  cover: t.cover || undefined,
                }}
                playlist={tracks}
                index={idx}
                size={30}
              />
            </View>
          ))}
        </ScrollView>
      )}

      <BottomNavbar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 10,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD,
  },
  headerTitle: {
    color: TXT,
    fontSize: 18,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: TXT_DIM,
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  actionText: {
    color: TXT,
    fontSize: 12,
    fontWeight: "600",
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  emptyText: { color: TXT, fontSize: 14, fontWeight: "700" },
  emptySub: {
    color: TXT_DIM,
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#1d1d1d",
  },
  cover: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: CARD,
    marginRight: 10,
  },
  rowText: {
    flex: 1,
  },
  title: {
    color: TXT,
    fontSize: 14,
    fontWeight: "700",
  },
  subtitle: {
    color: TXT_DIM,
    fontSize: 11,
    marginTop: 2,
  },
});

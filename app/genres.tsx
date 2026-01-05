// app/genres.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const GENRES = [
  { id: "deutschrap", label: "Deutschrap", emoji: "🇩🇪" },
  { id: "afro", label: "Afro / Amapiano", emoji: "🌍" },
  { id: "rnb", label: "R&B", emoji: "💜" },
  { id: "drill", label: "Drill", emoji: "🩸" },
  { id: "trap", label: "Trap", emoji: "🕶️" },
  { id: "oldschool", label: "Oldschool / BoomBap", emoji: "📼" },
  { id: "pop", label: "Pop", emoji: "✨" },
  { id: "dancehall", label: "Dancehall", emoji: "🔥" },
  { id: "latin", label: "Latin / Reggaeton", emoji: "💃" },
  { id: "house", label: "House / EDM", emoji: "🎛️" },
  { id: "soul", label: "Soul", emoji: "🕊️" },
  { id: "other", label: "Alles Mögliche", emoji: "🌈" },
];

export default function GenresOnboarding() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const toggleGenre = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    // 👉 Egal wie viele Genres – einfach speichern und weiter.
    try {
      await AsyncStorage.setItem(
        "preferredGenres",
        JSON.stringify(selected)
      );
    } catch (e) {
      console.log("Error saving preferredGenres:", e);
    }

    // Danach weiter zum Login (kannst später auch auf /home ändern)
    router.replace("/loginpage");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.badge}>Schritt 2 von 2</Text>
        <Text style={styles.title}>Welche Musik liebst du?</Text>
        <Text style={styles.subtitle}>
          Wähle ein paar Genres aus. Wir bauen deinen Feed später darauf auf –
          du kannst alles jederzeit ändern.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {GENRES.map((genre) => {
          const isActive = selected.includes(genre.id);
          return (
            <TouchableOpacity
              key={genre.id}
              style={[styles.tile, isActive && styles.tileActive]}
              onPress={() => toggleGenre(genre.id)}
              activeOpacity={0.9}
            >
              <Text style={styles.tileEmoji}>{genre.emoji}</Text>
              <Text
                style={[styles.tileLabel, isActive && styles.tileLabelActive]}
              >
                {genre.label}
              </Text>
              {isActive && (
                <View style={styles.checkIconWrapper}>
                  <Ionicons name="checkmark" size={16} color="#0b0015" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerHint}>
          Du kannst deine Genre-Auswahl später in deinem Profil jederzeit ändern.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={handleContinue}
          activeOpacity={0.9}
        >
          <Text style={styles.buttonText}>
            {selected.length > 0
              ? `Fertig (${selected.length} ausgewählt)`
              : "Fertig ohne Auswahl"}
          </Text>
          <Ionicons name="checkmark" size={18} color="#0b0015" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const BG = "#060012";
const CARD = "#140825";
const ACCENT = "#ff4fd8";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  header: {
    marginBottom: 10,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#211235",
    color: "#e3d2ff",
    fontSize: 11,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#c2bed4",
  },
  scroll: {
    flex: 1,
    marginTop: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 110,
  },
  tile: {
    width: "47%",
    backgroundColor: CARD,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#251539",
    position: "relative",
  },
  tileActive: {
    borderColor: ACCENT,
    shadowColor: ACCENT,
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  tileEmoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  tileLabel: {
    fontSize: 13,
    color: "#e1dcf5",
    fontWeight: "500",
  },
  tileLabelActive: {
    color: "#ffffff",
  },
  checkIconWrapper: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
  },
  footerHint: {
    fontSize: 11,
    color: "#a69bbc",
    marginBottom: 6,
  },
  button: {
    height: 50,
    borderRadius: 999,
    backgroundColor: ACCENT,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: ACCENT,
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 7,
  },
  buttonText: {
    color: "#0b0015",
    fontSize: 15,
    fontWeight: "700",
  },
});

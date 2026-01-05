// app/profile/settings/feedback.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BG = "#050505";
const CARD = "#111111";
const BORDER = "#1b1b1b";
const TXT = "#ffffff";
const TXT_DIM = "#9c9c9c";
const ACCENT = "#ff4fd8";

export default function FeedbackScreen() {
  const router = useRouter();

  const [selectedType, setSelectedType] = useState<
    "bug" | "idea" | "ui" | "other" | null
  >(null);
  const [message, setMessage] = useState("");

  const sendFeedback = () => {
    if (!selectedType) {
      Alert.alert("Hinweis", "Bitte wähle zuerst eine Kategorie aus.");
      return;
    }
    if (message.trim().length < 5) {
      Alert.alert("Hinweis", "Bitte gib ein ausführliches Feedback ein.");
      return;
    }

    Alert.alert(
      "Danke!",
      "Dein Feedback wurde gespeichert. Wir melden uns bei Bedarf.",
    );

    setSelectedType(null);
    setMessage("");
  };

  const Option = ({
    icon,
    label,
    value,
  }: {
    icon: string;
    label: string;
    value: "bug" | "idea" | "ui" | "other";
  }) => (
    <TouchableOpacity
      style={[
        styles.option,
        selectedType === value && styles.optionSelected,
      ]}
      onPress={() => setSelectedType(value)}
    >
      <Ionicons
        name={icon as any}
        size={20}
        color={selectedType === value ? ACCENT : TXT_DIM}
      />
      <Text
        style={[
          styles.optionLabel,
          selectedType === value && { color: ACCENT },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back-outline" size={24} color={TXT} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Feedback geben</Text>
          <View style={styles.accentBar} />
        </View>

        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="chatbubbles-outline" size={22} color={ACCENT} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.infoTitle}>Dein Feedback zählt</Text>
            <Text style={styles.infoText}>
              Hilf uns, Ayoza zu verbessern. Beschreibe ein Problem, teile eine
              Idee oder sag uns einfach deine Meinung.
            </Text>
          </View>
        </View>

        {/* Kategorie */}
        <Text style={styles.sectionTitle}>Feedback-Typ</Text>
        <View style={styles.card}>
          <Option icon="bug-outline" label="Fehler / Bug" value="bug" />
          <View style={styles.separator} />
          <Option icon="flash-outline" label="Idee / Vorschlag" value="idea" />
          <View style={styles.separator} />
          <Option icon="color-palette-outline" label="Design / UI Problem" value="ui" />
          <View style={styles.separator} />
          <Option icon="document-text-outline" label="Sonstiges" value="other" />
        </View>

        {/* Textfeld */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
          Deine Nachricht
        </Text>
        <TextInput
          style={styles.input}
          multiline
          placeholder="Beschreibe dein Anliegen..."
          placeholderTextColor={TXT_DIM}
          value={message}
          onChangeText={setMessage}
        />

        {/* Button */}
        <TouchableOpacity style={styles.sendBtn} onPress={sendFeedback}>
          <Text style={styles.sendBtnText}>Feedback senden</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: TXT, fontSize: 18, fontWeight: "700" },
  accentBar: {
    marginTop: 4,
    width: 58,
    height: 3,
    borderRadius: 999,
    backgroundColor: ACCENT,
    opacity: 0.55,
  },
  container: { flex: 1 },
  content: { padding: 16 },
  infoCard: {
    flexDirection: "row",
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 18,
  },
  infoTitle: { color: TXT, fontSize: 14, fontWeight: "600" },
  infoText: { color: TXT_DIM, fontSize: 12, marginTop: 4 },
  sectionTitle: { color: TXT_DIM, fontSize: 13, marginBottom: 8 },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  optionSelected: {
    backgroundColor: "#181818",
  },
  optionLabel: {
    color: TXT,
    fontSize: 14,
    marginLeft: 10,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    width: "100%",
  },
  input: {
    backgroundColor: CARD,
    color: TXT,
    fontSize: 14,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    minHeight: 120,
    textAlignVertical: "top",
  },
  sendBtn: {
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 20,
  },
  sendBtnText: {
    color: "#fff",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
  },
});

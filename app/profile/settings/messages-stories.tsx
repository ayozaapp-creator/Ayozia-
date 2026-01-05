// app/profile/settings/messages-stories.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BG = "#050505";
const CARD = "#111111";
const BORDER = "#1b1b1b";
const TXT = "#ffffff";
const TXT_DIM = "#9b9b9b";
const ACCENT = "#ff4fd8"; // nur leichte Akzente

export default function MessagesStoriesSettings() {
  const router = useRouter();

  const [msgPermission, setMsgPermission] =
    useState<"everyone" | "followers" | "none">("everyone");
  const [storyView, setStoryView] =
    useState<"everyone" | "followers" | "close">("everyone");
  const [storyReplies, setStoryReplies] =
    useState<"everyone" | "followers" | "none">("everyone");
  const [mentions, setMentions] =
    useState<"everyone" | "followers" | "none">("everyone");

  const [readReceipts, setReadReceipts] = useState(true);
  const [storyReadReceipts, setStoryReadReceipts] = useState(true);
  const [messageFilter, setMessageFilter] = useState(false);
  const [quietMode, setQuietMode] = useState(false);

  const OptionRow = ({
    label,
    selected,
    onPress,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity onPress={onPress} style={styles.optionRow}>
      <Text style={[styles.optionLabel, selected && styles.highlight]}>
        {label}
      </Text>
      {selected && (
        <Ionicons name="checkmark-outline" size={20} color={ACCENT} />
      )}
    </TouchableOpacity>
  );

  const Section = ({ title, children }: any) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back-outline" size={24} color={TXT} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Messages & Story</Text>
          <View style={styles.headerAccentBar} />
        </View>

        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >

        {/* MESSAGES */}
        <Section title="Nachrichten">
          <OptionRow
            label="Jeder kann dir Nachrichten senden"
            selected={msgPermission === "everyone"}
            onPress={() => setMsgPermission("everyone")}
          />
          <OptionRow
            label="Nur Follower dürfen dir schreiben"
            selected={msgPermission === "followers"}
            onPress={() => setMsgPermission("followers")}
          />
          <OptionRow
            label="Niemand darf dir Nachrichten schicken"
            selected={msgPermission === "none"}
            onPress={() => setMsgPermission("none")}
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Gelesen-Bestätigungen</Text>
            <Switch
              value={readReceipts}
              onValueChange={setReadReceipts}
              trackColor={{ true: ACCENT, false: "#555" }}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Nachrichten filtern</Text>
            <Switch
              value={messageFilter}
              onValueChange={setMessageFilter}
              trackColor={{ true: ACCENT, false: "#555" }}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Quiet Mode</Text>
            <Switch
              value={quietMode}
              onValueChange={setQuietMode}
              trackColor={{ true: ACCENT, false: "#555" }}
            />
          </View>
        </Section>

        {/* STORY */}
        <Section title="Story-Kontrolle">
          <OptionRow
            label="Jeder kann deine Story sehen"
            selected={storyView === "everyone"}
            onPress={() => setStoryView("everyone")}
          />
          <OptionRow
            label="Nur Follower sehen deine Story"
            selected={storyView === "followers"}
            onPress={() => setStoryView("followers")}
          />
          <OptionRow
            label="Nur enge Freunde"
            selected={storyView === "close"}
            onPress={() => setStoryView("close")}
          />

          <OptionRow
            label="Jeder darf auf deine Story antworten"
            selected={storyReplies === "everyone"}
            onPress={() => setStoryReplies("everyone")}
          />
          <OptionRow
            label="Nur Follower dürfen antworten"
            selected={storyReplies === "followers"}
            onPress={() => setStoryReplies("followers")}
          />
          <OptionRow
            label="Niemand darf antworten"
            selected={storyReplies === "none"}
            onPress={() => setStoryReplies("none")}
          />

          <OptionRow
            label="Jeder darf dich erwähnen"
            selected={mentions === "everyone"}
            onPress={() => setMentions("everyone")}
          />
          <OptionRow
            label="Nur Follower dürfen erwähnen"
            selected={mentions === "followers"}
            onPress={() => setMentions("followers")}
          />
          <OptionRow
            label="Niemand darf erwähnen"
            selected={mentions === "none"}
            onPress={() => setMentions("none")}
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Story-Lesebestätigung</Text>
            <Switch
              value={storyReadReceipts}
              onValueChange={setStoryReadReceipts}
              trackColor={{ true: ACCENT, false: "#555" }}
            />
          </View>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    height: 53,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: TXT, fontSize: 18, fontWeight: "700" },
  headerAccentBar: {
    marginTop: 4,
    width: 60,
    height: 3,
    borderRadius: 999,
    backgroundColor: ACCENT,
    opacity: 0.6,
  },
  container: { flex: 1 },
  content: { padding: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { color: TXT_DIM, fontSize: 13, marginBottom: 8 },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER,
  },
  optionRow: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  optionLabel: { color: TXT, fontSize: 14 },
  highlight: { color: ACCENT },
  switchRow: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  switchLabel: { color: TXT, fontSize: 14 },
});

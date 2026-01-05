// app/profile/settings/help.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
    Linking,
    ScrollView,
    StyleSheet,
    Text,
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

export default function HelpScreen() {
  const router = useRouter();

  const openMail = () => {
    Linking.openURL("mailto:support@ayoza.app?subject=Ayoza%20Support");
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back-outline" size={24} color={TXT} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Ayoza Help Center</Text>
          <View className="headerAccentBar" />
          <View style={styles.accentBar} />
        </View>

        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        {/* Intro */}
        <View style={styles.infoCard}>
          <Ionicons name="help-circle-outline" size={22} color={ACCENT} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.infoTitle}>Braucht du Hilfe?</Text>
            <Text style={styles.infoText}>
              Hier findest du kurze Antworten zu Ayoza und kannst uns direkt
              erreichen, wenn etwas nicht funktioniert.
            </Text>
          </View>
        </View>

        {/* Schnelle Hilfe / FAQ-Teaser */}
        <View style={styles.card}>
          <View style={styles.itemHeader}>
            <Text style={styles.sectionTitle}>Schnelle Hilfe</Text>
          </View>

          <View style={styles.item}>
            <View style={styles.itemLeft}>
              <Ionicons
                name="musical-notes-outline"
                size={20}
                color={TXT_DIM}
              />
              <View>
                <Text style={styles.itemTitle}>Musik hochladen</Text>
                <Text style={styles.itemSubtitle}>
                  Wie lade ich einen Track oder ein Snippet bei Ayoza hoch?
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.separator} />

          <View style={styles.item}>
            <View style={styles.itemLeft}>
              <Ionicons name="person-circle-outline" size={20} color={TXT_DIM} />
              <View>
                <Text style={styles.itemTitle}>Profil & Konto</Text>
                <Text style={styles.itemSubtitle}>
                  Probleme mit Login, Profilbild oder deinen Einstellungen.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.separator} />

          <View style={styles.item}>
            <View style={styles.itemLeft}>
              <Ionicons name="chatbubbles-outline" size={20} color={TXT_DIM} />
              <View>
                <Text style={styles.itemTitle}>Nachrichten & Story</Text>
                <Text style={styles.itemSubtitle}>
                  Fragen zum Chat, Lesebestätigungen oder Story-Einstellungen.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Support / Kontakt */}
        <View style={[styles.card, { marginTop: 18 }]}>
          <View style={styles.itemHeader}>
            <Text style={styles.sectionTitle}>Direktkontakt</Text>
          </View>

          <TouchableOpacity style={styles.item} onPress={openMail}>
            <View style={styles.itemLeft}>
              <Ionicons name="mail-outline" size={20} color={ACCENT} />
              <View>
                <Text style={styles.itemTitle}>Support kontaktieren</Text>
                <Text style={styles.itemSubtitle}>
                  Schreib uns eine E-Mail, wenn du einen Bug gefunden hast oder
                  Feedback geben willst.
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward-outline"
              size={18}
              color={TXT_DIM}
            />
          </TouchableOpacity>
        </View>

        {/* Hinweis auf andere Seiten */}
        <Text style={styles.footerNote}>
          Für rechtliche Infos findest du{" "}
          <Text style={styles.footerLink}>Nutzungsbedingungen</Text> und{" "}
          <Text style={styles.footerLink}>Info</Text> als eigene Menüpunkte
          unter Einstellungen.
        </Text>

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
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: { color: TXT, fontSize: 18, fontWeight: "700" },
  accentBar: {
    marginTop: 4,
    width: 80,
    height: 3,
    borderRadius: 999,
    backgroundColor: ACCENT,
    opacity: 0.55,
  },
  container: { flex: 1 },
  content: { padding: 16 },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    marginBottom: 18,
  },
  infoTitle: {
    color: TXT,
    fontSize: 14,
    fontWeight: "600",
  },
  infoText: {
    color: TXT_DIM,
    fontSize: 12,
    marginTop: 4,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    overflow: "hidden",
  },
  itemHeader: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sectionTitle: {
    color: TXT_DIM,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  item: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
  },
  itemTitle: {
    color: TXT,
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 10,
  },
  itemSubtitle: {
    color: TXT_DIM,
    fontSize: 11,
    marginLeft: 10,
    marginTop: 2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginHorizontal: 14,
  },
  footerNote: {
    marginTop: 14,
    color: TXT_DIM,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
  footerLink: {
    color: TXT,
    fontWeight: "600",
  },
});

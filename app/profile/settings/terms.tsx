// app/profile/settings/terms.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
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

export default function TermsScreen() {
  const router = useRouter();

  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        <View style={styles.sectionInner}>{children}</View>
      </View>
    </View>
  );

  const P = ({ children }: { children: React.ReactNode }) => (
    <Text style={styles.paragraph}>{children}</Text>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back-outline" size={24} color={TXT} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Nutzungsbedingungen</Text>
          <View style={styles.accentBar} />
        </View>

        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        {/* Intro / Hinweis */}
        <View style={styles.infoCard}>
          <Ionicons name="document-text-outline" size={22} color={ACCENT} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.infoTitle}>AGB für Ayoza</Text>
            <Text style={styles.infoText}>
              Diese Nutzungsbedingungen regeln die Verwendung der Ayoza-App.
              Die App befindet sich aktuell in einer Beta-/Testphase. Dieser
              Text ist eine Vorlage und sollte später rechtlich geprüft
              werden.
            </Text>
            <Text style={[styles.infoText, { marginTop: 4 }]}>
              Stand: Januar 2025 – Geltungsbereich: weltweit.
            </Text>
          </View>
        </View>

        <Section title="1. Geltungsbereich">
          <P>
            Diese Allgemeinen Geschäftsbedingungen (AGB) regeln die Nutzung der
            mobilen Applikation Ayoza (App) sowie aller damit verbundenen
            Funktionen, Dienste und Inhalte.
          </P>
          <P>
            Durch die Registrierung oder Nutzung der App akzeptierst du diese
            AGB. Ayoza befindet sich in einer aktiven Entwicklungsphase, weshalb
            Funktionen sich jederzeit ändern, erweitert oder entfernt werden
            können.
          </P>
        </Section>

        <Section title="2. Registrierung & Benutzerkonto">
          <P>
            Zur vollumfänglichen Nutzung ist ein Benutzerkonto erforderlich. Du
            verpflichtest dich, bei der Registrierung korrekte Angaben zu machen
            und deine Zugangsdaten vertraulich zu behandeln.
          </P>
          <P>
            Mehrere Konten pro Person sind nur erlaubt, solange kein Missbrauch
            stattfindet. Ayoza kann Konten sperren, wenn gegen diese AGB,
            geltendes Recht oder Rechte Dritter verstoßen wird.
          </P>
        </Section>

        <Section title="3. Funktionen von Ayoza">
          <P>
            Ayoza kombiniert Funktionen von Musikplattformen, Social Media und
            Matching-Diensten. Dazu gehören insbesondere:
          </P>
          <P>• Musik-Upload und Streaming</P>
          <P>• Kurzvideos und Snippets im TikTok-Style</P>
          <P>• Profile, Bio, Bilder und Story-Funktionen</P>
          <P>• Follower-System, Likes, Saves, Plays</P>
          <P>• Messenger / Direct Messages</P>
          <P>• Swipe- und Match-Mechaniken</P>
          <P>• Coins und virtuelle Währung</P>
          <P>• Premium-Features und Boosts</P>
        </Section>

        <Section title="4. Nutzerinhalte (User-Generated Content)">
          <P>
            Du kannst eigene Musik, Snippets, Bilder, Texte, Stories und andere
            Inhalte in Ayoza hochladen.
          </P>
          <P>
            Du garantierst, dass du alle erforderlichen Rechte an den
            hochgeladenen Inhalten besitzt, insbesondere Urheberrechte,
            Leistungsschutzrechte, Markenrechte und eventuelle
            Verwertungsgesellschaftsrechte (z. B. GEMA).
          </P>
          <P>
            Du stellst Ayoza von sämtlichen Ansprüchen Dritter frei, die aus
            einer von dir zu vertretenden Rechtsverletzung durch deine Inhalte
            entstehen.
          </P>
          <P>
            Ayoza ist berechtigt, Inhalte zu entfernen oder zu sperren, wenn
            diese gegen diese AGB, Community-Regeln oder geltendes Recht
            verstoßen.
          </P>
        </Section>

        <Section title="5. Lizenzrechte an Inhalten">
          <P>
            Durch das Hochladen von Inhalten räumst du Ayoza eine einfache,
            weltweite, nicht-exklusive Lizenz ein, deine Inhalte zu speichern,
            zu hosten, zu streamen, öffentlich zugänglich zu machen und in
            Feeds, Empfehlungen und Algorithmen anzuzeigen.
          </P>
          <P>
            Ayoza ist berechtigt, Inhalte technisch zu bearbeiten, zu
            transkodieren und in der Darstellung anzupassen (z. B.
            Komprimierung, Thumbnails).
          </P>
          <P>
            Die Lizenz erlischt, wenn du deine Inhalte löschst. Bereits
            erstellte Backups werden so schnell wie technisch möglich
            bereinigt.
          </P>
        </Section>

        <Section title="6. Coins & virtuelle Währung">
          <P>
            Ayoza bietet eine virtuelle Währung (Coins) an. Mit Coins können
            unter anderem Premium-Funktionen, Boosts, Gifts, Matches oder
            andere In-App-Features genutzt werden.
          </P>
          <P>
            Coins sind keine echte Währung, nicht übertragbar und können nicht
            in Geld ausgezahlt werden. Ein Tausch gegen reale Währungen ist
            ausgeschlossen.
          </P>
          <P>
            Gekaufte oder verdiente Coins sind endgültig. Eine Erstattung ist
            grundsätzlich ausgeschlossen, sofern nicht gesetzlich zwingend
            anders geregelt.
          </P>
        </Section>

        <Section title="7. In-App-Käufe & Premium">
          <P>
            Du kannst über die App Coins und Premium-Funktionen erwerben. Die
            Abrechnung erfolgt in der Regel über den jeweiligen App-Store
            (z. B. Apple App Store, Google Play Store).
          </P>
          <P>
            Preise und Inhalte von Premium-Funktionen können jederzeit geändert
            werden. Änderungen wirken sich nicht rückwirkend auf bereits
            abgeschlossene Zeiträume aus.
          </P>
          <P>
            Im Falle von Zahlungsbetrug, Rückbuchungen oder Missbrauch kann
            Ayoza dein Konto einschränken oder sperren.
          </P>
        </Section>

        <Section title="8. Swipe- & Match-System">
          <P>
            Ayoza bietet Swipe- und Match-Funktionen an, mit denen du andere
            Nutzer entdecken und Matches erstellen kannst. Diese Funktionen
            dürfen nicht missbräuchlich verwendet werden.
          </P>
          <P>
            Es ist untersagt, Fake-Profile zu erstellen, andere zu täuschen
            oder Matches für Spam oder Belästigung zu nutzen.
          </P>
        </Section>

        <Section title="9. Messenger & Story-Funktion">
          <P>
            Über den integrierten Messenger kannst du private Nachrichten
            austauschen. In der aktuellen Beta-Version ist der Messenger noch
            nicht Ende-zu-Ende-verschlüsselt.
          </P>
          <P>
            Verboten sind insbesondere Belästigung, Hate Speech, unerwünschte
            sexuelle Inhalte, das Versenden von Spam oder betrügerischen
            Nachrichten.
          </P>
          <P>
            Ayoza kann bei Meldungen oder schweren Verstößen Inhalte prüfen,
            Chats einschränken oder Konten sperren.
          </P>
        </Section>

        <Section title="10. Community-Regeln & Verbotene Inhalte">
          <P>Verboten sind insbesondere:</P>
          <P>• Hassrede, Diskriminierung und Mobbing</P>
          <P>• Darstellungen von Gewalt oder Selbstverletzung</P>
          <P>• Inhalte mit sexueller Darstellung Minderjähriger</P>
          <P>• Urheberrechtsverletzungen und Raubkopien</P>
          <P>• Spam, Bots, Fake-Likes und Manipulation von Statistiken</P>
          <P>• Werbung für illegale Produkte oder Dienste</P>
          <P>
            Verstöße können zur Löschung von Inhalten, zur Einschränkung von
            Funktionen oder zur dauerhaften Sperrung deines Kontos führen.
          </P>
        </Section>

        <Section title="11. Datenschutz & Datenspeicherung (Kurzinfo)">
          <P>
            Ayoza speichert alle Daten, die für den Betrieb der Plattform
            erforderlich sind, insbesondere:
          </P>
          <P>• Registrierungsdaten (E-Mail, Username, Passwort-Hash)</P>
          <P>• Profilinformationen und Profilbilder</P>
          <P>• Musik, Snippets, Bilder und Story-Inhalte</P>
          <P>• Nachrichten im Messenger</P>
          <P>• Follower-Daten, Likes, Saves und Plays</P>
          <P>• Logs und Nutzungsstatistiken</P>
          <P>
            Der Server befindet sich aktuell in einer Entwicklungsumgebung (lokal
            auf einem PC). Es kann zu technischen Ausfällen oder Datenverlust
            kommen.
          </P>
          <P>
            Weitere Details zur Datenverarbeitung findest du später in einer
            separaten Datenschutz-Seite in den Einstellungen.
          </P>
        </Section>

        <Section title="12. Urheberrecht & Verwertungsgesellschaften">
          <P>
            Du bist selbst dafür verantwortlich, ob und in welcher Form deine
            Musik und Inhalte bei Verwertungsgesellschaften (z. B. GEMA) oder
            anderen Organisationen gemeldet werden müssen.
          </P>
          <P>
            Ayoza übernimmt keine automatische Meldung und keine Garantie für
            korrekte Abrechnung gegenüber Verwertungsgesellschaften. Alle
            Verpflichtungen liegen bei dir als Urheber oder Rechteinhaber.
          </P>
        </Section>

        <Section title="13. Analyse, Statistiken & Algorithmus">
          <P>
            Ayoza darf Nutzungsdaten wie Plays, Likes, Saves, Profilaufrufe
            und Interaktionen analysieren, um:
          </P>
          <P>• Feeds und Empfehlungen zu optimieren</P>
          <P>• Trends und Rankings zu berechnen</P>
          <P>• Missbrauch und Spam zu erkennen</P>
          <P>
            Diese Analysen dienen der Verbesserung der Plattform und werden
            nicht zur individuellen Kredit- oder Bonitätsprüfung verwendet.
          </P>
        </Section>

        <Section title="14. Missbrauch, Sperrung & Meldung">
          <P>
            Ayoza ist berechtigt, bei Verdacht auf Missbrauch oder bei
            gemeldeten Verstößen:
          </P>
          <P>• Inhalte zu verstecken oder zu löschen</P>
          <P>• Features (z. B. Upload, Chat) zu begrenzen</P>
          <P>• Nutzerkonten vorübergehend oder dauerhaft zu sperren</P>
          <P>
            In schweren Fällen kann Ayoza Strafverfolgungsbehörden informieren,
            insbesondere bei Kindeswohlgefährdung, Gewaltandrohungen oder
            schwerem Betrug.
          </P>
        </Section>

        <Section title="15. Haftungsausschluss">
          <P>
            Ayoza übernimmt keine Haftung für Schäden, die durch die Nutzung der
            App entstehen, soweit gesetzlich zulässig. Dies umfasst insbesondere:
          </P>
          <P>• Datenverlust und Ausfälle des Dienstes</P>
          <P>• entgangene Einnahmen</P>
          <P>• Inhalte und Verhalten anderer Nutzer</P>
          <P>
            Ayoza ist ein Beta-Projekt, technisch kann es jederzeit zu Bugs,
            Fehlern, Verzögerungen oder Ausfällen kommen.
          </P>
        </Section>

        <Section title="16. Widerruf & digitale Güter">
          <P>
            Coins und Premium-Funktionen sind digitale Inhalte. Sobald sie
            freigeschaltet oder genutzt wurden, ist eine Rückerstattung in der
            Regel ausgeschlossen, sofern nicht zwingende gesetzliche
            Vorschriften etwas anderes verlangen.
          </P>
        </Section>

        <Section title="17. Kündigung & Löschung des Kontos">
          <P>
            Du kannst dein Konto jederzeit in den Einstellungen löschen, sobald
            diese Funktion verfügbar ist, oder den Support kontaktieren.
          </P>
          <P>
            Nach Kündigung werden deine Inhalte so schnell wie technisch möglich
            entfernt. Reste in Backups können für eine gewisse Zeit fortbestehen
            und werden turnusmäßig überschrieben.
          </P>
        </Section>

        <Section title="18. Änderungen dieser AGB">
          <P>
            Ayoza kann diese AGB von Zeit zu Zeit anpassen. Über wesentliche
            Änderungen wirst du innerhalb der App oder über andere geeignete
            Kanäle informiert.
          </P>
          <P>
            Wenn du die App nach einer Änderung weiter nutzt, gelten die
            aktualisierten Bedingungen als akzeptiert.
          </P>
        </Section>

        <Section title="19. Schlussbestimmungen">
          <P>
            Sollte eine Bestimmung dieser AGB unwirksam sein oder werden, bleibt
            die Wirksamkeit der übrigen Bestimmungen unberührt.
          </P>
          <P>
            Es gilt das Recht des Landes, in dem der Anbieter seinen Sitz hat,
            soweit dem keine zwingenden Verbraucherschutzvorschriften
            entgegenstehen.
          </P>
        </Section>

        <Text style={styles.footerNote}>
          Hinweis: Dieser Text ist eine generische AGB-Vorlage für Ayoza und
          ersetzt keine individuelle Rechtsberatung. Lasse die endgültige
          Fassung von einer fachkundigen Stelle prüfen.
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
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: TXT, fontSize: 18, fontWeight: "700" },
  accentBar: {
    marginTop: 4,
    width: 120,
    height: 3,
    borderRadius: 999,
    backgroundColor: ACCENT,
    opacity: 0.6,
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
  infoTitle: { color: TXT, fontSize: 14, fontWeight: "600" },
  infoText: { color: TXT_DIM, fontSize: 12 },
  section: { marginBottom: 18 },
  sectionTitle: {
    color: TXT_DIM,
    fontSize: 12,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  sectionInner: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  paragraph: {
    color: TXT,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
  },
  footerNote: {
    marginTop: 6,
    color: TXT_DIM,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
});

// app/profile/settings/membership.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BG = "#050505";
const CARD = "#141414";
const BORDER = "#1f1f1f";
const TXT = "#ffffff";
const TXT_DIM = "#b5b5b5";
const ACCENT = "#ff4fd8";

type LoggedUser = {
  id: string;
  email?: string;
  username?: string;
};

type MembershipState = {
  isPremium: boolean;
  autoRenew: boolean;
};

const DEFAULT_STATE: MembershipState = {
  isPremium: false,
  autoRenew: true,
};

const MembershipSettingsScreen: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<MembershipState>(DEFAULT_STATE);

  const getStorageKey = (userId: string) =>
    `ayoza:membership:${userId}`;

  // User + gespeicherte Mitgliedschaft laden
  useEffect(() => {
    (async () => {
      try {
        const rawUser = await AsyncStorage.getItem("user");
        if (!rawUser) {
          Alert.alert("Nicht eingeloggt", "Bitte zuerst einloggen.");
          router.replace("/login");
          return;
        }

        const u: LoggedUser = JSON.parse(rawUser);
        setUser(u);

        const stored = await AsyncStorage.getItem(getStorageKey(u.id));
        if (stored) {
          const parsed = JSON.parse(stored);
          setState({
            ...DEFAULT_STATE,
            ...parsed,
          });
        } else {
          setState(DEFAULT_STATE);
        }
      } catch (err: any) {
        console.log("membership load error", err?.message ?? err);
        Alert.alert(
          "Fehler",
          "Mitgliedschaftsdaten konnten nicht geladen werden."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const saveState = async (next: MembershipState) => {
    if (!user) return;
    try {
      setSaving(true);
      await AsyncStorage.setItem(
        getStorageKey(user.id),
        JSON.stringify(next)
      );
    } catch (err: any) {
      console.log("membership save error", err?.message ?? err);
      Alert.alert(
        "Fehler",
        "Änderungen konnten nicht gespeichert werden."
      );
    } finally {
      setSaving(false);
    }
  };

  const togglePremium = () => {
    const next = {
      ...state,
      isPremium: !state.isPremium,
    };
    setState(next);
    saveState(next);
  };

  const toggleAutoRenew = () => {
    const next = {
      ...state,
      autoRenew: !state.autoRenew,
    };
    setState(next);
    saveState(next);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back-outline" size={24} color={TXT} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Käufe & Mitgliedschaft</Text>
          <View style={styles.headerAccentBar} />
        </View>

        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="small" color={ACCENT} />
        </View>
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
        >
          {/* PREMIUM CARD */}
          <View style={styles.premiumCard}>
            <View style={styles.premiumLeft}>
              <View style={styles.premiumIconBubble}>
                <Ionicons name="diamond-outline" size={22} color={TXT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.premiumTitle}>
                  Ayoza Premium
                </Text>
                <Text style={styles.premiumSubtitle}>
                  Keine Werbung, bessere Audioqualität, mehr Uploads.
                </Text>
                <Text style={styles.premiumStatus}>
                  Status:{" "}
                  <Text
                    style={[
                      styles.premiumStatusValue,
                      { color: state.isPremium ? "#7CFC8A" : "#ff9a9a" },
                    ]}
                  >
                    {state.isPremium ? "AKTIV" : "NICHT AKTIV"}
                  </Text>
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.premiumButton}
              onPress={togglePremium}
              activeOpacity={0.9}
            >
              <Text style={styles.premiumButtonText}>
                {state.isPremium ? "Premium beenden (Test)" : "Premium testen"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* EINSTELLUNGEN-KARTE */}
          <View style={styles.card}>
            {/* Automatische Verlängerung */}
            <View style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowLeft}>
                <View style={styles.iconBubble}>
                  <Ionicons
                    name="refresh-circle-outline"
                    size={20}
                    color={TXT}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>
                    Automatische Verlängerung
                  </Text>
                  <Text style={styles.rowSubtitle}>
                    Abo läuft jeden Monat automatisch weiter.
                  </Text>
                </View>
              </View>

              <Switch
                value={state.autoRenew}
                onValueChange={toggleAutoRenew}
                thumbColor={state.autoRenew ? "#ffffff" : "#888"}
                trackColor={{ false: "#444", true: ACCENT }}
              />
            </View>

            {/* Zahlungsmethoden */}
            <TouchableOpacity
              style={[styles.row, styles.rowBorder]}
              activeOpacity={0.8}
              onPress={() =>
                Alert.alert(
                  "Zahlungsmethoden",
                  "Hier kannst du später Karten & Zahlungsarten verwalten."
                )
              }
            >
              <View style={styles.rowLeft}>
                <View style={styles.iconBubble}>
                  <Ionicons name="card-outline" size={20} color={TXT} />
                </View>
                <View>
                  <Text style={styles.rowLabel}>Zahlungsmethoden</Text>
                  <Text style={styles.rowSubtitle}>
                    Karten und Zahlungsarten verwalten.
                  </Text>
                </View>
              </View>

              <Ionicons
                name="chevron-forward-outline"
                size={18}
                color={TXT_DIM}
              />
            </TouchableOpacity>

            {/* Kaufverlauf */}
            <TouchableOpacity
              style={[styles.row, styles.rowBorder]}
              activeOpacity={0.8}
              onPress={() =>
                Alert.alert(
                  "Kaufverlauf",
                  "Liste deiner bisherigen Käufe – kommt später."
                )
              }
            >
              <View style={styles.rowLeft}>
                <View style={styles.iconBubble}>
                  <Ionicons
                    name="receipt-outline"
                    size={20}
                    color={TXT}
                  />
                </View>
                <View>
                  <Text style={styles.rowLabel}>Kaufverlauf</Text>
                  <Text style={styles.rowSubtitle}>
                    Abos, Boosts und Coins einsehen.
                  </Text>
                </View>
              </View>

              <Ionicons
                name="chevron-forward-outline"
                size={18}
                color={TXT_DIM}
              />
            </TouchableOpacity>

            {/* Gutscheine / Codes */}
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.8}
              onPress={() =>
                Alert.alert(
                  "Gutscheincode",
                  "Einlösen von Promo- & Gutscheincodes – kommt später."
                )
              }
            >
              <View style={styles.rowLeft}>
                <View style={styles.iconBubble}>
                  <Ionicons
                    name="pricetag-outline"
                    size={20}
                    color={TXT}
                  />
                </View>
                <View>
                  <Text style={styles.rowLabel}>Gutscheincode einlösen</Text>
                  <Text style={styles.rowSubtitle}>
                    Promo-Codes für Premium oder Coins.
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

          {saving && (
            <View style={styles.savingRow}>
              <ActivityIndicator size="small" color={ACCENT} />
              <Text style={styles.savingText}>Speichere…</Text>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default MembershipSettingsScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
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
  headerTitle: {
    color: ACCENT,
    fontSize: 18,
    fontWeight: "700",
  },
  headerAccentBar: {
    marginTop: 3,
    width: 60,
    height: 3,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  premiumCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: ACCENT,
    marginBottom: 16,
  },
  premiumLeft: {
    flexDirection: "row",
    marginBottom: 12,
  },
  premiumIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    backgroundColor: "#1f1f1f",
    borderWidth: 1,
    borderColor: ACCENT,
  },
  premiumTitle: {
    color: TXT,
    fontSize: 17,
    fontWeight: "700",
  },
  premiumSubtitle: {
    color: TXT_DIM,
    fontSize: 12,
    marginTop: 2,
  },
  premiumStatus: {
    color: TXT_DIM,
    fontSize: 12,
    marginTop: 6,
  },
  premiumStatusValue: {
    fontWeight: "700",
  },
  premiumButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  premiumButtonText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 13,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    justifyContent: "space-between",
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },
  iconBubble: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "#1f1f1f",
    borderWidth: 1,
    borderColor: ACCENT,
  },
  rowLabel: {
    color: TXT,
    fontSize: 15,
  },
  rowSubtitle: {
    color: TXT_DIM,
    fontSize: 12,
    marginTop: 2,
  },
  savingRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  savingText: {
    marginLeft: 8,
    color: TXT_DIM,
    fontSize: 12,
  },
});

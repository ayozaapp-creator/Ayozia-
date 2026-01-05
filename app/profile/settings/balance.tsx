// app/profile/settings/balance.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
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

const API = "http://192.168.0.224:5000";


const http = axios.create({
  baseURL: API,
  timeout: 15000,
});

type LoggedUser = {
  id: string;
  email?: string;
  username?: string;
};

type WalletResponse = {
  balance: number;
};

const BalanceScreen: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // User + Guthaben laden
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("user");
        if (!raw) {
          Alert.alert("Nicht eingeloggt", "Bitte zuerst einloggen.");
          return;
        }
        const u: LoggedUser = JSON.parse(raw);
        setUser(u);

        const res = await http.get<WalletResponse>(`/wallet/${u.id}`);
        const value =
          typeof res.data?.balance === "number" ? res.data.balance : 0;
        setBalance(value);
      } catch (err: any) {
        console.log("wallet load error", err?.message ?? err);
        Alert.alert(
          "Fehler",
          "Dein Guthaben konnte nicht geladen werden. Versuche es später erneut."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const changeBalance = async (delta: number) => {
    if (!user) return;
    try {
      setSaving(true);
      const res = await http.post<WalletResponse>(`/wallet/${user.id}/change`, { delta });
      const value =
        typeof res.data?.balance === "number" ? res.data.balance : 0;
      setBalance(value);
    } catch (err: any) {
      console.log("wallet change error", err?.message ?? err);
      Alert.alert(
        "Fehler",
        "Guthaben konnte nicht aktualisiert werden. Prüfe deine Verbindung."
      );
    } finally {
      setSaving(false);
    }
  };

  const displayBalance = balance ?? 0;

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
          <Text style={styles.headerTitle}>Guthaben</Text>
          <View style={styles.headerAccentBar} />
        </View>

        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="small" color={ACCENT} />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.card}>
            <View style={styles.balanceRow}>
              <View style={styles.iconBubble}>
                <Ionicons name="wallet-outline" size={22} color={TXT} />
              </View>
              <View>
                <Text style={styles.labelSmall}>Aktuelles Guthaben</Text>
                <Text style={styles.balanceText}>
                  {displayBalance.toLocaleString("de-DE")} Coins
                </Text>
              </View>
            </View>

            {user?.username && (
              <Text style={styles.userHint}>
                Account: <Text style={styles.userName}>{user.username}</Text>
              </Text>
            )}
          </View>

          {/* Test-Buttons – später durch echtes Kauf-System ersetzen */}
          <View style={styles.actionsCard}>
            <Text style={styles.actionsTitle}>Test-Aufladung</Text>
            <Text style={styles.actionsSub}>
              Nur zum Testen – später ersetzen wir das durch echtes Bezahlen
              (z.B. In-App-Purchase, Stripe usw.).
            </Text>

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.btnPrimary}
                disabled={saving}
                onPress={() => changeBalance(10)}
              >
                <Text style={styles.btnPrimaryText}>+ 10 Coins</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnSecondary}
                disabled={saving}
                onPress={() => changeBalance(1)}
              >
                <Text style={styles.btnSecondaryText}>+ 1 Coin</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.btnDanger}
                disabled={saving}
                onPress={() => changeBalance(-1)}
              >
                <Text style={styles.btnDangerText}>- 1 Coin</Text>
              </TouchableOpacity>
            </View>

            {saving && (
              <View style={styles.savingRow}>
                <ActivityIndicator size="small" color={ACCENT} />
                <Text style={styles.savingText}>Speichere…</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default BalanceScreen;

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
    width: 40,
    height: 3,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#1f1f1f",
    borderWidth: 1,
    borderColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  labelSmall: {
    color: TXT_DIM,
    fontSize: 13,
  },
  balanceText: {
    color: TXT,
    fontSize: 26,
    fontWeight: "700",
    marginTop: 4,
  },
  userHint: {
    marginTop: 10,
    color: TXT_DIM,
    fontSize: 13,
  },
  userName: {
    color: TXT,
    fontWeight: "600",
  },
  actionsCard: {
    marginTop: 18,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  actionsTitle: {
    color: TXT,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  actionsSub: {
    color: TXT_DIM,
    fontSize: 12,
    marginBottom: 14,
  },
  btnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  btnPrimary: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: ACCENT,
    alignItems: "center",
  },
  btnPrimaryText: {
    color: "#000",
    fontWeight: "700",
  },
  btnSecondary: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ACCENT,
    alignItems: "center",
  },
  btnSecondaryText: {
    color: ACCENT,
    fontWeight: "600",
  },
  btnDanger: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ff4f4f",
    alignItems: "center",
  },
  btnDangerText: {
    color: "#ff6b6b",
    fontWeight: "600",
  },
  savingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  savingText: {
    marginLeft: 8,
    color: TXT_DIM,
    fontSize: 12,
  },
});

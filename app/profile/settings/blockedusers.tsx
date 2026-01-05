// app/profile/settings/blocked-users.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
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

type BlockedUser = {
  id: string;
  username: string;
  reason?: string;
};

export default function BlockedUsersScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("ayoza_blocked_users");
        if (raw) {
          setBlocked(JSON.parse(raw));
        } else {
          // Demo-Daten – später mit echtem Backend füttern (z.B. /users/blocked)
          setBlocked([
            {
              id: "demo-1",
              username: "loud_spammer",
              reason: "Spam-Nachrichten",
            },
            {
              id: "demo-2",
              username: "toxic_user",
              reason: "Beleidigendes Verhalten",
            },
          ]);
        }
      } catch (e) {
        console.log("Blocked users load error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveBlocked = async (list: BlockedUser[]) => {
    try {
      setBlocked(list);
      await AsyncStorage.setItem("ayoza_blocked_users", JSON.stringify(list));
    } catch (e) {
      console.log("Blocked users save error:", e);
    }
  };

  const handleUnblock = (user: BlockedUser) => {
    Alert.alert(
      "Entsperren",
      `Möchtest du @${user.username} wirklich entsperren?`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Entsperren",
          style: "destructive",
          onPress: () => {
            const filtered = blocked.filter((u) => u.id !== user.id);
            saveBlocked(filtered);
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: BlockedUser }) => (
    <View style={styles.userRow}>
      <View style={styles.userLeft}>
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person-circle-outline" size={30} color={TXT_DIM} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.usernameText}>@{item.username}</Text>
          {item.reason ? (
            <Text style={styles.reasonText}>{item.reason}</Text>
          ) : (
            <Text style={styles.reasonText}>Blockiert</Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={styles.unblockBtn}
        onPress={() => handleUnblock(item)}
      >
        <Ionicons name="remove-circle-outline" size={18} color={ACCENT} />
        <Text style={styles.unblockText}>Entsperren</Text>
      </TouchableOpacity>
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
          <Text style={styles.headerTitle}>Blockierte Nutzer</Text>
          <View style={styles.headerAccentBar} />
        </View>

        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <View style={styles.container}>
          <View style={styles.content}>
            {/* Info-Karte */}
            <View style={styles.infoCard}>
              <Ionicons
                name="hand-left-outline"
                size={22}
                color={ACCENT}
              />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.infoTitle}>Blockierte Accounts</Text>
                <Text style={styles.infoText}>
                  Nutzer auf dieser Liste können dein Profil nicht sehen,
                  dir keine Nachrichten schicken und nicht mit deinen Inhalten
                  interagieren – ähnlich wie bei Instagram.
                </Text>
              </View>
            </View>

            {/* Liste */}
            <View style={styles.card}>
              {blocked.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={34}
                    color={TXT_DIM}
                  />
                  <Text style={styles.emptyTitle}>Keine blockierten Nutzer</Text>
                  <Text style={styles.emptyText}>
                    Du hast aktuell niemanden blockiert.  
                    Wenn du jemanden blockierst, erscheint der Account hier.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={blocked}
                  keyExtractor={(item) => item.id}
                  renderItem={renderItem}
                  ItemSeparatorComponent={() => (
                    <View style={styles.separator} />
                  )}
                />
              )}
            </View>

            <View style={{ height: 40 }} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

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
    width: 80,
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
    flex: 1,
  },
  infoCard: {
    flexDirection: "row",
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
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    paddingVertical: 4,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "space-between",
  },
  userLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },
  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: "#101010",
  },
  usernameText: {
    color: TXT,
    fontSize: 14,
    fontWeight: "600",
  },
  reasonText: {
    color: TXT_DIM,
    fontSize: 11,
    marginTop: 2,
  },
  unblockBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ACCENT,
  },
  unblockText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: 62, // unter Avatar + Text, wie Insta
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 26,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: TXT,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 8,
  },
  emptyText: {
    color: TXT_DIM,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
});

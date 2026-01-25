// components/FollowRequestsBanner.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const CARD = "#111";
const BORDER = "#1e1e1e";
const TXT = "#fff";
const TXT_DIM = "#bdbdbd";
const ACCENT = "#ff4fd8";

const API = "http://192.168.0.224:5000";

const FALLBACK_AVATAR =
  "https://upload.wikimedia.org/wikipedia/commons/2/2c/Default_pfp.svg";

type PublicUser = {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string | null;
  bio?: string;
  isVerified?: boolean;
  createdAt?: string | null;
};

type FollowRequestItem = {
  fromId: string;
  toId: string;
  createdAt: string;
  user?: PublicUser | null;
};

type Props = {
  meId?: string | null;
};

async function getViewerId(): Promise<string | null> {
  const keys = ["user", "@user", "ayo_user", "auth_user", "ayozia_user", "currentUser"];
  for (const k of keys) {
    try {
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      const j = JSON.parse(raw);
      const u = j?.user?.id ? j.user : j;
      const id = u?.id || u?._id || u?.userId || u?.uid;
      if (id) return String(id);
    } catch {}
  }
  return null;
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function FollowRequestsBanner({ meId }: Props) {
  const router = useRouter();
  const base = useMemo(() => API.replace(/\/$/, ""), []);

  const [viewerId, setViewerId] = useState<string>("");
  const [count, setCount] = useState<number>(0);

  const [open, setOpen] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [items, setItems] = useState<FollowRequestItem[]>([]);
  const [busyId, setBusyId] = useState<string>("");

  const resolveViewerId = useCallback(async () => {
    if (meId) return String(meId);
    return await getViewerId();
  }, [meId]);

  const fetchRequests = useCallback(
    async (me: string) => {
      const res = await fetch(
        `${base}/users/${encodeURIComponent(me)}/follow-requests?viewer=${encodeURIComponent(me)}`
      );
      const json = await safeJson(res);

      if (!res.ok) {
        // wenn endpoint fehlt oder 403 → keine Anzeige
        return { ok: false, requests: [] as FollowRequestItem[] };
      }

      const arr = Array.isArray(json?.requests) ? json.requests : [];
      return { ok: true, requests: arr as FollowRequestItem[] };
    },
    [base]
  );

  const loadCount = useCallback(async () => {
    const me = await resolveViewerId();
    if (!me) return;

    setViewerId(me);
    const r = await fetchRequests(me);
    setCount(r.requests.length);
  }, [fetchRequests, resolveViewerId]);

  const openModal = useCallback(async () => {
    const me = viewerId || (await resolveViewerId());
    if (!me) return;

    setViewerId(me);
    setOpen(true);
    setLoadingList(true);

    try {
      const r = await fetchRequests(me);
      setItems(r.requests);
      setCount(r.requests.length);
    } catch (e: any) {
      Alert.alert("Fehler", e?.message || "Konnte Follow-Anfragen nicht laden.");
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  }, [fetchRequests, resolveViewerId, viewerId]);

  const accept = useCallback(
    async (fromId: string) => {
      if (!viewerId) return;
      setBusyId(fromId);
      try {
        const res = await fetch(`${base}/follow-requests/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toId: viewerId, fromId }),
        });
        const json = await safeJson(res);
        if (!res.ok) throw new Error(json?.message || "Konnte nicht akzeptieren.");

        setItems((prev) => prev.filter((x) => x.fromId !== fromId));
        setCount((c) => Math.max(0, c - 1));
      } catch (e: any) {
        Alert.alert("Fehler", e?.message || "Akzeptieren fehlgeschlagen.");
      } finally {
        setBusyId("");
      }
    },
    [base, viewerId]
  );

  const decline = useCallback(
    async (fromId: string) => {
      if (!viewerId) return;
      setBusyId(fromId);
      try {
        const res = await fetch(`${base}/follow-requests/decline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toId: viewerId, fromId }),
        });
        const json = await safeJson(res);
        if (!res.ok) throw new Error(json?.message || "Konnte nicht ablehnen.");

        setItems((prev) => prev.filter((x) => x.fromId !== fromId));
        setCount((c) => Math.max(0, c - 1));
      } catch (e: any) {
        Alert.alert("Fehler", e?.message || "Ablehnen fehlgeschlagen.");
      } finally {
        setBusyId("");
      }
    },
    [base, viewerId]
  );

  // refresh wenn Screen fokussiert
  useFocusEffect(
    useCallback(() => {
      loadCount();
    }, [loadCount])
  );

  // Polling
  useEffect(() => {
    const t = setInterval(() => loadCount(), 7000);
    return () => clearInterval(t);
  }, [loadCount]);

  if (!viewerId) return null;
  if (count <= 0) return null;

  return (
    <>
      <TouchableOpacity style={styles.banner} activeOpacity={0.9} onPress={openModal}>
        <View style={styles.bannerLeft}>
          <View style={styles.badgeIcon}>
            <Ionicons name="person-add-outline" size={18} color={ACCENT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Follow-Anfragen</Text>
            <Text style={styles.bannerSub}>
              {count === 1 ? "1 Anfrage wartet" : `${count} Anfragen warten`}
            </Text>
          </View>
        </View>

        <View style={styles.countPill}>
          <Text style={styles.countText}>{count > 99 ? "99+" : String(count)}</Text>
        </View>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBg}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject as any}
            activeOpacity={1}
            onPress={() => setOpen(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Follow-Anfragen</Text>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={TXT} />
              </TouchableOpacity>
            </View>

            {loadingList ? (
              <View style={{ paddingVertical: 18, alignItems: "center" }}>
                <ActivityIndicator color={ACCENT} />
              </View>
            ) : items.length === 0 ? (
              <View style={{ paddingVertical: 18, alignItems: "center" }}>
                <Text style={{ color: TXT_DIM }}>Keine Anfragen</Text>
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(it) => `${it.fromId}:${it.toId}`}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                contentContainerStyle={{ paddingBottom: 8 }}
                renderItem={({ item }) => {
                  const u = item.user;
                  const name = u?.username ? `@${u.username}` : `User ${item.fromId.slice(0, 6)}…`;
                  const avatar = u?.avatarUrl || FALLBACK_AVATAR;

                  return (
                    <View style={styles.reqRow}>
                      <TouchableOpacity
                        style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                        activeOpacity={0.85}
                        onPress={() => {
                          setOpen(false);
                          router.push(`/profile/${item.fromId}`);
                        }}
                      >
                        <Image source={{ uri: avatar }} style={styles.avatar} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reqName} numberOfLines={1}>
                            {name}
                          </Text>
                          <Text style={styles.reqMeta} numberOfLines={1}>
                            möchte dir folgen
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <View style={styles.reqActions}>
                        <TouchableOpacity
                          onPress={() => accept(item.fromId)}
                          activeOpacity={0.9}
                          disabled={busyId === item.fromId}
                          style={[
                            styles.btn,
                            styles.btnAccept,
                            busyId === item.fromId && { opacity: 0.6 },
                          ]}
                        >
                          <Text style={styles.btnTxtDark}>
                            {busyId === item.fromId ? "…" : "Annehmen"}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => decline(item.fromId)}
                          activeOpacity={0.9}
                          disabled={busyId === item.fromId}
                          style={[
                            styles.btn,
                            styles.btnDecline,
                            busyId === item.fromId && { opacity: 0.6 },
                          ]}
                        >
                          <Text style={styles.btnTxtLight}>Ablehnen</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  badgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTitle: { color: TXT, fontWeight: "900", fontSize: 14 },
  bannerSub: { color: TXT_DIM, marginTop: 2, fontSize: 12 },

  countPill: {
    minWidth: 34,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { color: "#0b0b0b", fontWeight: "900", fontSize: 12 },

  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxHeight: "75%",
    backgroundColor: "#101010",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { color: TXT, fontWeight: "900", fontSize: 16 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: BORDER,
  },

  reqRow: {
    backgroundColor: "#0f0f0f",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#222", marginRight: 10 },
  reqName: { color: TXT, fontWeight: "900" },
  reqMeta: { color: TXT_DIM, marginTop: 2, fontSize: 12 },

  reqActions: { flexDirection: "row", gap: 8 },
  btn: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnAccept: { backgroundColor: ACCENT, borderColor: ACCENT },
  btnDecline: { backgroundColor: "#171717", borderColor: BORDER },
  btnTxtDark: { color: "#0b0b0b", fontWeight: "900", fontSize: 12 },
  btnTxtLight: { color: TXT, fontWeight: "900", fontSize: 12 },
});

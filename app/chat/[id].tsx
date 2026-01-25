// app/chat/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// Schlanker Keyboard-Avoider (eigene Komponente)
import KeyboardAvoider from "./keyboardavoider";

/* Add-ons */
import { CameraModal } from "./camera"; // ✅ Named Import (wichtig!)
import EmojiBar from "./emojibar";
import { Media, MediaBubble, pickOneMedia } from "./media";
import OptionsMenu from "./optionmenu";
import SwipeableMessage from "./swipeablemessage";
import { VoiceBubble, type VoiceNote } from "./voicemessage";

/* Voice Speicher/Upload */
import { useVoiceMessage, type StoredVoiceMsg } from "./usevoicemessage";

/* Typ nur für den onCaptured-Callback (aus camera.tsx) */
import type { Media as CameraMedia } from "./camera";

const API = "http://192.168.0.224:5000";

/* ───────────── Types ───────────── */
type ServerMsg = {
  id: string;
  chatId: string;
  fromId: string;
  toId: string;
  text?: string;
  timestamp: string;
  read?: boolean;
  media?: Media;
  voice?: VoiceNote;
  replyToId?: string | null;
};

type ReplySnapshot =
  | { kind: "text"; text: string }
  | { kind: "media" }
  | { kind: "voice" };

type Msg = {
  id: string;
  text: string;
  sender: "me" | "other";
  read: boolean;
  reaction: string | null;
  media?: Media;
  voice?: VoiceNote;
  replyToId?: string | null;
  createdAt?: string;

  _localVoice?: {
    status: "pending" | "uploading" | "sent" | "error";
    storedId: string;
    remoteUrl?: string;
    createdAtMs: number;
    error?: string | null;
  };
  _replySnapshot?: ReplySnapshot | null;
};

type BubbleLayout = { x: number; y: number; w: number; h: number; sender: "me" | "other" };

/* ───────────── UI Consts ───────────── */
const PAD_H = 14;
const PAD_TOP = 8;
const EMOJI_BAR_H = 36;
const LOCK_THRESHOLD_X = 40;

const msToClock = (ms: number) => {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};
const excerpt = (t: string, n = 80) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

// gleiche Chat-ID wie am Server
const getChatId = (a: string, b: string) => [a, b].sort().join("-");

// wandelt ServerMsg → Msg für UI
const asMsg = (m: ServerMsg, meId: string): Msg => ({
  id: String(m.id),
  text: m.text || "",
  sender: m.fromId === meId ? "me" : "other",
  read: !!m.read,
  reaction: null,
  media: m.media,
  voice: m.voice,
  replyToId: m.replyToId ?? null,
  createdAt: m.timestamp,
});

export default function ChatRoom() {
  const router = useRouter();
  const { id: rawPartnerId, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Msg>>(null);

  // ✅ ROUTE-ID BEREINIGEN (fix für "...-index")
  const partner = useMemo(() => {
    const s = String(rawPartnerId || "");
    // entferne gängige Artefakte
    return s.replace(/-index$/i, "").replace(/^id:/i, "");
  }, [rawPartnerId]);

  // layout/heights
  const [headerH, setHeaderH] = useState(56);
  const [composerH, setComposerH] = useState(46);

  // identities
  const [meId, setMeId] = useState<string | null>(null);

  // thread state
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const hasText = useMemo(() => input.trim().length > 0, [input]);

  // reply + emoji
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [showEmojiFor, setShowEmojiFor] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [bubbleLayouts, setBubbleLayouts] = useState<Record<string, BubbleLayout>>({});
  const [scrollY, setScrollY] = useState(0);

  // options
  const [showOptions, setShowOptions] = useState(false);

  // voice (UI gespiegelt vom Hook)
  const [recOn, setRecOn] = useState(false);
  const [recLocked, setRecLocked] = useState(false);
  const [recMs, setRecMs] = useState(0);

  // Kamera-Modal
  const [camOpen, setCamOpen] = useState(false);
  const [camMode, setCamMode] = useState<"photo" | "video">("photo");

  // Polling-Timer
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 🔒 Privacy State (Instagram-Like)
  const [privacyLoading, setPrivacyLoading] = useState(true);
  const [partnerPrivate, setPartnerPrivate] = useState(false);
  const [following, setFollowing] = useState(true); // default: true, damit Chat nicht “aus Versehen” blockiert
  const isLocked = useMemo(() => partnerPrivate && !following, [partnerPrivate, following]);

  // mic animation
  const micScale = useRef(new Animated.Value(1)).current;
  const animateMicIn = () =>
    Animated.timing(micScale, { toValue: 1.5, duration: 150, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  const animateMicOut = () =>
    Animated.timing(micScale, { toValue: 1, duration: 150, easing: Easing.in(Easing.ease), useNativeDriver: true }).start();

  // pan for lock
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => recOn,
      onMoveShouldSetPanResponder: (_e, g) => recOn && Math.abs(g.dx) > 8,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_evt, g) => {
        if (recOn && !recLocked && g.dx < -LOCK_THRESHOLD_X) setRecLocked(true);
      },
      onPanResponderRelease: () => {
        if (recOn && !recLocked) stopAndSendVoice();
      },
      onPanResponderTerminate: () => {
        if (recOn && !recLocked) stopAndSendVoice();
      },
    })
  ).current;

  /* ───────────── API helpers ───────────── */
  const loadMe = useCallback(async (): Promise<string | null> => {
    try {
      const raw = await AsyncStorage.getItem("user");
      const u = raw ? JSON.parse(raw) : null;
      const id = u?.id ? String(u.id) : null;
      setMeId(id);
      return id;
    } catch {
      setMeId(null);
      return null;
    }
  }, []);

  // 🔒 Privacy Loader (Instagram-Like)
  const loadPrivacy = useCallback(
    async (mid?: string | null, pid?: string | null) => {
      if (!mid || !pid) return;
      setPrivacyLoading(true);

      try {
        // 1) isPrivate vom Partner holen
        // Erwartet: { isPrivate: boolean }
        const r1 = await fetch(`${API}/users/${encodeURIComponent(pid)}/privacy`);
        if (r1.ok) {
          const j1 = (await r1.json()) as { isPrivate?: boolean };
          setPartnerPrivate(!!j1?.isPrivate);
        } else {
          // falls Endpoint noch nicht existiert -> NICHT blockieren
          setPartnerPrivate(false);
        }
      } catch {
        setPartnerPrivate(false);
      }

      try {
        // 2) Follow-Status holen
        // Erwartet: { following: boolean }
        const r2 = await fetch(
          `${API}/follow/status?fromId=${encodeURIComponent(mid)}&toId=${encodeURIComponent(pid)}`
        );
        if (r2.ok) {
          const j2 = (await r2.json()) as { following?: boolean };
          setFollowing(!!j2?.following);
        } else {
          // falls Endpoint noch nicht existiert -> NICHT blockieren
          setFollowing(true);
        }
      } catch {
        setFollowing(true);
      } finally {
        setPrivacyLoading(false);
      }
    },
    []
  );

  const markAllRead = useCallback(async (_mid: string, _pid: string, list: ServerMsg[]) => {
    try {
      const myIncoming = list.filter((m) => m.toId === _mid && !m.read);
      await Promise.all(
        myIncoming.map((m) =>
          fetch(`${API}/messages/read`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId: m.id, userId: _mid }),
          })
        )
      );
    } catch {}
  }, []);

  const fetchThread = useCallback(
    async (mid?: string | null, pid?: string | null) => {
      if (!mid || !pid) return;

      // 🔒 Wenn locked: keine Messages laden/zeigen
      if (partnerPrivate && !following) {
        setMessages([]);
        return;
      }

      const chatId = getChatId(mid, pid);
      const res = await fetch(`${API}/messages/${encodeURIComponent(chatId)}`);
      const json = (await res.json()) as { messages: ServerMsg[] };
      const arr = json?.messages || [];
      setMessages(arr.map((m) => asMsg(m, mid)));
      void markAllRead(mid, pid, arr);
    },
    [markAllRead, partnerPrivate, following]
  );

  const sendToServer = useCallback(
    async (payload: Partial<ServerMsg> & { fromId: string; toId: string }) => {
      try {
        // 🔒 Sicherheits-Guard: wenn locked, gar nicht senden
        if (partnerPrivate && !following) return;

        const res = await fetch(`${API}/messages/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        await res.json();
        await fetchThread(payload.fromId, payload.toId);
      } catch {
        /* optimistische Bubble bleibt stehen */
      }
    },
    [fetchThread, partnerPrivate, following]
  );

  /* ───────────── Bootstrap + Polling ───────────── */
  const bootstrap = useCallback(async () => {
    const mid = (await loadMe()) || meId;
    if (!mid || !partner || mid === partner) return;

    // 🔒 zuerst Privacy laden, dann ggf. Thread
    await loadPrivacy(mid, partner);
    await fetchThread(mid, partner);
  }, [loadMe, meId, partner, fetchThread, loadPrivacy]);

  useEffect(() => {
    (async () => {
      await bootstrap();
    })();
  }, [bootstrap]);

  // 🔒 Polling nur wenn nicht locked
  useEffect(() => {
    if (!meId || !partner || meId === partner) return;
    if (privacyLoading) return;
    if (isLocked) return;

    pollingRef.current = setInterval(async () => {
      try {
        await fetchThread(meId, partner);
      } catch {}
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [meId, partner, fetchThread, isLocked, privacyLoading]);

  /* ───────────── Scroll-to-end Verhalten ───────────── */
  useEffect(() => {
    const s = Keyboard.addListener("keyboardDidShow", () =>
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
    );
    const c = Keyboard.addListener("keyboardDidChangeFrame", () =>
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }))
    );
    return () => {
      s.remove();
      c.remove();
    };
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
  }, [messages.length]);

  /* ───────────── Voice Hook ───────────── */
  const threadChatId = useMemo(() => (meId && partner ? getChatId(meId, String(partner)) : ""), [meId, partner]);
  const vm = useVoiceMessage(threadChatId, meId ?? "", String(partner));

  // Recorder-UI spiegeln
  useEffect(() => {
    setRecOn(vm.recording);
    setRecMs(vm.recordingTimeMs);
  }, [vm.recording, vm.recordingTimeMs]);

  // StoredVoiceMsg → Msg
  const mapStoredVoiceToMsg = useCallback(
    (m: StoredVoiceMsg): Msg => ({
      id: `v:${m.id}`,
      text: "",
      sender: m.senderId === (meId ?? "") ? "me" : "other",
      read: true,
      reaction: reactions[`v:${m.id}`] ?? null,
      voice: {
        uri: m.remoteUrl || m.localUri,
        durationMs: m.durationMs,
        waveform: m.waveform,
      },
      replyToId: null,
      createdAt: new Date(m.createdAt).toISOString(),
      _localVoice: {
        status: m.status,
        storedId: m.id,
        remoteUrl: m.remoteUrl,
        createdAtMs: m.createdAt,
        error: m.error ?? null,
      },
    }),
    [meId, reactions]
  );

  // 1) Map der Server-Voice-URLs → doppelte lokale „sent“ unterdrücken
  const serverVoiceUrls = useMemo(() => {
    const s = new Set<string>();
    for (const m of messages) {
      const u = m.voice?.uri;
      if (u && /^https?:\/\//i.test(u)) s.add(u);
    }
    return s;
  }, [messages]);

  // 2) Lokale Voices (ohne Duplikate)
  const localVoiceMsgs = useMemo(() => {
    return vm.messages
      .filter((m) => !(m.status === "sent" && m.remoteUrl && serverVoiceUrls.has(m.remoteUrl)))
      .map(mapStoredVoiceToMsg);
  }, [vm.messages, serverVoiceUrls, mapStoredVoiceToMsg]);

  // 3) Zusammenführen + sortieren
  const combinedMessages: Msg[] = useMemo(() => {
    // 🔒 Wenn locked: absolut nichts anzeigen
    if (partnerPrivate && !following) return [];
    const all = [...messages, ...localVoiceMsgs];
    return all.sort((a, b) => {
      const ta = a._localVoice?.createdAtMs ?? (a.createdAt ? Date.parse(a.createdAt) : 0);
      const tb = b._localVoice?.createdAtMs ?? (b.createdAt ? Date.parse(b.createdAt) : 0);
      return ta - tb;
    });
  }, [messages, localVoiceMsgs, partnerPrivate, following]);

  /* ===== Helpers (nach combinedMessages!) ===== */
  const buildReplySnapshot = useCallback(
    (mid: string | null): ReplySnapshot | null => {
      if (!mid) return null;
      const target = combinedMessages.find((m) => m.id === mid);
      if (!target) return null;
      if (target.media) return { kind: "media" };
      if (target.voice) return { kind: "voice" };
      const t = (target.text || "").trim();
      return { kind: "text", text: t ? excerpt(t, 80) : "Nachricht" };
    },
    [combinedMessages]
  );

  /* ───────────── Message helpers ───────────── */
  const appendMediaMessage = (media: Media) => {
    if (!meId || !partner) return;
    if (partnerPrivate && !following) return;

    const optimistic: Msg = {
      id: `${Date.now()}`,
      text: "",
      sender: "me",
      read: true,
      reaction: null,
      media,
      replyToId,
      _replySnapshot: buildReplySnapshot(replyToId),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setReplyToId(null);
    const payloadReply = replyToId && !replyToId.startsWith("v:") ? replyToId : undefined;
    void sendToServer({ fromId: meId, toId: partner, media, replyToId: payloadReply });
  };

  const appendVoiceMessage = (note: VoiceNote) => {
    if (!meId || !partner) return;
    if (partnerPrivate && !following) return;

    const optimistic: Msg = {
      id: `${Date.now()}`,
      text: "",
      sender: "me",
      read: true,
      reaction: null,
      voice: note,
      replyToId,
      _replySnapshot: buildReplySnapshot(replyToId),
      createdAt: new Date().toISOString(),
    };
    setMessages((p) => [...p, optimistic]);
    setReplyToId(null);
    const payloadReply = replyToId && !replyToId.startsWith("v:") ? replyToId : undefined;
    void sendToServer({ fromId: meId, toId: partner, voice: note, replyToId: payloadReply });
  };

  /** 🔧 Text senden */
  const sendMessage = () => {
    if (!meId || !partner) return;
    if (partnerPrivate && !following) return;

    const txt = input.trim();
    if (!txt) return;

    const optimistic: Msg = {
      id: `${Date.now()}`,
      text: txt,
      sender: "me",
      read: true,
      reaction: null,
      replyToId,
      _replySnapshot: buildReplySnapshot(replyToId),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setShowEmojiFor(null);

    const replyIdLocal = replyToId;
    setReplyToId(null);
    const payloadReply = replyIdLocal && !replyIdLocal.startsWith("v:") ? replyIdLocal : undefined;

    void sendToServer({ fromId: meId, toId: partner, text: txt, replyToId: payloadReply });
  };

  // Galerie
  const pickMedia = async () => {
    try {
      if (partnerPrivate && !following) return;
      const media = await pickOneMedia();
      if (media) appendMediaMessage(media);
    } catch {}
  };

  // Kamera → öffnet CameraModal
  const openCameraModal = (mode: "photo" | "video") => {
    if (partnerPrivate && !following) return;
    setCamMode(mode);
    setCamOpen(true);
  };

  const chooseCameraMode = () => {
    if (partnerPrivate && !following) return;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Abbrechen", "Foto aufnehmen", "Video aufnehmen"], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) openCameraModal("photo");
          else if (idx === 2) openCameraModal("video");
        }
      );
    } else {
      Alert.alert("Kamera", "Was möchtest du aufnehmen?", [
        { text: "Foto", onPress: () => openCameraModal("photo") },
        { text: "Video", onPress: () => openCameraModal("video") },
        { text: "Abbrechen", style: "cancel" },
      ]);
    }
  };

  // Emoji-Reaktionen
  const handlePickEmoji = (emoji: string) => {
    if (!showEmojiFor) return;
    if (partnerPrivate && !following) return;

    setMessages((prev) => prev.map((m) => (m.id === showEmojiFor ? { ...m, reaction: emoji } : m)));
    setReactions((prev) => ({ ...prev, [showEmojiFor]: emoji }));
    (async () => {
      try {
        await fetch(`${API}/messages/react`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: showEmojiFor.replace(/^v:/, ""), emoji }),
        });
      } catch {}
    })();
    setShowEmojiFor(null);
  };

  // Löschen (Server + lokale Voice)
  const confirmDelete = (mid: string) => {
    if (partnerPrivate && !following) return;

    const localVoices = vm.messages.map(mapStoredVoiceToMsg);
    const item = [...messages, ...localVoices].find((m) => m.id === mid);

    Alert.alert("Nachricht löschen?", "Diese Nachricht wird entfernt.", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: async () => {
          if (item?._localVoice) {
            await vm.deleteMessage(item._localVoice.storedId).catch(() => {});
          } else {
            setMessages((prev) => prev.filter((m) => m.id !== mid));
            try {
              await fetch(`${API}/messages/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messageId: mid }),
              });
            } catch {}
          }
        },
      },
    ]);
  };

  const selectReply = (mid: string) => {
    if (partnerPrivate && !following) return;
    setReplyToId(mid);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  // voice – Start/Stop
  const startVoice = async () => {
    try {
      if (partnerPrivate && !following) return;

      if (!threadChatId || !meId) {
        Alert.alert("Sprachmemo", "User-ID oder Chat-ID noch nicht geladen.");
        return;
      }
      if (vm.recording) return;
      await vm.startRecording();
      setRecLocked(false);
      animateMicIn();
    } catch (e: any) {
      Alert.alert("Sprachmemo", String(e?.message ?? e));
    }
  };

  const stopAndSendVoice = async () => {
    try {
      await vm.stopAndSave();
      setRecLocked(false);
      animateMicOut();
    } catch {
      setRecLocked(false);
      animateMicOut();
    }
  };

  /* ───────────── Render ───────────── */
  const renderItem = ({ item }: { item: Msg }) => {
    const isReplyMarked = replyToId === item.id;

    // Reply-Ziel; wenn nicht vorhanden, nutze Snapshot
    const replied = item.replyToId ? combinedMessages.find((m) => m.id === item.replyToId) : null;

    const effectiveReaction = item.reaction ?? reactions[item.id] ?? null;
    const isLocalVoice = !!item._localVoice;

    const renderQuote = () => {
      if (replied) {
        return (
          <View style={[styles.quoteBox, item.sender === "me" ? styles.quoteMe : styles.quoteOther]}>
            <View style={styles.quoteBar} />
            <Text style={styles.quoteText} numberOfLines={1}>
              {replied.media ? "📎 Medien" : replied.voice ? "🎙 Sprachmemo" : excerpt(replied.text || "Nachricht")}
            </Text>
          </View>
        );
      }
      if (item._replySnapshot) {
        return (
          <View style={[styles.quoteBox, item.sender === "me" ? styles.quoteMe : styles.quoteOther]}>
            <View style={styles.quoteBar} />
            <Text style={styles.quoteText} numberOfLines={1}>
              {item._replySnapshot.kind === "media"
                ? "📎 Medien"
                : item._replySnapshot.kind === "voice"
                ? "🎙 Sprachmemo"
                : item._replySnapshot.text || "Nachricht"}
            </Text>
          </View>
        );
      }
      return null;
    };

    return (
      <View
        onLayout={(e) => {
          const { x, y, width: w, height: h } = e.nativeEvent.layout;
          setBubbleLayouts((prev) => ({ ...prev, [item.id]: { x, y, w, h, sender: item.sender } }));
        }}
      >
        <SwipeableMessage onReply={() => selectReply(item.id)} onDelete={() => confirmDelete(item.id)}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              Keyboard.dismiss();
              setShowEmojiFor(null);
            }}
            onLongPress={() => {
              Keyboard.dismiss();
              setShowEmojiFor(item.id);
            }}
          >
            {/* Quote */}
            {renderQuote()}

            {/* Bubble */}
            <View
              style={[
                styles.bubble,
                item.sender === "me" ? styles.bubbleMe : styles.bubbleOther,
                isReplyMarked && styles.bubbleMarked,
                (item.media || item.voice) && styles.bubbleMedia,
              ]}
            >
              {item.media ? (
                <MediaBubble media={item.media} />
              ) : item.voice ? (
                <VoiceBubble note={item.voice} tint={item.sender === "me" ? "me" : "other"} />
              ) : (
                <Text style={styles.bubbleText}>{item.text}</Text>
              )}
            </View>

            {/* Reaktionen / gelesen / Upload-Status */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: item.sender === "me" ? "flex-end" : "flex-start",
                marginHorizontal: 4,
                marginTop: 2,
                gap: 6,
                alignItems: "center",
              }}
            >
              {effectiveReaction && (
                <View style={styles.reactionPill}>
                  <Text style={{ fontSize: 12 }}>{effectiveReaction}</Text>
                </View>
              )}
              {item.sender === "me" && item.read && !isLocalVoice && <Text style={{ color: "#777", fontSize: 11 }}>✓✓ gelesen</Text>}

              {isLocalVoice && (
                <>
                  {item._localVoice?.status === "pending" && <Text style={{ color: "#aaa", fontSize: 11 }}>Wartet auf Upload…</Text>}
                  {item._localVoice?.status === "uploading" && <Text style={{ color: "#aaa", fontSize: 11 }}>Wird hochgeladen…</Text>}
                  {item._localVoice?.status === "error" && (
                    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                      <Text style={{ color: "#ff7a7a", fontSize: 11 }}>
                        Upload-Fehler{item._localVoice?.error ? `: ${item._localVoice?.error}` : ""}
                      </Text>
                      <TouchableOpacity onPress={() => vm.resend(item._localVoice!.storedId)}>
                        <Text style={{ color: "#fff", fontSize: 12 }}>Erneut senden</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => vm.deleteMessage(item._localVoice!.storedId)}>
                        <Text style={{ color: "#ff7a7a", fontSize: 12 }}>Löschen</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {item._localVoice?.status === "sent" && <Text style={{ color: "#777", fontSize: 11 }}>✓✓ gesendet</Text>}
                </>
              )}
            </View>
          </TouchableOpacity>
        </SwipeableMessage>
      </View>
    );
  };

  // Emoji-Bar overlay
  const emojiOverlay = (() => {
    if (!showEmojiFor) return null;
    const lay = bubbleLayouts[showEmojiFor];
    if (!lay) return null;

    const bubbleTopOnScreen = insets.top + headerH + PAD_TOP + lay.y - scrollY;
    const top = Math.max(insets.top + 8, bubbleTopOnScreen - EMOJI_BAR_H - 6);

    return (
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View
          style={{
            position: "absolute",
            top,
            left: PAD_H,
            right: PAD_H,
            alignItems: lay.sender === "me" ? "flex-end" : "flex-start",
          }}
        >
          <EmojiBar onSelect={handlePickEmoji} />
        </View>
      </View>
    );
  })();

  // Reply preview (Composer)
  const replyPreview = (() => {
    if (!replyToId) return null;
    const m = combinedMessages.find((x) => x.id === replyToId);
    const snap = m
      ? m.media
        ? { kind: "media" as const }
        : m.voice
        ? { kind: "voice" as const }
        : { kind: "text" as const, text: excerpt(m.text || "Nachricht") }
      : null;
    return (
      <View style={styles.replyPreview}>
        <View style={styles.replyChipBar} />
        <Text style={styles.replyTitle}>Antwort an</Text>
        <Text style={styles.replyText} numberOfLines={1}>
          {snap ? (snap.kind === "media" ? "📎 Medien" : snap.kind === "voice" ? "🎙 Sprachmemo" : snap.text || "Nachricht") : "Nachricht"}
        </Text>
        <TouchableOpacity onPress={() => setReplyToId(null)} style={styles.replyClose}>
          <Ionicons name="close" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  })();

  const goBack = () => {
    Keyboard.dismiss();
    router.back();
  };

  // 🔒 Follow Button
  const followNow = async () => {
    if (!meId || !partner) return;
    try {
      const res = await fetch(`${API}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromId: meId, toId: partner }),
      });

      if (!res.ok) {
        // wenn dein Server "Request sent" statt direct follow macht, kannst du hier text ändern
        Alert.alert("Folgen", "Konnte nicht folgen. Prüfe deinen Server.");
        return;
      }

      // Direkt freischalten wie Insta (oder: Request gesendet)
      setFollowing(true);
      setPrivacyLoading(false);

      // Danach Thread laden
      await fetchThread(meId, partner);
    } catch {
      Alert.alert("Folgen", "Netzwerkfehler.");
    }
  };

  // 🔒 Locked Screen (Instagram-Like)
  const lockedScreen = (
    <View style={styles.lockWrap}>
      <View style={styles.lockCard}>
        <View style={styles.lockIcon}>
          <Ionicons name="lock-closed" size={22} color="#fff" />
        </View>
        <Text style={styles.lockTitle}>Dieser Account ist privat</Text>
        <Text style={styles.lockText}>
          Folge @{name || partner}, um Nachrichten und Inhalte zu sehen.
        </Text>

        <View style={{ height: 12 }} />

        <TouchableOpacity onPress={followNow} style={styles.followBtn} activeOpacity={0.9}>
          <Text style={styles.followBtnText}>Folgen</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={async () => {
            if (!meId || !partner) return;
            await loadPrivacy(meId, partner);
            await fetchThread(meId, partner);
          }}
          style={styles.refreshBtn}
          activeOpacity={0.85}
        >
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={styles.refreshText}>Aktualisieren</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      {/* Schlauer Avoider reduziert den Abstand zur Tastatur */}
      <KeyboardAvoider>
        <View style={styles.flex}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 6 }]} onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={goBack} style={{ padding: 6 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.chatName}>@{name || partner}</Text>
            </View>

            <TouchableOpacity onPress={() => setShowOptions((v) => !v)} style={{ padding: 6 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Privacy Loading */}
          {privacyLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Lade…</Text>
            </View>
          ) : isLocked ? (
            // 🔒 Wenn privat + nicht folgen: NICHTS sehen wie Instagram
            lockedScreen
          ) : (
            <>
              {/* Liste */}
              <FlatList
                ref={listRef}
                data={combinedMessages}
                keyExtractor={(it) => it.id}
                renderItem={renderItem}
                contentContainerStyle={{
                  paddingHorizontal: PAD_H,
                  paddingTop: PAD_TOP,
                  paddingBottom: composerH + (replyToId ? 44 : 0) + Math.max(insets.bottom, 2),
                }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "on-drag" : "none"}
                onScrollBeginDrag={() => {
                  Keyboard.dismiss();
                  setShowEmojiFor(null);
                }}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                onLayout={() => requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }))}
                onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
                scrollEventThrottle={16}
                scrollEnabled={!recOn}
              />

              {/* Emoji-Overlay */}
              {emojiOverlay}

              {/* Reply-Preview */}
              {replyPreview}

              {/* Recording Banner */}
              {recOn && (
                <View style={styles.recordBanner}>
                  <View className="dot" style={styles.dot} />
                  <Text style={styles.recordText}>Aufnahme läuft…</Text>
                  <Text style={styles.recordTimer}>{msToClock(recMs)}</Text>
                  {recLocked && (
                    <TouchableOpacity onPress={stopAndSendVoice} style={styles.stopBtn}>
                      <Ionicons name="stop" size={16} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Options-Backdrop */}
              {showOptions && (
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                  <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowOptions(false)} />
                  <OptionsMenu input={input} setInput={setInput} onClose={() => setShowOptions(false)} />
                </View>
              )}

              {/* Composer */}
              <View style={styles.composer} onLayout={(e) => setComposerH(e.nativeEvent.layout.height)}>
                {/* Kamera */}
                <TouchableOpacity style={styles.iconCircle} onPress={() => openCameraModal("photo")} onLongPress={chooseCameraMode}>
                  <Ionicons name="camera-outline" size={18} color="#fff" />
                </TouchableOpacity>

                {/* Eingabe */}
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder={replyToId ? "Antwort schreiben…" : "Nachricht schreiben…"}
                    placeholderTextColor="#8a8a8a"
                    value={input}
                    onChangeText={setInput}
                    onFocus={() => {
                      setShowEmojiFor(null);
                      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
                    }}
                    onBlur={() => setShowEmojiFor(null)}
                    multiline
                    returnKeyType="send"
                    blurOnSubmit={false}
                    onSubmitEditing={() => hasText && sendMessage()}
                  />
                </View>

                {/* Galerie (nur wenn nicht recording) */}
                {!recOn && (
                  <TouchableOpacity style={styles.iconCircle} onPress={pickMedia}>
                    <Ionicons name="image-outline" size={18} color="#fff" />
                  </TouchableOpacity>
                )}

                {/* Mic / Senden */}
                {hasText ? (
                  <TouchableOpacity style={[styles.iconCircle, styles.sendBtn]} onPress={sendMessage}>
                    <Ionicons name="send" size={18} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.micWrap} {...pan.panHandlers}>
                    <Animated.View style={{ transform: [{ scale: micScale }] }}>
                      <TouchableOpacity
                        style={[styles.iconCircle, recOn ? styles.micActive : null]}
                        onPressIn={startVoice}
                        onPressOut={() => {
                          if (recOn && !recLocked) stopAndSendVoice();
                        }}
                        activeOpacity={0.9}
                      >
                        <Ionicons name="mic-outline" size={18} color="#fff" />
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </KeyboardAvoider>

      {/* Kamera-Modal (lädt selbst hoch & gibt http-URL zurück) */}
      {!privacyLoading && !isLocked && threadChatId ? (
        <CameraModal
          visible={camOpen}
          onClose={() => setCamOpen(false)}
          chatId={threadChatId}
          mode={camMode}
          onCaptured={(media: CameraMedia) => {
            // media.uri ist bereits öffentliche URL vom Server
            appendMediaMessage({
              uri: media.uri,
              kind: media.kind,
              width: media.width,
              height: media.height,
            });
          }}
          maxVideoSec={60}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0d0d" },
  flex: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 8,
    backgroundColor: "#0d0d0d",
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e1e",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  chatName: { color: "#fff", fontSize: 17, fontWeight: "600" },

  // Quote
  quoteBox: {
    maxWidth: "72%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
    marginBottom: 2,
    borderRadius: 12,
    backgroundColor: "#191919",
  },
  quoteMe: { alignSelf: "flex-end" },
  quoteOther: { alignSelf: "flex-start" },
  quoteBar: { width: 3, height: 16, borderRadius: 2, backgroundColor: "#6e56cf" },
  quoteText: { color: "#bbb", fontSize: 12 },

  // Bubble
  bubble: {
    maxWidth: "72%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginVertical: 4,
  },
  bubbleMe: { alignSelf: "flex-end", backgroundColor: "#ff4fd8", borderBottomRightRadius: 4 },
  bubbleOther: { alignSelf: "flex-start", backgroundColor: "#1a1a1a", borderBottomLeftRadius: 4 },
  bubbleMarked: {
    borderWidth: 2,
    borderColor: "#6e56cf",
    shadowColor: "#6e56cf",
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  bubbleText: { color: "#fff", fontSize: 14, lineHeight: 18 },

  // Media/Voice compact
  bubbleMedia: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: "transparent",
    maxWidth: "50%",
  },

  reactionPill: {
    backgroundColor: "#1f1f1f",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },

  // Reply preview
  replyPreview: {
    marginHorizontal: 14,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#161616",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  replyChipBar: { width: 3, height: 18, borderRadius: 2, backgroundColor: "#6e56cf" },
  replyTitle: { color: "#6e56cf", fontSize: 11 },
  replyText: { flex: 1, color: "#fff", fontSize: 12 },
  replyClose: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
  },

  // Composer
  composer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: "#1e1e1e",
    backgroundColor: "#0d0d0d",
    gap: 8,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: "#161616",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  input: { color: "#fff", fontSize: 15, lineHeight: 18, minHeight: 20 },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
  },
  sendBtn: { backgroundColor: "#ff4fd8" },

  // Voice UI
  micWrap: { alignItems: "center", justifyContent: "center" },
  micActive: {
    backgroundColor: "#ff4fd8",
    shadowColor: "#ff4fd8",
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },

  recordBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 14,
    marginBottom: 6,
    backgroundColor: "#161616",
    borderRadius: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff4d4d" },
  recordText: { color: "#ddd", fontSize: 12 },
  recordTimer: { color: "#fff", fontSize: 12, fontVariant: ["tabular-nums"] },
  stopBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ff4d4d",
    alignItems: "center",
    justifyContent: "center",
  },

  // 🔒 Privacy UI
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: "#aaa", fontSize: 12 },

  lockWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  lockCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#222",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  lockIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#1f1f1f",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  lockTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 6 },
  lockText: { color: "#aaa", fontSize: 12, textAlign: "center", lineHeight: 16 },

  followBtn: {
    width: "100%",
    backgroundColor: "#ff4fd8",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  followBtnText: { color: "#fff", fontWeight: "700" },

  refreshBtn: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#1f1f1f",
  },
  refreshText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});

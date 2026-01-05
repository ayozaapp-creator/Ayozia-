// app/chat/VideoRecorder.tsx
import { Audio, ResizeMode, Video } from "expo-av";
import { Camera, CameraView, type CameraType } from "expo-camera";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Datei + MIME aus URI ableiten */
function pickMeta(uri: string) {
  const clean = uri.split(/[?#]/)[0];
  const base = clean.substring(clean.lastIndexOf("/") + 1) || "";
  const ext = (base.split(".").pop() || "").toLowerCase();
  let name = base || `media_${Date.now()}`;
  let type = "application/octet-stream";
  if (ext === "mp4") type = "video/mp4";
  else if (ext === "mov") type = "video/quicktime";
  else if (ext === "jpg" || ext === "jpeg") type = "image/jpeg";
  else if (ext === "png") type = "image/png";
  if (!/\.[a-z0-9]+$/i.test(name)) name += type.startsWith("video/") ? ".mp4" : ".jpg";
  return { name, type };
}
async function ensureCam(): Promise<boolean> {
  try {
    const { status } = await Camera.requestCameraPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}
async function ensureMic(): Promise<boolean> {
  try {
    const { status } = await Camera.requestMicrophonePermissionsAsync();
    return status === "granted";
  } catch {
    return true;
  }
}
async function uploadToChat(localUri: string, chatId: string, wh?: { w?: number; h?: number }) {
const API = "http://192.168.0.224:5000";
  const { name, type } = pickMeta(localUri);
  const form = new FormData();
  form.append(
    "file",
    {
      // @ts-ignore RN FormData
      uri: localUri,
      name,
      type,
    } as any
  );
  if (wh?.w) form.append("width", String(wh.w));
  if (wh?.h) form.append("height", String(wh.h));
  const res = await fetch(`${API.replace(/\/+$/, "")}/chat/${encodeURIComponent(chatId)}/media`, {
    method: "POST",
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.url) throw new Error(json?.error || `Upload fehlgeschlagen (HTTP ${res.status})`);
  return json.url as string;
}

export type Media = { uri: string; kind: "image" | "video"; width?: number; height?: number };

type Props = {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  onCaptured: (m: Media) => void;
  maxVideoSec?: number;
  initialFacing?: CameraType; // "front" | "back"
};

export default function VideoRecorder({
  visible,
  onClose,
  chatId,
  onCaptured,
  maxVideoSec = 60,
  initialFacing = "back",
}: Props) {
  const insets = useSafeAreaInsets();
  const camRef = useRef<CameraView | null>(null);

  const [hasCam, setHasCam] = useState<boolean | null>(null);
  const [hasMic, setHasMic] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);

  const [facing, setFacing] = useState<CameraType>(initialFacing);
  const [torch, setTorch] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);

  const [preview, setPreview] = useState<Media | null>(null);

  useEffect(() => {
    (async () => {
      const okCam = await ensureCam();
      const okMic = await ensureMic();
      setHasCam(okCam);
      setHasMic(okMic);
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
    })();
  }, []);

  const startVideo = useCallback(async () => {
    const cam: any = camRef.current;
    if (!cam) return;
    setRecording(true);
    try {
      await cam.startRecording({
        maxDuration: maxVideoSec,
        onRecordingFinished: (res: any) => {
          setRecording(false);
          if (res?.uri) setPreview({ uri: res.uri, kind: "video" });
          else Alert.alert("Video", "Kein Video erhalten.");
        },
        onRecordingError: (err: any) => {
          setRecording(false);
          Alert.alert("Video fehlgeschlagen", String(err?.message ?? err));
        },
      });
    } catch (e: any) {
      setRecording(false);
      Alert.alert("Video fehlgeschlagen", String(e?.message ?? e));
    }
  }, [maxVideoSec]);

  const stopVideo = useCallback(async () => {
    const cam: any = camRef.current;
    try {
      await cam?.stopRecording?.();
    } catch {}
  }, []);

  const onPressShutter = useCallback(async () => {
    if (!ready || busy) return;
    if (!recording) await startVideo();
    else await stopVideo();
  }, [ready, busy, recording, startVideo, stopVideo]);

  const sendPreview = useCallback(async () => {
    if (!preview) return;
    try {
      setBusy(true);
      const url = await uploadToChat(preview.uri, chatId);
      onCaptured({ uri: url, kind: "video" });
      setPreview(null);
      setBusy(false);
      onClose();
    } catch (e: any) {
      setBusy(false);
      Alert.alert("Upload fehlgeschlagen", String(e?.message ?? e));
    }
  }, [preview, chatId, onCaptured, onClose]);

  if (!visible) return null;

  if (hasCam === false || hasMic === false) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.blockModal}>
          <Text style={styles.blockTitle}>Zugriff verweigert</Text>
          <Text style={styles.blockText}>Bitte erlaube Kamera & Mikrofon.</Text>
          <TouchableOpacity style={styles.blockBtn} onPress={onClose}>
            <Text style={styles.blockBtnText}>Okay</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (recording) stopVideo();
        onClose();
      }}
    >
      <View style={styles.root}>
        <CameraView
          ref={camRef}
          style={styles.camera}
          facing={facing}
          enableTorch={torch}
          ratio="16:9"
          onCameraReady={() => setReady(true)}
        />

        {/* Top-Bar */}
        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={() => {
              if (recording) stopVideo();
              onClose();
            }}
            style={styles.topBtn}
          >
            <Text style={styles.topBtnTxt}>✕</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setTorch(t => !t)} style={styles.topBtn}>
            <Text style={styles.topBtnTxt}>{torch ? "🔦Torch On" : "🔦Torch Off"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setFacing(f => (f === "back" ? "front" : "back"))} style={styles.topBtn}>
            <Text style={styles.topBtnTxt}>↺ Flip</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom-Bar */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom + 8, 24) }]}>
          <TouchableOpacity
            onPress={onPressShutter}
            style={[styles.shutter, recording && styles.shutterRec, (!ready || busy) && styles.shutterDisabled]}
            disabled={!ready || busy}
          >
            {busy ? (
              <ActivityIndicator />
            ) : recording ? (
              <View style={styles.stopSquare} />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </TouchableOpacity>

          {recording && (
            <View style={styles.recHint}>
              <View style={styles.dot} />
              <Text style={styles.recText}>REC … tippe erneut zum Stoppen</Text>
            </View>
          )}
        </View>

        {/* Preview */}
        {preview && (
          <View style={styles.previewOverlay}>
            <View style={[styles.previewCard, { paddingTop: Platform.OS === "ios" ? insets.top + 8 : 12 }]}>
              <View style={styles.previewMediaWrap}>
                <Video
                  source={{ uri: preview.uri }}
                  style={styles.previewMedia}
                  resizeMode={ResizeMode.CONTAIN}
                  useNativeControls
                  shouldPlay
                />
              </View>

              <View style={[styles.previewActions, { paddingBottom: Math.max(insets.bottom + 8, 12) }]}>
                <TouchableOpacity onPress={() => setPreview(null)} style={[styles.pillBtn, styles.pillCancel]}>
                  <Text style={styles.pillTxt}>Nochmal</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={sendPreview} style={[styles.pillBtn, styles.pillSend]} disabled={busy}>
                  <Text style={styles.pillTxt}>{busy ? "Sende…" : "Senden"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },

  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  topBtn: { padding: 8, backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 8 },
  topBtnTxt: { color: "#fff", fontSize: 16 },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  shutter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  shutterInner: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#fff" },
  shutterRec: { borderColor: "#ff4d4d" },
  shutterDisabled: { opacity: 0.5 },
  stopSquare: { width: 30, height: 30, borderRadius: 6, backgroundColor: "#ff4d4d" },

  recHint: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff4d4d" },
  recText: { color: "#fff", fontSize: 12 },

  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewCard: { width: "100%", height: "100%", justifyContent: "space-between" },
  previewMediaWrap: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 12 },
  previewMedia: { width: "100%", height: "100%" },
  previewActions: { flexDirection: "row", gap: 12, justifyContent: "center" },
  pillBtn: { minWidth: 120, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, alignItems: "center" },
  pillCancel: { backgroundColor: "#2a2a2a" },
  pillSend: { backgroundColor: "#ff4fd8" },
  pillTxt: { color: "#fff", fontWeight: "700" },

  blockModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center" },
  blockTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  blockText: { color: "#bbb", fontSize: 14, marginBottom: 16, paddingHorizontal: 24, textAlign: "center" },
  blockBtn: { backgroundColor: "#ff4fd8", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  blockBtnText: { color: "#fff", fontWeight: "700" },
});

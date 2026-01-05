// app/chat/camera.tsx
import { Audio, ResizeMode, Video } from "expo-av";
import { Camera, CameraView, type CameraType } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ────────────────────────────── */

export type Media = { uri: string; kind: "image" | "video"; width?: number; height?: number };
const API = "http://192.168.0.224:5000";


/** MIME/Dateiname aus URI ableiten (Foto/Video korrekt setzen) */
function pickMeta(uri: string) {
  const clean = uri.split(/[?#]/)[0];
  const base = clean.substring(clean.lastIndexOf("/") + 1);
  const ext = (base.split(".").pop() || "").toLowerCase();

  let name = base || `media_${Date.now()}`;
  let type = "application/octet-stream";

  if (ext === "jpg" || ext === "jpeg") type = "image/jpeg";
  else if (ext === "png") type = "image/png";
  else if (ext === "webp") type = "image/webp";
  else if (ext === "mp4") type = "video/mp4";
  else if (ext === "mov") type = "video/quicktime";

  if (!/\.[a-z0-9]+$/i.test(name)) {
    name += type.startsWith("image/") ? ".jpg" : ".mp4";
  }
  return { name, type };
}

/* Permissions */
async function ensureCam(): Promise<boolean> {
  try {
    const { status } = await Camera.requestCameraPermissionsAsync();
    return status === "granted";
  } catch {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === "granted";
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

/* Upload */
async function uploadToChat(localUri: string, chatId: string, wh?: { w?: number; h?: number }) {
  const { name, type } = pickMeta(localUri);

  const form = new FormData();
  form.append(
    "file",
    {
      uri: localUri,
      name,
      type,
    } as any
  );
  if (wh?.w) form.append("width", String(wh.w));
  if (wh?.h) form.append("height", String(wh.h));

  const res = await fetch(
    `${API.replace(/\/+$/, "")}/chat/${encodeURIComponent(chatId)}/media`,
    { method: "POST", body: form }
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.url) {
    throw new Error(json?.error || `Upload fehlgeschlagen (HTTP ${res.status})`);
  }
  return json.url as string;
}

/* ────────────────────────────── */

type Props = {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  onCaptured: (m: Media) => void;
  mode?: "photo" | "video";
  maxVideoSec?: number;
};

/** Named Export → import { CameraModal } from "./camera" */
export function CameraModal({
  visible,
  onClose,
  chatId,
  onCaptured,
  mode = "photo",
  maxVideoSec = 60,
}: Props) {
  const insets = useSafeAreaInsets();
  const camRef = useRef<CameraView | null>(null);

  const [hasCam, setHasCam] = useState(false);
  const [hasMic, setHasMic] = useState(false);
  const [ready, setReady] = useState(false);

  const [currMode, setCurrMode] = useState<"photo" | "video">(mode);
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<"off" | "auto" | "on" | "torch">("off");

  const [recording, setRecording] = useState(false);

  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Media | null>(null);

  useEffect(() => {
    (async () => {
      const c = await ensureCam();
      const m = await ensureMic();
      setHasCam(c);
      setHasMic(m);
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
    })();
  }, []);

  const torch = flash === "torch";
  const camFlash: "off" | "auto" | "on" = torch ? "off" : flash;

  /* Foto */
  const takePhoto = useCallback(async () => {
    const cam: any = camRef.current;
    if (!cam) throw new Error("Kamera nicht bereit");

    const raw =
      typeof cam.takePhotoAsync === "function"
        ? await cam.takePhotoAsync({ quality: 0.9, skipProcessing: false })
        : await cam.takePictureAsync?.({ quality: 0.9, skipProcessing: false });

    if (!raw?.uri) throw new Error("Kein Foto erhalten");

    // Selfie-Mirror Fix: Frontkamera → horizontal spiegeln
    let fixed = raw.uri as string;
    try {
      if (facing === "front") {
        const edited = await ImageManipulator.manipulateAsync(
          raw.uri,
          [{ flip: ImageManipulator.FlipType.Horizontal }],
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
        );
        fixed = edited.uri;
      }
    } catch {}

    setPreview({ uri: fixed, kind: "image", width: raw.width, height: raw.height });
  }, [facing]);

  /* Video */
  const startVideo = useCallback(async () => {
    const cam: any = camRef.current;
    if (!cam) throw new Error("Kamera nicht bereit");

    // Fallback, wenn startRecording fehlt
    if (typeof cam.startRecording !== "function") {
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.7,
        videoMaxDuration: maxVideoSec,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        setPreview({ uri: res.assets[0].uri, kind: "video" });
      }
      return;
    }

    setRecording(true);
    await cam.startRecording({
      maxDuration: maxVideoSec,
      onRecordingFinished: (res: any) => {
        setRecording(false);
        if (res?.uri) setPreview({ uri: res.uri, kind: "video" });
      },
      onRecordingError: (err: any) => {
        setRecording(false);
        Alert.alert("Video fehlgeschlagen", String(err?.message ?? err));
      },
    });
  }, [maxVideoSec]);

  const stopVideo = useCallback(async () => {
    const cam: any = camRef.current;
    try {
      await cam?.stopRecording?.();
    } catch {}
  }, []);

  const onPressShutter = useCallback(async () => {
    if (!ready || busy) return;
    try {
      if (currMode === "photo") {
        setBusy(true);
        await takePhoto();
        setBusy(false);
      } else {
        if (!recording) {
          await startVideo();
        } else {
          await stopVideo();
        }
      }
    } catch (e: any) {
      Alert.alert(currMode === "photo" ? "Foto fehlgeschlagen" : "Video fehlgeschlagen", String(e?.message ?? e));
      setBusy(false);
      setRecording(false);
    }
  }, [ready, busy, currMode, recording, takePhoto, startVideo, stopVideo]);

  /* Preview → Senden */
  const sendPreview = useCallback(async () => {
    if (!preview) return;
    try {
      setBusy(true);
      const url = await uploadToChat(preview.uri, chatId, { w: preview.width, h: preview.height });
      onCaptured({ uri: url, kind: preview.kind, width: preview.width, height: preview.height });
      setPreview(null);
      setBusy(false);
      onClose();
    } catch (e: any) {
      setBusy(false);
      Alert.alert("Upload fehlgeschlagen", String(e?.message ?? e));
    }
  }, [preview, chatId, onCaptured, onClose]);

  if (!visible) return null;

  if (!hasCam || (currMode === "video" && !hasMic)) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.blockModal}>
          <Text style={styles.blockTitle}>Zugriff verweigert</Text>
          <Text style={styles.blockText}>Bitte erlaube Kamera{currMode === "video" ? " & Mikrofon" : ""}.</Text>
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
          flash={camFlash}
          enableTorch={torch}
          ratio="16:9"
          onCameraReady={() => setReady(true)}
        />

        {/* Top bar */}
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

          <TouchableOpacity
            onPress={() =>
              setFlash((p) => (p === "off" ? "auto" : p === "auto" ? "on" : p === "on" ? "torch" : "off"))
            }
            style={styles.topBtn}
          >
            <Text style={styles.topBtnTxt}>
              {flash === "off" ? "⚡︎Off" : flash === "auto" ? "⚡︎Auto" : flash === "on" ? "⚡︎On" : "🔦Torch"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))} style={styles.topBtn}>
            <Text style={styles.topBtnTxt}>↺ Flip</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom bar */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom + 8, 24) }]}>
          <View style={styles.modeSwitch}>
            <TouchableOpacity
              disabled={recording}
              onPress={() => setCurrMode("photo")}
              style={[styles.modeBtn, currMode === "photo" && styles.modeBtnActive, recording && { opacity: 0.5 }]}
            >
              <Text style={[styles.modeTxt, currMode === "photo" && styles.modeTxtActive]}>Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCurrMode("video")} style={[styles.modeBtn, currMode === "video" && styles.modeBtnActive]}>
              <Text style={[styles.modeTxt, currMode === "video" && styles.modeTxtActive]}>Video</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={onPressShutter}
            style={[styles.shutter, recording && styles.shutterRec, (!ready || busy) && styles.shutterDisabled]}
            disabled={!ready || busy}
          >
            {busy && currMode === "photo" ? (
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
                {preview.kind === "video" ? (
                  <Video
                    source={{ uri: preview.uri }}
                    style={styles.previewMedia}
                    resizeMode={ResizeMode.CONTAIN}
                    useNativeControls
                    shouldPlay
                  />
                ) : (
                  <Image source={{ uri: preview.uri }} style={styles.previewMedia} resizeMode="contain" />
                )}
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

/* ── Styles ── */
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
  modeSwitch: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 6,
    borderRadius: 20,
  },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  modeBtnActive: { backgroundColor: "rgba(255,255,255,0.15)" },
  modeTxt: { color: "#bbb", fontSize: 14 },
  modeTxtActive: { color: "#fff", fontWeight: "600" },

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

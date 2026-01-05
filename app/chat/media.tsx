// app/chat/media.tsx
import { Video } from "expo-av";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import { Dimensions, Image, Modal, Pressable, StyleSheet, View } from "react-native";

import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from "react-native-reanimated";

/** Einheitlicher Medientyp für Chat */
export type Media = {
  uri: string;
  kind: "image" | "video";
  width?: number;
  height?: number;
  /** true = horizontal gespiegelt anzeigen (Selfie-Preview) */
  flipX?: boolean;
};

type UploadResponse = {
  url: string;
  kind: "image" | "video" | "unknown";
  width?: number;
  height?: number;
};

const API = "http://192.168.0.224:5000";

/* ---------- Helper ---------- */
function isFrontCameraExif(exif: Record<string, any> | null | undefined): boolean {
  if (!exif) return false;
  const v = (k: string) => String((exif as any)[k] ?? "").toLowerCase();
  return (
    v("LensFacing") === "front" ||
    v("CameraFacing") === "front" ||
    v("FacingMode") === "front" ||
    v("Camera") === "front" ||
    v("LensModel").includes("front") ||
    v("Model").includes("front") ||
    v("Make").includes("front")
  );
}

function guessNameAndType(localUri: string, kind: "image" | "video") {
  const q = localUri.split("?")[0].split("#")[0];
  const last = q.substring(q.lastIndexOf("/") + 1) || (kind === "image" ? "image.jpg" : "video.mp4");
  const lower = last.toLowerCase();
  const ext = lower.includes(".") ? lower.substring(lower.lastIndexOf(".") + 1) : kind === "image" ? "jpg" : "mp4";

  const mime =
    kind === "image"
      ? ext === "png"
        ? "image/png"
        : ext === "webp"
        ? "image/webp"
        : "image/jpeg"
      : ext === "mov"
      ? "video/quicktime"
      : "video/mp4";

  const name = lower.includes(".") ? last : `upload_${Date.now()}.${ext}`;
  return { name, mime };
}

/** Galerie öffnen → Bild als JPEG (HEIC→JPEG), optional Selfie ent-spiegeln, dann zum Server hochladen */
export async function pickOneMedia(opts?: {
  chatId?: string;
  apiBase?: string;
  quality?: number;
  unmirrorSelfies?: boolean; // nur Bilder
}): Promise<Media | null> {
  const quality = Math.min(Math.max(opts?.quality ?? 0.85, 0.1), 1);
  const unmirrorSelfies = opts?.unmirrorSelfies ?? true;

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== "granted") throw new Error("Zugriff auf Medienbibliothek verweigert");

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    quality,
    exif: true,
  });
  if (res.canceled) return null;

  const a = res.assets?.[0];
  if (!a) return null;

  const isVideo = a.type?.startsWith("video");
  let uploadUri = a.uri;
  let width = a.width;
  let height = a.height;

  // Bilder: immer als JPEG exportieren, optional Selfie ent-spiegeln
  if (!isVideo) {
    const doFlip = unmirrorSelfies && isFrontCameraExif(a.exif);
    const actions: ImageManipulator.Action[] = [{ rotate: 0 }];
    if (doFlip) actions.push({ flip: ImageManipulator.FlipType.Horizontal });

    const out = await ImageManipulator.manipulateAsync(uploadUri, actions, {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    uploadUri = out.uri;
  }

  // Upload zum Server (damit der Empfänger keine „dunkle“ lokale URI bekommt)
  const base = (opts?.apiBase || API).replace(/\/+$/, "");
  const chatId = encodeURIComponent(opts?.chatId || "misc");
  const endpoint = `${base}/chat/${chatId}/media`;

  const kind: "image" | "video" = isVideo ? "video" : "image";
  const { name, mime } = guessNameAndType(uploadUri, kind);

  const form = new FormData();
  form.append(
    "file",
    {
      // @ts-ignore – RN File
      uri: uploadUri,
      name,
      type: mime,
    } as any
  );
  if (width) form.append("width", String(width));
  if (height) form.append("height", String(height));

  const up = await fetch(endpoint, { method: "POST", body: form });
  if (!up.ok) {
    const t = await up.text().catch(() => "");
    throw new Error(`Media-Upload fehlgeschlagen (${up.status}): ${t || "Unknown error"}`);
  }
  const json = (await up.json()) as UploadResponse;

  return {
    uri: json.url,
    kind: json.kind === "video" ? "video" : "image",
    width: json.width ?? width,
    height: json.height ?? height,
    flipX: false,
  };
}

/* ---------- UI ---------- */
const BUBBLE_W = 260;
const MIN_H = 150;
const MAX_H = 360;

function calcBubbleSize(media: Media) {
  const w = BUBBLE_W;
  const ratio = media.width && media.height ? media.height / media.width : 1;
  const rawH = Math.round(w * ratio);
  const h = Math.max(MIN_H, Math.min(MAX_H, rawH || MIN_H));
  return { w, h };
}

function ZoomableViewer({ media, onClose }: { media: Media; onClose: () => void }) {
  const { width: SW, height: SH } = Dimensions.get("window");

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const bg = useSharedValue(0.95);

  const singleTap = Gesture.Tap().numberOfTaps(1).onEnd((_e, ok) => {
    if (ok) runOnJS(onClose)();
  });

  const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd((_e, ok) => {
    if (ok) {
      const next = scale.value > 1 ? 1 : 2.2;
      scale.value = withTiming(next, { duration: 160 });
      if (next === 1) {
        tx.value = withTiming(0, { duration: 160 });
        ty.value = withTiming(0, { duration: 160 });
      }
    }
  });

  const pan = Gesture.Pan()
    .onChange((e) => {
      tx.value += e.changeX;
      ty.value += e.changeY;
    })
    .onEnd((e) => {
      tx.value = withDecay({ velocity: e.velocityX, clamp: [-SW, SW] });
      ty.value = withDecay({ velocity: e.velocityY, clamp: [-SH, SH] });
    });

  const pinch = Gesture.Pinch()
    .onChange((e) => {
      scale.value *= e.scaleChange;
    })
    .onEnd(() => {
      if (scale.value < 1) scale.value = withTiming(1, { duration: 120 });
      if (scale.value > 4) scale.value = withTiming(4, { duration: 120 });
    });

  const composed = Gesture.Simultaneous(doubleTap, singleTap, pinch, pan);

  const mediaStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const backDrop = useAnimatedStyle(() => ({
    backgroundColor: `rgba(0,0,0,${bg.value})`,
  }));

  const content =
    media.kind === "video" ? (
      <Animated.View style={[styles.viewerMedia, mediaStyle]}>
        <Video
          source={{ uri: media.uri }}
          style={StyleSheet.absoluteFill}
          // @ts-ignore – strings funktionieren stabil ohne enum
          resizeMode="contain"
          useNativeControls
          shouldPlay
        />
      </Animated.View>
    ) : (
      // @ts-ignore Animated.Image + string resizeMode
      <Animated.Image source={{ uri: media.uri }} resizeMode="contain" style={[styles.viewerMedia, mediaStyle]} />
    );

  return (
    <Animated.View style={[styles.viewerBackdrop, backDrop]}>
      <GestureDetector gesture={composed}>
        <View style={styles.viewerCenter}>{content}</View>
      </GestureDetector>
    </Animated.View>
  );
}

export function MediaBubble({ media }: { media: Media }) {
  const [open, setOpen] = useState(false);
  const { w, h } = useMemo(() => calcBubbleSize(media), [media]);

  const flipStyle = media.flipX ? { transform: [{ scaleX: -1 }] } : undefined;

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[styles.wrap, { width: w, height: h }]}>
        {media.kind === "video" ? (
          <Video
            source={{ uri: media.uri }}
            style={[StyleSheet.absoluteFill, flipStyle]}
            // @ts-ignore
            resizeMode="cover"
            useNativeControls
          />
        ) : (
          <Image source={{ uri: media.uri }} style={[StyleSheet.absoluteFill, flipStyle]} resizeMode="cover" />
        )}
      </Pressable>

      <Modal visible={open} animationType="fade" onRequestClose={() => setOpen(false)} transparent>
        <ZoomableViewer media={media} onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#111",
  },
  viewerBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  viewerCenter: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerMedia: {
    width: "100%",
    height: "100%",
  },
});

export default MediaBubble;

// app/stories/camera.tsx
import { Ionicons } from "@expo/vector-icons";
import { Camera, CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const BG = "#000";
const TEXT = "#fff";
const TEXT_DIM = "#bdbdbd";
const ACCENT = "#ff4fd8";
const BORDER = "#1e1e1e";

// Camera type and flash mode constants
const CAMERA_TYPE = { back: "back", front: "front" } as const;
const CAMERA_FLASH = { off: "off", torch: "torch" } as const;

export default function StoryCameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const [cameraType, setCameraType] = useState<"back" | "front">("back");
  const [flash, setFlash] = useState<"off" | "torch">("off");
  const [zoom, setZoom] = useState(0); // 0..1

  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);

  // ───────────── Permissions ─────────────
  useEffect(() => {
    (async () => {
      try {
        const { status: camStatus } =
          await Camera.requestCameraPermissionsAsync();
        const { status: micStatus } =
          await Camera.requestMicrophonePermissionsAsync();

        if (camStatus === "granted" && micStatus === "granted") {
          setHasPermission(true);
        } else {
          setHasPermission(false);
        }
      } catch (e) {
        console.log("camera permission error", e);
        setHasPermission(false);
      }
    })();
  }, []);

  // ───────────── Double-Tap zum Wechseln ─────────────
  const lastTapRef = useRef<number>(0);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setCameraType((prev) =>
        prev === CAMERA_TYPE.back ? CAMERA_TYPE.front : CAMERA_TYPE.back
      );
    }
    lastTapRef.current = now;
  }, []);

  // ───────────── Swipe-Zoom (Snapchat-Style) ─────────────
  const panStartZoomRef = useRef(0);

  const clampZoom = (z: number) => {
    if (z < 0) return 0;
    if (z > 1) return 1;
    return z;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        panStartZoomRef.current = zoom;
      },
      onPanResponderMove: (_evt, gestureState) => {
        // nach oben => zoom +
        const delta = -gestureState.dy / 600; // 600px ~ 1.0 zoom
        const next = clampZoom(panStartZoomRef.current + delta);
        setZoom(next);
      },
      onPanResponderRelease: () => {},
      onPanResponderTerminate: () => {},
    })
  ).current;

  // ───────────── Foto aufnehmen ─────────────
  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || !isCameraReady || loading || isRecording) return;

    try {
      setLoading(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
        mirror: cameraType === CAMERA_TYPE.front,
      });

      if (!photo?.uri) {
        setLoading(false);
        return;
      }

      router.push({
        pathname: "/stories/upload",
        params: {
          uri: photo.uri,
          type: "photo",
        },
      });
    } catch (e) {
      console.log("takePhoto error", e);
    } finally {
      setLoading(false);
    }
  }, [cameraType, isCameraReady, loading, isRecording, router]);

  // ───────────── Video aufnehmen (Long-Press) ─────────────
  const startRecording = useCallback(() => {
    if (!cameraRef.current || !isCameraReady || loading || isRecording) {
      return;
    }

    console.log("startRecording …");
    setIsRecording(true);

    cameraRef.current.recordAsync().then((video) => {
      console.log("record finished", video?.uri);
      setIsRecording(false);

      if (!video?.uri) return;

      router.push({
        pathname: "/stories/upload",
        params: {
          uri: video.uri,
          type: "video",
        },
      });
    }).catch((error) => {
      console.log("record error", error);
      setIsRecording(false);
    });
  }, [isCameraReady, loading, isRecording, router]);

  const stopRecording = useCallback(() => {
    if (!cameraRef.current || !isRecording) return;
    try {
      console.log("stopRecording");
      cameraRef.current.stopRecording();
    } catch (e) {
      console.log("stopRecording error", e);
    }
  }, [isRecording]);

  // ───────────── UI Handler ─────────────
  const toggleFlash = () => {
    setFlash((prev) =>
      prev === CAMERA_FLASH.off ? CAMERA_FLASH.torch : CAMERA_FLASH.off
    );
  };

  // ───────────── Render ─────────────
  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator color={TEXT} size="large" />
          <Text style={styles.infoText}>Kamera wird vorbereitet…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.infoText}>
            Keine Berechtigung für Kamera/Mikrofon. Bitte in den
            Systemeinstellungen erlauben.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={16}>
          <Ionicons name="chevron-back" size={26} color={TEXT} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Kamera</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggleFlash} hitSlop={16}>
            <Ionicons
              name={
                flash === CAMERA_FLASH.off ? "flash-off-outline" : "flash-outline"
              }
              size={22}
              color={TEXT}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hinweisleiste */}
      <View style={styles.hintBar}>
        <Text style={styles.hintText}>
          Tipp: Doppelt tippen zum Wechseln · Nach oben wischen zum Zoomen
        </Text>
      </View>

      {/* Kamera-Preview */}
      <View style={styles.cameraOuter} {...panResponder.panHandlers}>
        <Pressable
          style={styles.cameraPressable}
          onPress={handleDoubleTap}
          android_ripple={undefined}
        >
          <CameraView
            ref={(ref) => {
              cameraRef.current = ref;
            }}
            style={StyleSheet.absoluteFill}
            facing={cameraType}
            enableTorch={flash === "torch"}
            zoom={zoom}
            ratio="16:9"
            mode="video" // wichtig für Recording
            onCameraReady={() => setIsCameraReady(true)}
          />
        </Pressable>
      </View>

      {/* Shutter + Bottom Controls */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: 12 + insets.bottom }, // höher wegen Notch / Home-Bar
        ]}
      >
        <View style={{ flex: 1 }} />

        {/* Shutter Button (Foto: Tap, Video: Long-Press) */}
        <Pressable
          style={styles.shutterOuter}
          onPress={takePhoto}
          onLongPress={startRecording}
          onPressOut={stopRecording}
        >
          <View
            style={[
              styles.shutterInner,
              isRecording && {
                backgroundColor: "#ff3b30",
                transform: [{ scale: 0.7 }],
              },
            ]}
          />
        </Pressable>

        <View style={styles.bottomRight}>
          <Ionicons
            name="camera-reverse-outline"
            size={22}
            color={TEXT_DIM}
          />
        </View>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={TEXT} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  infoText: {
    color: TEXT_DIM,
    textAlign: "center",
    marginTop: 10,
  },

  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "700",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },

  hintBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  hintText: {
    color: TEXT_DIM,
    fontSize: 12,
    textAlign: "center",
  },

  cameraOuter: {
    flex: 1,
    marginHorizontal: 0,
    marginTop: 4,
    borderRadius: 0,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  cameraPressable: {
    flex: 1,
  },

  bottomBar: {
    paddingTop: 10,
    paddingHorizontal: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  shutterOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  shutterInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#ffffff",
  },

  bottomRight: {
    flex: 1,
    alignItems: "flex-end",
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
});

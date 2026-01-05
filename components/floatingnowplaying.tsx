// components/floatingnowplaying.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import audio, { useAudioSnapshot } from "../server/lib/audiocontroller";

const INITIAL_BOTTOM = 84;          // Startposition über der BottomNavbar
const CLOSE_TRIGGER_Y = 40;         // wie weit nach unten ziehen zum Schließen

export default function FloatingNowPlaying() {
  // 1) Audio-Snapshot
  const { snapshot, subscribe } = useAudioSnapshot();
  const [snap, setSnap] = useState<any>(snapshot as any);
  const [isVisible, setIsVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // 2) Position & Close-Animation
  const translate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const closeScale = useRef(new Animated.Value(0)).current;

  // 3) Navigation
  const router = useRouter();

  // 4) Snapshot-Subscription
  useEffect(() => {
    const unsubscribe = subscribe(setSnap);
    return () => {
      // Ensure cleanup returns void (ignore boolean return from unsubscribe)
      unsubscribe();
    };
  }, [subscribe]);

  // 5) Wenn wieder ein Track läuft → Bubble automatisch wieder anzeigen
  useEffect(() => {
    if (snap?.current && snap?.isPlaying) {
      setIsVisible(true);
    }
  }, [snap?.current?.id, snap?.isPlaying]);

  const current = snap?.current ?? null;
  const isPlaying = !!snap?.isPlaying;

  // 👉 Stats aus dem aktuellen Track holen (verschiedene Feldnamen abgefangen)
  const plays =
    current?.stats?.plays ??
    current?.playCount ??
    current?.plays ??
    0;

  const likes =
    current?.stats?.likes ??
    current?.likesCount ??
    current?.likes ??
    0;

  // 6) Drag-Logik
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        setIsDragging(true);
        translate.setOffset({
          x: (translate as any).x._value,
          y: (translate as any).y._value,
        });
        translate.setValue({ x: 0, y: 0 });

        Animated.timing(closeScale, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      },

      onPanResponderMove: Animated.event(
        [null, { dx: translate.x, dy: translate.y }],
        { useNativeDriver: false }
      ),

      onPanResponderRelease: () => {
        setIsDragging(false);
        translate.flattenOffset();

        Animated.timing(closeScale, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();

        const anyVal: any = translate as any;
        const y =
          typeof anyVal.y?.__getValue === "function"
            ? anyVal.y.__getValue()
            : anyVal.__getValue
            ? anyVal.__getValue().y
            : 0;

        if (y > CLOSE_TRIGGER_Y) {
          setIsVisible(false);
          translate.setValue({ x: 0, y: 0 });
        }
      },

      onPanResponderTerminate: () => {
        setIsDragging(false);
        translate.flattenOffset();
        Animated.timing(closeScale, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Wenn kein Track oder versteckt → nichts rendern
  if (!current || !isVisible) {
    return null;
  }

  const title =
    current.title || current.name || "Unbenannter Track";
  const coverUri = current.cover || current.artwork || null;

  const handleTogglePlay = () => {
    audio.toggle(current);
  };

  const handleOpenPlayer = () => {
    router.push("/player");
  };

  return (
    <>
      {/* Close-Zone unten (X) */}
      {isDragging && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.closeZone,
            {
              transform: [
                {
                  scale: closeScale.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.7, 1],
                  }),
                },
              ],
              opacity: closeScale,
            },
          ]}
        >
          <View style={styles.closeCircle}>
            <Ionicons name="close" size={26} color="#fff" />
          </View>
          <Text style={styles.closeText}>
            Zum Schließen nach unten ziehen
          </Text>
        </Animated.View>
      )}

      {/* Bubble wie in deinem Screenshot – lange, schlanke Capsule */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.bubbleWrapper,
          { transform: translate.getTranslateTransform() },
        ]}
      >
        <View style={styles.bubbleGlow}>
          <View style={styles.bubbleBackground}>
            {/* Mitte: öffnet großen Player */}
            <TouchableOpacity
              style={styles.infoArea}
              activeOpacity={0.9}
              onPress={handleOpenPlayer}
            >
              <View style={styles.coverWrap}>
                {coverUri ? (
                  <Image
                    source={{ uri: coverUri }}
                    style={styles.cover}
                  />
                ) : (
                  <View style={styles.coverFallback}>
                    <Ionicons
                      name="musical-notes"
                      size={18}
                      color="#fff"
                    />
                  </View>
                )}
              </View>

              <View style={styles.textArea}>
                <Text numberOfLines={1} style={styles.title}>
                  {title}
                </Text>
                {/* 🔥 Hier zeigen wir jetzt Plays + Likes statt fixem Text */}
                <Text numberOfLines={1} style={styles.subtitle}>
                  {plays} Plays · {likes} Likes
                </Text>
              </View>
            </TouchableOpacity>

            {/* Rechts: Play / Pause */}
            <TouchableOpacity
              style={styles.playButton}
              activeOpacity={0.9}
              onPress={handleTogglePlay}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={20}
                color="#000"
              />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </>
  );
}

const PINK = "#ff2fb6";

const styles = StyleSheet.create({
  bubbleWrapper: {
    position: "absolute",
    bottom: INITIAL_BOTTOM,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 50,
  },
  // äußerer Glow-Ring
  bubbleGlow: {
    padding: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,47,182,0.16)",
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 8,
  },
  // innere Capsule (wie auf deinem Screenshot)
  bubbleBackground: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#050505",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: PINK,
    minWidth: 260,
    maxWidth: 340,
  },
  infoArea: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 8,
  },
  coverWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#222",
  },
  cover: {
    width: "100%",
    height: "100%",
  },
  coverFallback: {
    flex: 1,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  textArea: {
    flex: 1,
  },
  title: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  subtitle: {
    color: "#cccccc",
    fontSize: 11,
    marginTop: 1,
  },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PINK,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  closeZone: {
    position: "absolute",
    bottom: 42,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 40,
  },
  closeCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(0,0,0,0.9)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: PINK,
  },
  closeText: {
    marginTop: 4,
    color: "#ffffff",
    fontSize: 11,
  },
});

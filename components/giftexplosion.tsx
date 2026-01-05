// components/ayosa-gift.tsx
import { useEffect, useRef } from "react";
import {
    Animated,
    Easing,
    StyleSheet,
    View,
    ViewStyle
} from "react-native";

type AyosaGiftProps = {
  visible: boolean;
  onFinished?: () => void;
  style?: ViewStyle;
};

export default function AyosaGift({
  visible,
  onFinished,
  style,
}: AyosaGiftProps) {
  const horseTranslateY = useRef(new Animated.Value(40)).current;
  const horseScale = useRef(new Animated.Value(0.8)).current;
  const horseOpacity = useRef(new Animated.Value(0)).current;

  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    // Reset
    horseTranslateY.setValue(40);
    horseScale.setValue(0.8);
    horseOpacity.setValue(0);

    logoScale.setValue(0);
    logoOpacity.setValue(0);

    Animated.sequence([
      // 1) Pferd kommt rein + geht leicht nach oben
      Animated.parallel([
        Animated.timing(horseOpacity, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(horseScale, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
        Animated.timing(horseTranslateY, {
          toValue: -25,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      // 2) Logo-Explosion (riesiger Glow über fast der ganzen Seite)
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 80,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 3.2,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // 3) Alles ausfaden
      Animated.parallel([
        Animated.timing(horseOpacity, {
          toValue: 0,
          duration: 350,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 0,
          duration: 350,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      if (onFinished) onFinished();
    });
  }, [visible]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={[styles.container, style]}>
      {/* Pferdebild fullscreen */}
      <Animated.Image
        source={require("../assets/ayozahorse.png")}
        resizeMode="cover"
        style={[
          styles.image,
          {
            opacity: horseOpacity,
            transform: [
              { translateY: horseTranslateY },
              { scale: horseScale },
            ],
          },
        ]}
      />

      {/* Logo-Explosion – großer Glow-Kreis oben */}
      <Animated.View
        style={[
          styles.logoExplosion,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)", // dunkelt alles drunter ab
  },
  image: {
    width: "100%",
    height: "100%",
  },
  logoExplosion: {
    position: "absolute",
    top: "10%", // ungefähr dort, wo dein Logo sitzt
    alignSelf: "center",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255, 79, 216, 0.45)",
    shadowColor: "#ff4fd8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 50,
  },
});

// components/NotificationBell.tsx
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  unreadCount?: number;     // Anzahl ungelesener Benachrichtigungen
  onPress?: () => void;     // Klick-Handler
  size?: number;            // Icon-Größe
  color?: string;           // Icon-Farbe
  accent?: string;          // Glow-Farbe
};

export default function NotificationBell({
  unreadCount = 0,
  onPress,
  size = 24,
  color = "#fff",
  accent = "#ff4fd8",
}: Props) {
  const showGlow = unreadCount > 0;

  // Pulse-Animation (Skalierung + Opazität)
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!showGlow) {
      pulseScale.stopAnimation();
      pulseOpacity.stopAnimation();
      pulseScale.setValue(1);
      pulseOpacity.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.35,
            duration: 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.45,
            duration: 500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.12,
            duration: 1300,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [showGlow, pulseScale, pulseOpacity]);

  const badgeText = useMemo(() => {
    if (unreadCount <= 0) return "";
    if (unreadCount > 99) return "99+";
    return String(unreadCount);
  }, [unreadCount]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={styles.wrap}
    >
      {/* Glow-Ring */}
      {showGlow && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glowRing,
            {
              backgroundColor: accent,
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
              // iOS Shadow als zusätzlicher Leuchteffekt
              shadowColor: accent,
              shadowOpacity: 0.9,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 0 },
              // Android: etwas „fetteres“ Element, da es keinen weichen Shadow gibt
              ...(Platform.OS === "android" ? { borderWidth: 0 } : null),
            },
          ]}
        />
      )}

      {/* Glocken-Icon */}
      <Ionicons
        name={unreadCount > 0 ? "notifications" : "notifications-outline"}
        size={size}
        color={color}
      />

      {/* Badge */}
      {unreadCount > 0 && (
        <View style={[styles.badge, { borderColor: "#000", backgroundColor: accent }]}>
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const R = 18; // Basisradius für Glow-Kreis

const styles = StyleSheet.create({
  wrap: {
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  glowRing: {
    position: "absolute",
    width: R * 2,
    height: R * 2,
    borderRadius: R,
    zIndex: -1,
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
});

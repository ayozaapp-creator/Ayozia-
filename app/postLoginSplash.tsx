// app/postLoginSplash.tsx
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

export default function PostLoginSplash() {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();

    const timeout = setTimeout(() => {
      router.replace("/home"); // << Startseite
    }, 2000);

    return () => {
      loop.stop();
      clearTimeout(timeout);
    };
  }, [router, scale]);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require("../assets/ayozia_logo.png")}
        style={[styles.logo, { transform: [{ scale }] }]}
      />
      <Text style={styles.text}>
        Du bist vielleicht noch klein, aber irgendwann wirst du richtig groß.{"\n"}
        Hier beginnt dein Weg.{"\n"}
        Neue Sounds, neue Follower, echte Künstler.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0014", justifyContent: "center", alignItems: "center", padding: 20 },
  logo: { width: 100, height: 100, marginBottom: 40, resizeMode: "contain" },
  text: { color: "#fff", fontSize: 16, lineHeight: 24, textAlign: "center" },
});

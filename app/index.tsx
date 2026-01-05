// app/index.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  const router = useRouter();
  const [loadingText, setLoadingText] = useState("Ayozia lädt… Bitte warten ✨");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const go = async () => {
      try {
        // robust: akzeptiere sowohl "me" als auch "user"
        const raw = (await AsyncStorage.getItem("me")) ?? (await AsyncStorage.getItem("user"));
        const hasUser = !!raw && raw !== "null" && raw !== "undefined";

        setLoadingText(hasUser ? "Willkommen zurück 👋" : "Du wirst weitergeleitet…");

        // Kurzer Splash-Delay (fühlt sich smoother an)
        timerRef.current = setTimeout(() => {
          // ⚠️ Route ist case-sensitiv: Datei heißt Startseite.tsx -> "/Startseite"
          if (hasUser) router.replace("/startseite");
          else router.replace("/login");
        }, 900);
      } catch (e) {
        // Fallback sicher zum Login
        timerRef.current = setTimeout(() => router.replace("/login"), 900);
      }
    };

    go();

    // Cleanup, falls der Screen unmountet
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Image
          source={require("../assets/ayozia_logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.text}>{loadingText}</Text>
      </View>
      {/* Keine BottomNavbar hier! Index ist nur Splash/Redirect. */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: 28,
  },
  text: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
});

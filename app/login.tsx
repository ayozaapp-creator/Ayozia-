// app/login.tsx — Login über eigenen Node-Server (kein Supabase mehr)

import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, { isAxiosError } from "axios";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// 👉 Homeserver (lokaler PC)
const API =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.0.224:5000";

const NEXT_ROUTE = "/postLoginSplash";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Fehler", "Bitte gib E-Mail und Passwort ein.");
      return;
    }

    try {
      setLoading(true);

      // 🔐 Login über deinen eigenen Server
      const res = await axios.post(`${API}/login`, {
        // 👆 WICHTIG: /login (ohne /auth) – Backend kann beides
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      const data = res.data || {};
      const user = data.user || data; // dein Server schickt { message, user }

      if (!user || !user.id) {
        Alert.alert("Fehler", "Ungültige Antwort vom Server.");
        return;
      }

      await AsyncStorage.setItem(
        "user",
        JSON.stringify({
          id: user.id,
          email: user.email,
          username:
            user.username ||
            user.name ||
            user.email?.split("@")[0] ||
            "user",
          token: user.token || data.token || null,
        })
      );

      router.replace(NEXT_ROUTE);
    } catch (err: any) {
      console.log("LOGIN ERROR:", err);

      if (isAxiosError(err)) {
        const msg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          err.message;
        Alert.alert("Fehler", msg || "Login fehlgeschlagen.");
      } else {
        Alert.alert("Fehler", "Ein unerwarteter Fehler ist passiert.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/ayozia_logo.png")}
        style={styles.logo}
      />
      <Text style={styles.title}>Willkommen bei Ayozia</Text>

      <TextInput
        style={styles.input}
        placeholder="E-Mail"
        placeholderTextColor="#ccc"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Passwort"
        placeholderTextColor="#ccc"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Einloggen</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/register")}>
        <Text style={{ color: "#ff00cc", marginTop: 12 }}>
          Jetzt registrieren
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0014",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  logo: {
    width: 90,
    height: 90,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    color: "#fff",
    marginBottom: 30,
    fontWeight: "bold",
  },
  input: {
    width: "100%",
    padding: 12,
    marginBottom: 15,
    backgroundColor: "#1b102a",
    borderWidth: 1,
    borderColor: "#ff00cc",
    borderRadius: 10,
    color: "#fff",
  },
  button: {
    width: "100%",
    backgroundColor: "#ff00cc",
    paddingVertical: 12,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

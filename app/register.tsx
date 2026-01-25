// app/register.tsx — Register über eigenen Node-Server (kein Supabase mehr)

import axios from "axios";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";

// 👉 Homeserver (lokaler PC)
const API =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.0.224:5000";

export default function Register() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username || !email || !password) {
      Alert.alert("Fehler", "Bitte alle Felder ausfüllen.");
      return;
    }

    try {
      setLoading(true);

      // 🔐 Registrierung über deinen eigenen Server
      const res = await axios.post(`${API}/register`, {
        // 👆 WICHTIG: /register (ohne /auth)
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      console.log("REGISTER RESPONSE:", res.data);

      Alert.alert(
        "Erfolg",
        (res.data as any)?.message || "Dein Konto wurde erstellt.",
        [{ text: "OK", onPress: () => router.replace("/login") }]
      );
    } catch (err: any) {
      console.log("REGISTER ERROR:", err);

      if (err.response) {
        const data = err.response?.data as any;
        const msg =
          data?.message ||
          data?.error ||
          err.message;
        Alert.alert("Fehler", msg || "Registrierung fehlgeschlagen.");
      } else {
        Alert.alert("Fehler", "Etwas ist schiefgelaufen.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Image
        source={require("../assets/ayozia_logo.png")}
        style={styles.logo}
      />
      <Text style={styles.title}>Konto erstellen</Text>

      <TextInput
        style={styles.input}
        placeholder="Benutzername"
        placeholderTextColor="#ccc"
        value={username}
        onChangeText={setUsername}
      />

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
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Registrieren</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/login")}>
        <Text style={styles.link}>🔙 Zurück zum Login</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
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
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 40,
  },
  input: {
    width: "100%",
    height: 50,
    backgroundColor: "#1b102a",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#b300ff",
  },
  button: {
    width: "100%",
    height: 50,
    backgroundColor: "#ff1ff1",
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  link: {
    color: "#ff66ff",
  },
});


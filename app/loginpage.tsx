// app/loginpage.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
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
  View,
} from "react-native";

const API = "http://192.168.0.224:5000";



// eigene Axios-Instance: gleicher Header/Timeout überall
const http = axios.create({
  baseURL: API,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

/** Server-Types */
type ServerUser = {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  bio?: string;
  isVerified: boolean;
  createdAt: string | null;
};
type LoginResponse = { message?: string; user?: ServerUser };

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email]
  );
  const pwValid = useMemo(() => password.trim().length >= 4, [password]);
  const canSubmit = emailValid && pwValid && !loading;

  const handleLogin = async () => {
    const em = email.trim().toLowerCase();
    const pw = password.trim();

    if (!emailValid) {
      Alert.alert("Fehler", "Bitte eine gültige E-Mail eingeben.");
      return;
    }
    if (!pwValid) {
      Alert.alert("Fehler", "Passwort muss mindestens 4 Zeichen haben.");
      return;
    }

    try {
      setLoading(true);
      const res = await http.post<LoginResponse>("/login", { email: em, password: pw });
      const data = res.data;

      if (res.status === 200 && data?.user) {
        await AsyncStorage.setItem("user", JSON.stringify(data.user));
        Alert.alert("Erfolg", `Willkommen zurück, ${data.user.username}!`);
        router.replace("/postLoginSplash");
      } else {
        Alert.alert("Fehler", data?.message ?? "Login fehlgeschlagen.");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        (err?.message?.includes("timeout") ? "Zeitüberschreitung – Server nicht erreichbar." : err?.message) ||
        "Netzwerkfehler beim Login.";
      console.error("LOGIN ERROR:", err);
      Alert.alert("Fehler", msg);
    } finally {
      setLoading(false);
    }
  };

  const goToRegister = () => router.push("/register");

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <Image
        source={require("../assets/ayozia_logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>Willkommen bei Ayozia</Text>

      <View style={styles.inputContainer}>
        <TextInput
          placeholder="E-Mail"
          placeholderTextColor="#8a8a8a"
          value={email}
          onChangeText={setEmail}
          style={[
            styles.input,
            email.length > 0 && !emailValid && styles.inputError,
          ]}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="next"
        />

        <View style={[styles.input, styles.inputPwWrap]}>
          <TextInput
            placeholder="Passwort"
            placeholderTextColor="#8a8a8a"
            secureTextEntry={!showPw}
            value={password}
            onChangeText={setPassword}
            style={styles.inputPw}
            autoCapitalize="none"
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={() => (canSubmit ? handleLogin() : undefined)}
          />
          <TouchableOpacity
            onPress={() => setShowPw((s) => !s)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name={showPw ? "eye-off" : "eye"} size={20} color="#bbb" />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, !canSubmit && { opacity: 0.6 }]}
        onPress={handleLogin}
        disabled={!canSubmit}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Anmelden</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={goToRegister}>
        <Text style={styles.registerText}>
          Noch kein Konto? <Text style={styles.registerLink}>Registrieren</Text>
        </Text>
      </TouchableOpacity>

      {/* Optional: debug */}
      {/* <Text style={{ color: "#666", marginTop: 8, fontSize: 12 }}>API: {API}</Text> */}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0014", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  logo: { width: 160, height: 160, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 30 },
  inputContainer: { width: "100%", gap: 12, marginBottom: 16 },

  input: {
    backgroundColor: "#151528",
    color: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#222344",
  },
  inputError: { borderColor: "#ff4d6d" },

  inputPwWrap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  inputPw: { color: "#fff", flex: 1, marginRight: 10 },

  button: {
    backgroundColor: "#ff4fd8",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 30,
    width: "100%",
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  registerText: { color: "#ccc", marginTop: 16 },
  registerLink: { color: "#ff4fd8", fontWeight: "700" },
});

// app/home.tsx
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import HomeScreen from "../components/homescreen";

export default function Home() {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <HomeScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0b0b" },
});

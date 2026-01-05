import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type OptionMenuProps = {
  input: string;
  setInput: (val: string) => void;
  onClose: () => void;
};

export default function OptionsMenu({ input, setInput, onClose }: OptionMenuProps) {
  return (
    <View style={styles.menu}>
      {/* Nutzer blockieren */}
      <TouchableOpacity
        style={styles.option}
        onPress={() => {
          // TODO: Blockierlogik
          onClose();
        }}
      >
        <Ionicons name="person-remove-outline" size={18} color="#fff" style={styles.icon} />
        <Text style={styles.text}>Nutzer blockieren</Text>
      </TouchableOpacity>

      {/* Nutzer stummschalten */}
      <TouchableOpacity
        style={styles.option}
        onPress={() => {
          // TODO: Mute-Logik
          onClose();
        }}
      >
        <Ionicons name="volume-mute-outline" size={18} color="#fff" style={styles.icon} />
        <Text style={styles.text}>Nutzer stummschalten</Text>
      </TouchableOpacity>

      {/* Nutzer melden */}
      <TouchableOpacity
        style={styles.option}
        onPress={() => {
          // TODO: Melden-Logik
          onClose();
        }}
      >
        <Ionicons name="alert-circle-outline" size={18} color="#fff" style={styles.icon} />
        <Text style={styles.text}>Nutzer melden</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: "absolute",
    top: 60,
    right: 20,
    backgroundColor: "#1e1e1e",
    padding: 10,
    borderRadius: 8,
    zIndex: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: "#fff",
    fontSize: 14,
  },
});

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface EmojiBarProps {
  onSelect: (emoji: string) => void;
}

const emojis = ["❤️", "🔥", "😂", "😍", "💯", "😢"];

export default function EmojiBar({ onSelect }: EmojiBarProps) {
  return (
    <View style={styles.emojiBar}>
      {emojis.map((emoji) => (
        <TouchableOpacity key={emoji} onPress={() => onSelect(emoji)}>
          <Text style={styles.emoji}>{emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  emojiBar: {
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
    paddingVertical: 8,
    gap: 12,
  },
  emoji: { fontSize: 22 },
});
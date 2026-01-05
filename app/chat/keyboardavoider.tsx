// app/chat/keyboardavoider.tsx
import React from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Schlanker Wrapper NUR für Keyboard-Abstand.
 * WICHTIG: KEIN ScrollView hier drin, damit FlatList in [id].tsx
 * der einzige Scroller bleibt → kein "VirtualizedLists nested" Error.
 */
type Props = {
  children: React.ReactNode;
  /**
   * Optionaler zusätzlicher Bottom-Offset (z. B. wenn eine BottomBar da ist).
   */
  extraBottomInset?: number;
  style?: any;
};

export default function KeyboardAvoider({ children, extraBottomInset = 0, style }: Props) {
  const insets = useSafeAreaInsets();
  const behavior = Platform.select({ ios: "padding", android: undefined }) as
    | "height"
    | "position"
    | "padding"
    | undefined;

  return (
    <KeyboardAvoidingView
      behavior={behavior}
      style={[styles.flex, style]}
      keyboardVerticalOffset={
        // iOS: Statusbar + evtl. Header; Android: 0
        Platform.OS === "ios" ? Math.max(0, insets.top - 2) : 0
      }
    >
      {/* reiner Container – KEIN ScrollView */}
      <View style={[styles.flex, { paddingBottom: Math.max(insets.bottom, 0) + extraBottomInset }]}>
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

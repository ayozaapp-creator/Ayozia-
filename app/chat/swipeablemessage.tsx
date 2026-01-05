// app/chat/SwipeableMessage.tsx
import React, { useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent, // <-- diesen Typ verwenden
  State,
} from "react-native-gesture-handler";

type Props = {
  children: React.ReactNode;
  onReply?: () => void;
  onDelete?: () => void;
  onPress?: () => void;
  onLongPress?: () => void;
};

export default function SwipeableMessage({
  children,
  onReply,
  onDelete,
  onPress,
  onLongPress,
}: Props) {
  const firedRef = useRef<"left" | "right" | null>(null);
  const [pressTimer, setPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const SWIPE_RIGHT = 28;
  const SWIPE_LEFT = -28;

  const onGestureEvent = (_e: PanGestureHandlerGestureEvent) => {
    // wir reagieren erst am Ende
  };

  const maybeFireByDx = (dx: number) => {
    if (dx > SWIPE_RIGHT && firedRef.current !== "right") {
      firedRef.current = "right";
      onReply?.();
    } else if (dx < SWIPE_LEFT && firedRef.current !== "left") {
      firedRef.current = "left";
      onDelete?.();
    }
    setTimeout(() => (firedRef.current = null), 120);
  };

  const onHandlerStateChange = (e: PanGestureHandlerStateChangeEvent) => {
    const { state, translationX } = e.nativeEvent;
    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      maybeFireByDx(translationX);
    }
  };

  const handlePressIn = () => {
    if (!onLongPress) return;
    const t = setTimeout(() => {
      setPressTimer(null);
      onLongPress?.();
    }, 300);
    setPressTimer(t);
  };

  const handlePressOut = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
      onPress?.();
    }
  };

  return (
    <PanGestureHandler
      activeOffsetX={[-10, 10]}
      failOffsetY={[-8, 8]}
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      enabled
    >
      <View>
        <TouchableOpacity activeOpacity={0.9} onPressIn={handlePressIn} onPressOut={handlePressOut}>
          {children}
        </TouchableOpacity>
      </View>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({});

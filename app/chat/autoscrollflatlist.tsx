import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    FlatList,
    FlatListProps,
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";

/**
 * Drop-in Ersatz für FlatList mit Chat-Auto-Scroll:
 * - Scrollt automatisch nach unten, wenn User "nah am Ende" ist (thresholdPx).
 * - Erzwingt Scroll bei neuen, EIGENEN Nachrichten (prop: myMessageCount).
 * - Zeigt einen "nach unten"-Floating-Button, wenn man weg vom Ende ist.
 *
 * Verwendung:
 *  import AutoScrollFlatList from "./AutoScrollFlatList";
 *  <AutoScrollFlatList
 *    data={messages}
 *    renderItem={renderMessage}
 *    keyExtractor={(m) => m.id}
 *    inverted // falls dein Chat invertiert ist – lass weg, wenn nicht
 *    myMessageCount={mySentCount} // Anzahl deiner gesendeten Nachrichten
 *  />
 */

type Props<T> = Omit<FlatListProps<T>, "onScroll" | "onContentSizeChange"> & {
  /** Anzahl deiner gesendeten Nachrichten (steigt, wenn DU sendest) */
  myMessageCount?: number;
  /** Abstand in px, der noch als "am Ende" gilt */
  thresholdPx?: number;
  /** Nach Mount direkt an's Ende springen */
  scrollOnMount?: boolean;
};

function AutoScrollFlatList<T>(props: Props<T>) {
  const {
    myMessageCount = 0,
    thresholdPx = 120,
    scrollOnMount = true,
    inverted,
    style,
    contentContainerStyle,
    ...rest
  } = props;

  const listRef = useRef<FlatList<T>>(null);
  const [isNearEnd, setIsNearEnd] = useState(true);
  const [listSize, setListSize] = useState({ w: 0, h: 0 });
  const [contentSize, setContentSize] = useState({ w: 0, h: 0 });

  // Hilfsfunktion: an's Ende scrollen (unten bei normaler Liste, oben bei inverted)
  const scrollToEnd = (animated = true) => {
    if (!listRef.current) return;
    if (inverted) {
      // Bei inverted ist "Ende" oben => scrollOffset 0
      listRef.current.scrollToOffset({ offset: 0, animated });
    } else {
      listRef.current.scrollToEnd({ animated });
    }
  };

  // Auf Größenänderungen der Liste reagieren (Keyboard, Rotation etc.)
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setListSize({ w: width, h: height });
  };

  // Ende-Erkennung je nach invertiert/normal
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const offsetY = contentOffset.y;
    const visibleH = layoutMeasurement.height;
    const totalH = contentSize.height;

    if (inverted) {
      // Bei inverted ist "Ende" ≈ offset nahe 0
      const near = offsetY <= thresholdPx;
      setIsNearEnd(near);
    } else {
      // Normal: Ende ≈ totalH - visibleH - offsetY ist klein
      const distanceFromEnd = totalH - visibleH - offsetY;
      const near = distanceFromEnd <= thresholdPx;
      setIsNearEnd(near);
    }
  };

  // Wenn der Content wächst (neue Messages), bei Bedarf auto scrollen
  const onContentSizeChange = (w: number, h: number) => {
    setContentSize({ w, h });
    // Nur auto scrollen, wenn man nah am Ende ist (oder Liste sehr klein)
    const emptyOrSmall = h <= listSize.h + 20;
    if (isNearEnd || emptyOrSmall) {
      // leicht verzögert, damit Layout fertig ist
      requestAnimationFrame(() => scrollToEnd(true));
    }
  };

  // Beim Mount ggf. direkt ans Ende
  useEffect(() => {
    if (!scrollOnMount) return;
    const id = requestAnimationFrame(() => scrollToEnd(false));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wenn DU selbst eine Nachricht sendest (myMessageCount steigt) -> immer scrollen
  const myCountKey = useMemo(() => myMessageCount, [myMessageCount]);
  useEffect(() => {
    if (myCountKey > 0) {
      requestAnimationFrame(() => scrollToEnd(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCountKey]);

  // Floating-Button anzeigen, wenn NICHT nah am Ende
  const showJumpButton = !isNearEnd && contentSize.h > listSize.h + 60;

  return (
    <View style={[styles.wrap, style]} onLayout={onLayout}>
      <FlatList
        {...(rest as FlatListProps<T>)}
        ref={listRef}
        inverted={inverted}
        contentContainerStyle={[styles.cc, contentContainerStyle]}
        onScroll={handleScroll}
        onContentSizeChange={onContentSizeChange}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        initialNumToRender={20}
        windowSize={7}
        maxToRenderPerBatch={20}
        updateCellsBatchingPeriod={34}
        maintainVisibleContentPosition={
          inverted
            ? { minIndexForVisible: 0, autoscrollToTopThreshold: thresholdPx }
            : undefined
        }
      />

      {showJumpButton && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => scrollToEnd(true)}
          activeOpacity={0.9}
        >
          <Ionicons
            name={inverted ? "chevron-up" : "chevron-down"}
            size={20}
            color="#fff"
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  cc: { paddingBottom: 10 },
  fab: {
    position: "absolute",
    right: 12,
    bottom: 12,
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
});

export default AutoScrollFlatList;

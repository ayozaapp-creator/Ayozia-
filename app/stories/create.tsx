// app/stories/create.tsx
import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BG = "#000";
const TEXT = "#fff";
const BORDER = "#1e1e1e";

type LocalMediaItem = {
  id: string;
  uri: string; // immer file://
  mediaType: "photo" | "video";
};

type ListItem = { kind: "camera" } | ({ kind: "media" } & LocalMediaItem);

export default function StoryCreateScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ListItem[]>([]);

  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== "granted") {
          alert("Bitte erlaube den Zugriff auf deine Galerie.");
          setLoading(false);
          return;
        }

        const result = await MediaLibrary.getAssetsAsync({
          mediaType: ["photo", "video"],
          first: 90,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });

        // Alle Assets in file:// umwandeln (localUri)
        const localItems: LocalMediaItem[] = await Promise.all(
          result.assets.map(async (asset) => {
            let fileUri = asset.uri;

            try {
              const info = await MediaLibrary.getAssetInfoAsync(asset.id);
              if (info.localUri) fileUri = info.localUri;
            } catch {
              // ignore – dann bleibt asset.uri
            }

            return {
              id: asset.id,
              uri: fileUri,
              mediaType: asset.mediaType === "video" ? "video" : "photo",
            };
          })
        );

        if (!isActive) return;

        // Erste Zelle = Kamera-Tile, danach alle Medien
        const list: ListItem[] = [
          { kind: "camera" },
          ...localItems.map((m) => ({ kind: "media" as const, ...m })),
        ];

        setItems(list);
      } catch (e) {
        console.warn("StoryCreate load error", e);
      } finally {
        isActive && setLoading(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  const onPressItem = (item: ListItem) => {
    if (item.kind === "camera") {
      router.push("/stories/camera");
      return;
    }

    router.push({
      pathname: "/stories/upload",
      params: {
        uri: item.uri,
        type: item.mediaType,
      },
    });
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.kind === "camera") {
      return (
        <TouchableOpacity
          style={styles.mediaBox}
          activeOpacity={0.9}
          onPress={() => onPressItem(item)}
        >
          <View style={styles.cameraTile}>
            <Ionicons name="camera-outline" size={32} color={TEXT} />
            <Text style={styles.cameraText}>Kamera</Text>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={styles.mediaBox}
        activeOpacity={0.9}
        onPress={() => onPressItem(item)}
      >
        <Image source={{ uri: item.uri }} style={styles.thumb} resizeMode="cover" />
        {item.mediaType === "video" && (
          <Ionicons
            name="play-circle"
            size={20}
            color="#fff"
            style={styles.videoIcon}
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={26} color={TEXT} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>In Story posten</Text>

        <TouchableOpacity
          onPress={() => {
            // Platzhalter Einstellungen
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="settings-outline" size={22} color={TEXT} />
        </TouchableOpacity>
      </View>

      {/* Galerie-Grid */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          numColumns={3}
          keyExtractor={(_, idx) => String(idx)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  header: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "700",
  },

  mediaBox: {
    width: "33.33%",
    aspectRatio: 1,
    position: "relative",
  },
  thumb: { width: "100%", height: "100%" },
  videoIcon: { position: "absolute", bottom: 6, right: 6 },

  cameraTile: {
    flex: 1,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: BORDER,
  },
  cameraText: {
    color: TEXT,
    marginTop: 6,
    fontSize: 13,
  },
});

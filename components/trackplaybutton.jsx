// components/trackplaybutton.jsx
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import audio, { useAudioSnapshot } from "../server/lib/audiocontroller";

export default function TrackPlayButton(props) {
  const { track, size = 26 } = props;
  const playlist = props.playlist; // optional Array von Tracks (Startseite)
  const index = props.index;       // optional Index in dieser Playlist

  const { snapshot, subscribe } = useAudioSnapshot();
  const [snap, setSnap] = useState(snapshot);

  useEffect(() => {
    return subscribe(setSnap);
  }, [subscribe]);

  const isActive = snap.current?.id === track?.id;
  const isPlaying = isActive && snap.isPlaying;

  const handlePress = () => {
    if (!track || !track.url) return;

    // 🔁 Wenn von der Startseite mit Playlist & Index aufgerufen:
    if (Array.isArray(playlist) && typeof index === "number") {
      console.log(
        "TrackPlayButton.playFromQueue",
        "index:",
        index,
        "len:",
        playlist.length
      );
      audio.playFromQueue(playlist, index);
      return;
    }

    // 🔊 Sonst nur diesen einzelnen Track toggeln (Profil, Detailseite, etc.)
    audio.toggle(track);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.9}
      style={styles.btn}
    >
      <Ionicons
        name={isPlaying ? "pause-circle-outline" : "play-circle-outline"}
        size={size}
        color="#fff"
      />

      {isActive && (
        <View style={styles.dotWrap}>
          <View style={styles.dot} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  dotWrap: {
    position: "absolute",
    bottom: 2,
    right: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ff2fb6",
  },
});

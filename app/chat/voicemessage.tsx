// app/chat/voicemessage.tsx
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

/* ─ Types ─ */
export type VoiceNote = {
  uri: string;
  durationMs: number;
  waveform?: number[];
};

/* ─ Helpers ─ */
async function ensureMicPermission(): Promise<boolean> {
  const cur = await Audio.getPermissionsAsync();
  if (cur.status === "granted") return true;
  const ask = await Audio.requestPermissionsAsync();
  return ask.status === "granted";
}

function msToClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/* ─ Recorder ─ */
export class VoiceRecorder {
  private recording: Audio.Recording | null = null;
  private startedAt = 0;

  async start() {
    const ok = await ensureMicPermission();
    if (!ok) throw new Error("Mikrofon gesperrt – bitte Zugriff erlauben.");

    // Leises/Background-Verhalten sinnvoll setzen
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    const rec = new Audio.Recording();
    // HIGH_QUALITY verhindert manchmal Playback-Probleme bei Android
    await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await rec.startAsync();

    this.recording = rec;
    this.startedAt = Date.now();
  }

  async stop(): Promise<VoiceNote | null> {
    if (!this.recording) return null;

    try {
      await this.recording.stopAndUnloadAsync();
    } catch {}

    const uri = this.recording.getURI() ?? "";
    let durationMs = 0;

    try {
      const st: any = await this.recording.getStatusAsync();
      if (st && typeof st.durationMillis === "number") durationMs = st.durationMillis;
    } catch {}
    if (!durationMs) durationMs = Math.max(0, Date.now() - this.startedAt);

    // Aufnahme-Modus verlassen (wichtig fürs Abspielen danach)
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});

    this.recording = null;
    if (!uri) return null;

    return { uri, durationMs };
  }
}

/* ─ Player Bubble ─ */
type BubbleProps = {
  note: VoiceNote;
  tint?: "me" | "other";
};

export function VoiceMessageBubble({ note, tint = "me" }: BubbleProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(note.durationMs || 0);

  // Sound laden / erneuern, wenn URI wechselt
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        // altes Sound-Objekt wegräumen
        if (soundRef.current) {
          soundRef.current.setOnPlaybackStatusUpdate(null as any);
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }

        const created = await Audio.Sound.createAsync(
          { uri: note.uri },
          { shouldPlay: false, progressUpdateIntervalMillis: 150 }
        );

        if (!mounted) {
          await created.sound.unloadAsync().catch(() => {});
          return;
        }

        soundRef.current = created.sound;
        setLoaded(true);

        created.sound.setOnPlaybackStatusUpdate((st: any) => {
          if (!st?.isLoaded) return;
          if (typeof st.positionMillis === "number") setPosition(st.positionMillis);
          // nehme Server-/Datei-Dauer, falls verfügbar
          if (typeof st.durationMillis === "number" && st.durationMillis > 0) {
            setDuration(st.durationMillis);
          }
          if (st.didJustFinish) {
            setPlaying(false);
            setPosition(0);
          }
        });
      } catch {
        setLoaded(false);
      }
    };

    load();

    return () => {
      mounted = false;
      (async () => {
        try {
          if (soundRef.current) {
            soundRef.current.setOnPlaybackStatusUpdate(null as any);
            await soundRef.current.unloadAsync();
            soundRef.current = null;
          }
        } catch {}
      })();
    };
  }, [note.uri]);

  const toggle = async () => {
    if (!loaded || !soundRef.current) return;
    const st: any = await soundRef.current.getStatusAsync();
    if (!st?.isLoaded) return;

    if (st.isPlaying) {
      await soundRef.current.pauseAsync();
      setPlaying(false);
    } else {
      // Sicherstellen, dass wir im Wiedergabe-Modus sind
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      }).catch(() => {});
      await soundRef.current.playAsync();
      setPlaying(true);
    }
  };

  const pct = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <View style={[styles.root, tint === "me" ? styles.rootMe : styles.rootOther]}>
      <TouchableOpacity
        onPress={toggle}
        style={styles.playBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name={playing ? "pause" : "play"} size={18} color="#fff" />
      </TouchableOpacity>

      <View style={styles.middle}>
        <View style={styles.barBg}>
          <View style={[styles.barFg, { width: `${pct * 100}%` }]} />
        </View>
        <Text style={styles.time}>
          {msToClock(playing ? position : duration)}
        </Text>
      </View>

      <View style={styles.endSpace} />
    </View>
  );
}

// Named Export (so wie in deinem Chat importiert)
export const VoiceBubble = VoiceMessageBubble;
// kein Default-Export (verhindert versehentliche falsche Imports)
export { };

/* ─ Styles ─ */
const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    minWidth: 160,
    maxWidth: 280,
  },
  rootMe: { backgroundColor: "#ff4fd8" },
  rootOther: { backgroundColor: "#1a1a1a" },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  middle: { flex: 1, justifyContent: "center" },
  barBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  barFg: { height: 6, borderRadius: 3, backgroundColor: "#fff" },
  time: { marginTop: 6, color: "#fff", fontSize: 12, opacity: 0.9 },
  endSpace: { width: 6 },
});

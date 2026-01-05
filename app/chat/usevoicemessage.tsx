// app/chat/usevoicemessage.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as FileSystem from "expo-file-system";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import type { VoiceNote } from "./voicemessage";
import { VoiceRecorder } from "./voicemessage";

/* ──────────────────────────────────────────────────────────────────────────
   Konfig
────────────────────────────────────────────────────────────────────────── */

const API = "http://192.168.0.224:5000";
const voiceEndpoint = (chatId: string) =>
  `${API}/chat/${encodeURIComponent(chatId)}/voice`;
const STORAGE_KEY = (chatId: string) => `voice_msgs:${chatId}`;

/** Gleiche Chat-ID wie am Server (alphabetisch sortiert) */
export function chatIdFor(a: string, b: string) {
  return [String(a), String(b)].sort().join("-");
}

/* ──────────────────────────────────────────────────────────────────────────
   Types
────────────────────────────────────────────────────────────────────────── */

export type VoiceMsgStatus = "pending" | "uploading" | "sent" | "error";

export type StoredVoiceMsg = {
  id: string;              // local uuid
  chatId: string;
  senderId: string;
  createdAt: number;       // ms timestamp
  localUri: string;        // file://...
  remoteUrl?: string;      // vom Server
  durationMs: number;
  waveform?: number[];
  status: VoiceMsgStatus;
  /** wurde /messages/send-voice bereits erfolgreich ausgeführt? */
  serverPersisted?: boolean;
  /** Zeitpunkt des letzten Versuchs (Backoff) */
  lastAttemptAt?: number;
  error?: string | null;
};

type UseVoiceMessageReturn = {
  messages: StoredVoiceMsg[];
  recording: boolean;
  recordingTimeMs: number;
  startRecording: () => Promise<void>;
  stopAndSave: () => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  resend: (id: string) => Promise<void>;
  clearErrors: (id: string) => Promise<void>;
  forceRetry: () => Promise<void>;
};

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────────────────── */

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** iOS: Temp-URI sicher in App-Speicher kopieren (bleibt bestehen) */
async function ensureReadableLocalFile(originalUri: string): Promise<string> {
  const FS: any = FileSystem as any; // TS-Noise weg
  const baseDir: string | null =
    FS.documentDirectory ?? FS.cacheDirectory ?? null;

  if (!baseDir) return originalUri;

  try {
    const voicesDir = `${baseDir}voices/`;
    await FileSystem.makeDirectoryAsync(voicesDir, { intermediates: true });

    const ext =
      originalUri.split(".").pop()?.split("?")[0]?.toLowerCase() || "m4a";
    const newPath = `${voicesDir}${uuid()}.${ext}`;

    await FileSystem.copyAsync({ from: originalUri, to: newPath });
    return newPath;
  } catch {
    return originalUri;
  }
}

async function readList(chatId: string): Promise<StoredVoiceMsg[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY(chatId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredVoiceMsg[];
    // NICHT aggressiv löschen – nur zurückgeben.
    return parsed;
  } catch {
    return [];
  }
}
async function writeList(chatId: string, list: StoredVoiceMsg[]) {
  await AsyncStorage.setItem(STORAGE_KEY(chatId), JSON.stringify(list));
}

/* ──────────────────────────────────────────────────────────────────────────
   Upload + Server-Persist
────────────────────────────────────────────────────────────────────────── */

type UploadResponse = { url: string };

async function uploadVoiceFile(msg: StoredVoiceMsg): Promise<{ remoteUrl: string }> {
  // Wenn schon URL existiert, nichts neu hochladen
  if (msg.remoteUrl) return { remoteUrl: msg.remoteUrl };

  const form = new FormData();
  const filename = msg.localUri.split("/").pop() || `voice-${msg.id}.m4a`;
  const file: any = { uri: msg.localUri, name: filename, type: "audio/m4a" };
  (form as any).append("file", file);
  form.append("durationMs", String(msg.durationMs));
  form.append("senderId", msg.senderId);

  const res = await axios.post<UploadResponse>(voiceEndpoint(msg.chatId), form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 30000,
  });

  if (!res?.data?.url) throw new Error("Upload fehlgeschlagen (keine URL)");
  return { remoteUrl: res.data.url };
}

async function persistServerVoice(
  fromId: string,
  toId: string,
  url: string,
  durationMs: number,
  waveform?: number[]
) {
  await axios.post(
    `${API}/messages/send-voice`,
    { fromId, toId, url, durationMs, waveform },
    { timeout: 20000 }
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Uploader (Backoff + Idempotenz-Flag)
────────────────────────────────────────────────────────────────────────── */

class Uploader {
  private running = false;
  constructor(
    private chatId: string,
    private senderId: string,
    private partnerId: string
  ) {}

  async drain(onSaved: (list: StoredVoiceMsg[]) => Promise<void>) {
    if (this.running) return;
    this.running = true;
    try {
      let list = await readList(this.chatId);

      const next = () =>
        list.find((m) => m.status === "pending" || m.status === "error");

      while (true) {
        const msg = next();
        if (!msg) break;

        // Bereits persisted? -> nur noch als "sent" markieren.
        if (msg.serverPersisted) {
          msg.status = "sent";
          await writeList(this.chatId, list);
          await onSaved(list);
          continue;
        }

        const now = Date.now();
        // Backoff 8s bei Fehlern
        if (
          msg.status === "error" &&
          msg.lastAttemptAt &&
          now - msg.lastAttemptAt < 8000
        ) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }

        msg.status = "uploading";
        msg.error = null;
        msg.lastAttemptAt = now;
        await writeList(this.chatId, list);
        await onSaved(list);

        try {
          // 1) Datei hochladen (falls noch keine URL)
          const { remoteUrl } = await uploadVoiceFile(msg);
          msg.remoteUrl = remoteUrl;

          // 2) Nachricht am Server persistieren (genau 1x)
          await persistServerVoice(
            this.senderId,
            this.partnerId,
            remoteUrl,
            msg.durationMs,
            msg.waveform
          );
          msg.serverPersisted = true;

          // 3) Done
          msg.status = "sent";
          msg.error = null;
        } catch (e: any) {
          msg.status = "error";
          msg.error = e?.message || "Upload-Fehler";
        }

        await writeList(this.chatId, list);
        await onSaved(list);
      }
    } finally {
      this.running = false;
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Hook
────────────────────────────────────────────────────────────────────────── */

export function useVoiceMessage(
  chatId: string,      // WICHTIG: stabil via chatIdFor(a,b)
  senderId: string,
  partnerId: string
): UseVoiceMessageReturn {
  const [messages, setMessages] = useState<StoredVoiceMsg[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordingTimeMs, setRecordingTimeMs] = useState(0);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const tickRef = useRef<NodeJS.Timer | null>(null);
  const uploaderRef = useRef<Uploader | null>(null);

  // Uploader instanzieren (stabil pro chatId)
  useEffect(() => {
    uploaderRef.current = new Uploader(chatId, senderId, partnerId);
  }, [chatId, senderId, partnerId]);

  // Initial: Liste laden + direkt drainen
  useEffect(() => {
    (async () => {
      const list = await readList(chatId);
      setMessages(list);
      await uploaderRef.current?.drain(async (l) => setMessages([...l]));
    })();
  }, [chatId]);

  // App wird aktiv -> nochmal drainen
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (s) => {
      if (s === "active") {
        await uploaderRef.current?.drain(async (l) => setMessages([...l]));
      }
    });
    return () => sub.remove();
  }, []);

  // Persist helper
  const persist = useCallback(
    async (list: StoredVoiceMsg[]) => {
      await writeList(chatId, list);
      setMessages([...list]);
    },
    [chatId]
  );

  const startRecording = useCallback(async () => {
    if (!recorderRef.current) recorderRef.current = new VoiceRecorder();
    await recorderRef.current.start();
    setRecording(true);
    setRecordingTimeMs(0);

    if (tickRef.current) clearInterval(tickRef.current as any);
    tickRef.current = setInterval(() => {
      setRecordingTimeMs((t) => t + 250);
    }, 250) as any;
  }, []);

  const stopAndSave = useCallback(async () => {
    if (!recorderRef.current) return;
    const note: VoiceNote | null = await recorderRef.current.stop();
    setRecording(false);
    if (tickRef.current) {
      clearInterval(tickRef.current as any);
      tickRef.current = null;
    }
    setRecordingTimeMs(0);

    if (!note?.uri) return;

    // Sicher in App-Speicher kopieren (gegen iOS-Temp-URIs)
    const localUri = await ensureReadableLocalFile(note.uri);

    const newMsg: StoredVoiceMsg = {
      id: uuid(),
      chatId,
      senderId,
      createdAt: Date.now(),
      localUri,
      durationMs: note.durationMs || 0,
      waveform: note.waveform,
      status: "pending",
      serverPersisted: false,
      lastAttemptAt: 0,
      error: null,
    };

    const list = await readList(chatId);
    list.push(newMsg);
    await persist(list);

    // Sofortigen Upload anstoßen
    await uploaderRef.current?.drain(async (l) => setMessages([...l]));
  }, [chatId, senderId, persist]);

  const deleteMessage = useCallback(
    async (id: string) => {
      const list = await readList(chatId);
      const idx = list.findIndex((m) => m.id === id);
      if (idx === -1) return;

      const uri = list[idx].localUri;
      if (uri?.startsWith("file://")) {
        try {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        } catch {}
      }

      list.splice(idx, 1);
      await persist(list);
    },
    [chatId, persist]
  );

  const resend = useCallback(
    async (id: string) => {
      const list = await readList(chatId);
      const msg = list.find((m) => m.id === id);
      if (!msg) return;
      // nur zurücksetzen, nicht löschen
      msg.status = "pending";
      msg.error = null;
      await persist(list);
      await uploaderRef.current?.drain(async (l) => setMessages([...l]));
    },
    [chatId, persist]
  );

  const clearErrors = useCallback(
    async (id: string) => {
      const list = await readList(chatId);
      const msg = list.find((m) => m.id === id);
      if (!msg) return;
      msg.error = null;
      await persist(list);
    },
    [chatId, persist]
  );

  const forceRetry = useCallback(async () => {
    await uploaderRef.current?.drain(async (l) => setMessages([...l]));
  }, []);

  return useMemo(
    () => ({
      messages: [...messages].sort((a, b) => a.createdAt - b.createdAt),
      recording,
      recordingTimeMs,
      startRecording,
      stopAndSave,
      deleteMessage,
      resend,
      clearErrors,
      forceRetry,
    }),
    [
      messages,
      recording,
      recordingTimeMs,
      startRecording,
      stopAndSave,
      deleteMessage,
      resend,
      clearErrors,
      forceRetry,
    ]
  );
}

// Route-Shim (falls über expo-router importiert)
export default function VoiceMessageRouteShim() {
  return null;
}

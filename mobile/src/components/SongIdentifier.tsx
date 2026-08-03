import { Audio } from "expo-av";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { createCrowdListDataSource } from "../data/http-data-source";
import type { Stage } from "../data/types";

const RECORDING_SECONDS = 10;
const MAX_AUDIO_BYTES = 5_000_000;

type Mode = "choose" | "requesting" | "recording" | "identifying" | "manual" | "submitting" | "result";

async function recordingToBase64(uri: string) {
  const response = await fetch(uri);
  const blob = await response.blob();
  if (blob.size === 0 || blob.size >= MAX_AUDIO_BYTES) {
    throw new Error("That recording was empty or too large. Try again.");
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the recording."));
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const encoded = result.split(",")[1];
      if (encoded) resolve(encoded);
      else reject(new Error("Could not encode the recording."));
    };
    reader.readAsDataURL(blob);
  });
}

export function SongIdentifier({ stage, onClose }: { stage: Stage; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("choose");
  const [secondsLeft, setSecondsLeft] = useState(RECORDING_SECONDS);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [source, setSource] = useState<"human" | "acrcloud">("human");
  const [confidence, setConfidence] = useState<number | undefined>();
  const [message, setMessage] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    stopTimerRef.current = null;
    tickTimerRef.current = null;
  }, []);

  const finishRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;
    clearTimers();
    setMode("identifying");
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      if (!uri) throw new Error("The recording was not available.");
      const result = await createCrowdListDataSource().identifySong({
        stageId: stage.id,
        audioBase64: await recordingToBase64(uri),
        mimeType: Platform.OS === "web" ? "audio/webm" : "audio/mp4",
      });
      if (result.status === "match") {
        setTitle(result.title);
        setArtist(result.artist);
        setSource("acrcloud");
        setConfidence(result.confidence ?? undefined);
        setMessage("Match found. Confirm it below so the crowd can verify it.");
        setMode("manual");
      } else {
        setMessage(result.message);
        setMode("result");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not identify that recording.");
      setMode("result");
    }
  }, [clearTimers, stage.id]);

  const startRecording = useCallback(async () => {
    setMode("requesting");
    setMessage(null);
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setMessage("Microphone permission is required. You can still enter the song manually.");
        setMode("result");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setSecondsLeft(RECORDING_SECONDS);
      setMode("recording");
      tickTimerRef.current = setInterval(
        () => setSecondsLeft((current) => Math.max(0, current - 1)),
        1_000,
      );
      stopTimerRef.current = setTimeout(() => void finishRecording(), RECORDING_SECONDS * 1_000);
    } catch {
      setMessage("The microphone could not start. Enter the song manually or try again.");
      setMode("result");
    }
  }, [finishRecording]);

  useEffect(() => () => {
    clearTimers();
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (recording) void recording.stopAndUnloadAsync().catch(() => undefined);
  }, [clearTimers]);

  const submitSong = useCallback(async () => {
    if (!title.trim() || !artist.trim()) {
      setMessage("Enter both the song title and artist.");
      return;
    }
    setMode("submitting");
    setMessage(null);
    try {
      const result = await createCrowdListDataSource().submitSongProposal({
        stageId: stage.id,
        title,
        artist,
        source,
        ...(confidence !== undefined ? { confidence } : {}),
      });
      setMessage(
        result.status === "confirmed"
          ? `${result.title} is now confirmed at ${stage.name}.`
          : `Submitted. ${result.threshold - result.votes} more agreement needed to confirm.`,
      );
      setMode("result");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not submit that song.");
      setMode("manual");
    }
  }, [artist, confidence, source, stage.id, stage.name, title]);

  const reset = () => {
    setTitle("");
    setArtist("");
    setSource("human");
    setConfidence(undefined);
    setMessage(null);
    setMode("choose");
  };

  return (
    <Modal animationType="slide" transparent visible onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.eyebrow}>{stage.name.toUpperCase()}</Text>
              <Text style={styles.heading}>Identify this song</Text>
            </View>
            <Pressable accessibilityLabel="Close song identifier" onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          {mode === "choose" ? (
            <>
              <Pressable onPress={() => void startRecording()} style={styles.micButton}>
                <Text style={styles.micIcon}>●</Text>
                <View>
                  <Text style={styles.micTitle}>Listen for 10 seconds</Text>
                  <Text style={styles.micCopy}>Audio is sent only for recognition and is not retained.</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => setMode("manual")} style={styles.manualLink}>
                <Text style={styles.manualLinkText}>Enter title and artist manually</Text>
              </Pressable>
            </>
          ) : null}

          {mode === "requesting" || mode === "identifying" || mode === "submitting" ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#171615" size="large" />
              <Text style={styles.stateTitle}>
                {mode === "requesting" ? "Opening microphone…" : mode === "identifying" ? "Finding the song…" : "Submitting…"}
              </Text>
            </View>
          ) : null}

          {mode === "recording" ? (
            <View style={styles.centerState}>
              <View style={styles.recordingOrb}><Text style={styles.recordingTime}>{secondsLeft}s</Text></View>
              <Text style={styles.stateTitle}>Listening at {stage.name}</Text>
              <Text style={styles.stateCopy}>Hold your phone toward the music.</Text>
              <Pressable onPress={() => void finishRecording()} style={styles.stopButton}>
                <Text style={styles.stopText}>Stop and identify</Text>
              </Pressable>
            </View>
          ) : null}

          {mode === "manual" ? (
            <View>
              {message ? <Text style={styles.notice}>{message}</Text> : null}
              <Text style={styles.label}>Song title</Text>
              <TextInput
                autoCapitalize="words"
                onChangeText={setTitle}
                placeholder="What are they playing?"
                placeholderTextColor="#8a837b"
                style={styles.input}
                value={title}
              />
              <Text style={styles.label}>Artist</Text>
              <TextInput
                autoCapitalize="words"
                onChangeText={setArtist}
                placeholder="Artist name"
                placeholderTextColor="#8a837b"
                style={styles.input}
                value={artist}
              />
              <Pressable onPress={() => void submitSong()} style={styles.submitButton}>
                <Text style={styles.submitText}>That’s playing</Text>
              </Pressable>
            </View>
          ) : null}

          {mode === "result" ? (
            <View style={styles.centerState}>
              <Text style={styles.resultMark}>✓</Text>
              <Text style={styles.stateTitle}>{message}</Text>
              <View style={styles.resultActions}>
                <Pressable onPress={reset} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>Try another</Text>
                </Pressable>
                <Pressable onPress={onClose} style={styles.submitButton}>
                  <Text style={styles.submitText}>Done</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(23, 22, 21, 0.42)", flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fffdf7", borderTopLeftRadius: 26, borderTopRightRadius: 26, minHeight: 390, padding: 22, paddingBottom: 36 },
  sheetHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  eyebrow: { color: "#69635d", fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  heading: { color: "#171615", fontSize: 28, fontWeight: "900", letterSpacing: -1, marginTop: 4 },
  close: { alignItems: "center", backgroundColor: "#eee9df", borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  closeText: { color: "#171615", fontSize: 25, lineHeight: 27 },
  micButton: { alignItems: "center", backgroundColor: "#171615", borderRadius: 18, flexDirection: "row", gap: 14, marginTop: 28, padding: 18 },
  micIcon: { color: "#ff6d55", fontSize: 35 },
  micTitle: { color: "white", fontSize: 16, fontWeight: "800" },
  micCopy: { color: "#c8c2b8", fontSize: 11, lineHeight: 16, marginTop: 4, maxWidth: 260 },
  manualLink: { alignItems: "center", borderColor: "#171615", borderRadius: 18, borderWidth: 1, marginTop: 12, padding: 16 },
  manualLinkText: { color: "#171615", fontSize: 14, fontWeight: "800" },
  centerState: { alignItems: "center", flex: 1, justifyContent: "center", minHeight: 270, paddingVertical: 24 },
  stateTitle: { color: "#171615", fontSize: 18, fontWeight: "800", marginTop: 16, textAlign: "center" },
  stateCopy: { color: "#69635d", fontSize: 13, marginTop: 6 },
  recordingOrb: { alignItems: "center", backgroundColor: "#ff6d55", borderRadius: 55, height: 110, justifyContent: "center", width: 110 },
  recordingTime: { color: "white", fontSize: 28, fontWeight: "900" },
  stopButton: { backgroundColor: "#171615", borderRadius: 999, marginTop: 22, paddingHorizontal: 22, paddingVertical: 13 },
  stopText: { color: "#dfff36", fontSize: 13, fontWeight: "800" },
  notice: { backgroundColor: "#eff6ca", borderRadius: 12, color: "#3d421c", fontSize: 12, lineHeight: 17, marginTop: 20, padding: 12 },
  label: { color: "#69635d", fontSize: 11, fontWeight: "800", marginBottom: 6, marginTop: 18, textTransform: "uppercase" },
  input: { backgroundColor: "#f1ece2", borderColor: "#d9d1c5", borderRadius: 13, borderWidth: 1, color: "#171615", fontSize: 16, paddingHorizontal: 14, paddingVertical: 13 },
  submitButton: { alignItems: "center", backgroundColor: "#171615", borderRadius: 999, marginTop: 22, paddingHorizontal: 22, paddingVertical: 14 },
  submitText: { color: "#dfff36", fontSize: 14, fontWeight: "900" },
  resultMark: { color: "#2f8f49", fontSize: 52, fontWeight: "900" },
  resultActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  secondaryButton: { alignItems: "center", borderColor: "#171615", borderRadius: 999, borderWidth: 1, marginTop: 22, paddingHorizontal: 22, paddingVertical: 14 },
  secondaryText: { color: "#171615", fontSize: 14, fontWeight: "800" },
});

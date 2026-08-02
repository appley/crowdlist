import { AudioLines, CircleStop, ExternalLink, LoaderCircle, Mic2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { blobToBase64, chooseRecordingMimeType } from "../../lib/audio";
import type {
  SongRecognitionInput,
  SongRecognitionResponse,
  Stage,
} from "../../types";

const RECORDING_SECONDS = 10;
const MAX_AUDIO_BYTES = 4_900_000;

type RecognitionState =
  | { name: "idle" }
  | { name: "requesting" }
  | { name: "listening"; secondsLeft: number }
  | { name: "identifying" }
  | { name: "result"; result: SongRecognitionResponse };

interface SongRecognitionProps {
  stage: Stage;
  recognizeSong?: (input: SongRecognitionInput) => Promise<SongRecognitionResponse>;
}

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function SongRecognition({ stage, recognizeSong }: SongRecognitionProps) {
  const [state, setState] = useState<RecognitionState>({ name: "idle" });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const sessionRef = useRef(0);

  const cleanUpCapture = useCallback(() => {
    if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current);
    if (tickTimerRef.current !== null) window.clearInterval(tickTimerRef.current);
    stopTimerRef.current = null;
    tickTimerRef.current = null;
    stopTracks(streamRef.current);
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const stopCapture = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  }, []);

  useEffect(() => {
    sessionRef.current += 1;
    setState({ name: "idle" });
    stopCapture();
  }, [stage.id, stopCapture]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sessionRef.current += 1;
      const recorder = recorderRef.current;
      if (recorder?.state === "recording") recorder.stop();
      cleanUpCapture();
    };
  }, [cleanUpCapture]);

  const beginListening = useCallback(async () => {
    if (!recognizeSong) {
      setState({
        name: "result",
        result: { status: "unavailable", message: "Song recognition needs the live demo connection." },
      });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState({
        name: "result",
        result: { status: "unavailable", message: "Microphone recording is not supported in this browser." },
      });
      return;
    }

    setState({ name: "requesting" });
    const session = ++sessionRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
        video: false,
      });
      if (!mountedRef.current || session !== sessionRef.current) {
        stopTracks(stream);
        return;
      }

      streamRef.current = stream;
      const mimeType = chooseRecordingMimeType((type) => MediaRecorder.isTypeSupported(type));
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, {
          ...(mimeType ? { mimeType } : {}),
          audioBitsPerSecond: 96_000,
        });
      } catch {
        recorder = new MediaRecorder(stream);
      }

      const chunks: Blob[] = [];
      recorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      recorder.addEventListener("error", () => {
        cleanUpCapture();
        if (mountedRef.current && session === sessionRef.current) {
          setState({
            name: "result",
            result: { status: "error", message: "The microphone recording stopped unexpectedly." },
          });
        }
      });
      recorder.addEventListener("stop", async () => {
        const recordedMimeType = recorder.mimeType || mimeType || "audio/webm";
        const audio = new Blob(chunks, { type: recordedMimeType });
        cleanUpCapture();
        if (!mountedRef.current || session !== sessionRef.current) return;

        if (audio.size === 0 || audio.size >= MAX_AUDIO_BYTES) {
          setState({
            name: "result",
            result: { status: "error", message: "That sample was empty or too large. Try again." },
          });
          return;
        }

        setState({ name: "identifying" });
        try {
          const result = await recognizeSong({
            stageId: stage.id,
            audioBase64: await blobToBase64(audio),
            mimeType: recordedMimeType,
          });
          if (mountedRef.current && session === sessionRef.current) setState({ name: "result", result });
        } catch {
          if (mountedRef.current && session === sessionRef.current) {
            setState({
              name: "result",
              result: { status: "error", message: "Couldn’t identify that sample. Try again." },
            });
          }
        }
      });

      recorder.start();
      setState({ name: "listening", secondsLeft: RECORDING_SECONDS });
      let secondsLeft = RECORDING_SECONDS;
      tickTimerRef.current = window.setInterval(() => {
        secondsLeft -= 1;
        if (mountedRef.current && secondsLeft > 0) setState({ name: "listening", secondsLeft });
      }, 1_000);
      stopTimerRef.current = window.setTimeout(stopCapture, RECORDING_SECONDS * 1_000);
    } catch (error) {
      cleanUpCapture();
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      if (session !== sessionRef.current) return;
      setState({
        name: "result",
        result: {
          status: "error",
          message: denied
            ? "Microphone access stayed private. You can keep using the live map."
            : "The microphone could not start. Try again in a quieter spot.",
        },
      });
    }
  }, [cleanUpCapture, recognizeSong, stage.id, stopCapture]);

  const result = state.name === "result" ? state.result : null;
  const match = result?.status === "match" ? result.match : null;

  return (
    <div className={`song-recognition song-recognition--${state.name}`}>
      <div className="song-recognition__action">
        <button
          className="song-recognition__button"
          type="button"
          onClick={state.name === "listening" ? stopCapture : beginListening}
          disabled={state.name === "requesting" || state.name === "identifying"}
          aria-describedby="song-recognition-note"
        >
          {state.name === "requesting" || state.name === "identifying" ? (
            <LoaderCircle className="song-recognition__spinner" size={17} aria-hidden="true" />
          ) : state.name === "listening" ? (
            <CircleStop size={17} aria-hidden="true" />
          ) : state.name === "result" ? (
            <RotateCcw size={17} aria-hidden="true" />
          ) : (
            <Mic2 size={17} aria-hidden="true" />
          )}
          {state.name === "requesting" && "Opening mic…"}
          {state.name === "listening" && `Listening · ${state.secondsLeft}s`}
          {state.name === "identifying" && "Finding song…"}
          {state.name === "result" && "Try another song"}
          {state.name === "idle" && "What song is this?"}
        </button>
        <p id="song-recognition-note">10-second mic sample · not saved by CrowdList</p>
      </div>

      {state.name === "listening" ? (
        <div className="song-recognition__listening" role="status" aria-live="polite">
          <AudioLines size={18} aria-hidden="true" />
          <span>Listening at {stage.name}. Hold your phone toward the music.</span>
          <i
            aria-hidden="true"
            style={{ "--listen-progress": `${((RECORDING_SECONDS - state.secondsLeft) / RECORDING_SECONDS) * 100}%` } as CSSProperties}
          />
        </div>
      ) : null}

      {match ? (
        <div className="song-recognition__result song-recognition__result--match" role="status" aria-live="polite">
          <AudioLines size={19} aria-hidden="true" />
          <div>
            <span>Heard at {stage.name}</span>
            <strong>{match.title}</strong>
            <p>{match.artists.length ? match.artists.join(", ") : "Artist unavailable"}</p>
          </div>
          {match.spotifyId || match.youtubeId ? (
            <a
              href={match.spotifyId
                ? `https://open.spotify.com/track/${encodeURIComponent(match.spotifyId)}`
                : `https://www.youtube.com/watch?v=${encodeURIComponent(match.youtubeId!)}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${match.title} in ${match.spotifyId ? "Spotify" : "YouTube"}`}
            >
              <ExternalLink size={17} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      ) : null}

      {result?.status === "no_match" ? (
        <p className="song-recognition__message" role="status">
          No match yet. Try again closer to the stage for a full 10 seconds.
        </p>
      ) : null}
      {result?.status === "error" || result?.status === "unavailable" ? (
        <p className="song-recognition__message" role="status">{result.message}</p>
      ) : null}
    </div>
  );
}

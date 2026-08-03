const IDENTIFY_PATH = "/v1/identify";
const MAX_AUDIO_BYTES = 5_000_000;
const VALID_STAGE_IDS = new Set([
  "lands-end",
  "twin-peaks",
  "sutro",
  "panhandle",
  "soma",
  "dolores",
  "duboce-triangle",
]);

export type SongRecognitionResult =
  | { status: "match"; title: string; artist: string; confidence: number | null }
  | { status: "no_match"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

export type SongRecognitionConfig = {
  host?: string;
  accessKey?: string;
  accessSecret?: string;
};

function bytesToBase64(bytes: ArrayBuffer) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function sign(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  return bytesToBase64(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
  );
}

function decodeBase64(value: string) {
  if (!value || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return null;
  try {
    const decoded = atob(value);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function normalizedHost(value: string) {
  const host = value.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return /^[a-z0-9.-]+\.acrcloud\.com$/i.test(host) ? host : null;
}

export async function identifySong(
  input: { stageId: string; audioBase64: string; mimeType: string },
  config: SongRecognitionConfig,
): Promise<SongRecognitionResult> {
  if (!VALID_STAGE_IDS.has(input.stageId)) {
    return { status: "error", message: "Choose a festival stage first." };
  }
  if (!config.host || !config.accessKey || !config.accessSecret) {
    return {
      status: "unavailable",
      message: "Song recognition is not configured. Enter the song manually instead.",
    };
  }

  const host = normalizedHost(config.host);
  const audio = decodeBase64(input.audioBase64);
  if (!host) return { status: "error", message: "Recognition server configuration is invalid." };
  if (!audio || audio.byteLength === 0 || audio.byteLength >= MAX_AUDIO_BYTES) {
    return { status: "error", message: "That recording was empty or too large. Try again." };
  }
  if (!input.mimeType.startsWith("audio/") || input.mimeType.length > 100) {
    return { status: "error", message: "That recording format is not supported." };
  }

  const timestamp = String(Math.floor(Date.now() / 1_000));
  const signatureVersion = "1";
  const signature = await sign(
    config.accessSecret,
    ["POST", IDENTIFY_PATH, config.accessKey, "audio", signatureVersion, timestamp].join("\n"),
  );
  const payload = new FormData();
  payload.append("sample", new Blob([audio], { type: input.mimeType }), "crowdlist-clip.m4a");
  payload.append("sample_bytes", String(audio.byteLength));
  payload.append("access_key", config.accessKey);
  payload.append("data_type", "audio");
  payload.append("signature_version", signatureVersion);
  payload.append("signature", signature);
  payload.append("timestamp", timestamp);

  try {
    const response = await fetch(`https://${host}${IDENTIFY_PATH}`, {
      method: "POST",
      body: payload,
    });
    const result = (await response.json()) as {
      status?: { code?: number; msg?: string };
      metadata?: {
        music?: Array<{
          title?: string;
          artists?: Array<{ name?: string }>;
          score?: number;
        }>;
      };
    };
    if (result.status?.code === 1001 || result.status?.code === 2004) {
      return { status: "no_match", message: "No match yet. Try again closer to the stage." };
    }
    if (!response.ok || result.status?.code !== 0) {
      return { status: "error", message: result.status?.msg || "Recognition failed. Try again." };
    }
    const match = result.metadata?.music?.[0];
    if (!match?.title) {
      return { status: "no_match", message: "No match yet. Try again closer to the stage." };
    }
    return {
      status: "match",
      title: match.title,
      artist: match.artists?.map((artist) => artist.name).filter(Boolean).join(", ") || "Unknown artist",
      confidence: match.score ?? null,
    };
  } catch {
    return { status: "error", message: "Song recognition is temporarily unavailable." };
  }
}

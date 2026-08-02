import { v } from "convex/values";
import { action } from "./_generated/server";

const IDENTIFY_PATH = "/v1/identify";
const DATA_TYPE = "audio";
const SIGNATURE_VERSION = "1";
const MAX_AUDIO_BYTES = 5_000_000;
const REQUEST_TIMEOUT_MS = 20_000;
const VALID_STAGE_IDS = new Set([
  "lands-end",
  "twin-peaks",
  "sutro",
  "panhandle",
  "soma",
  "dolores",
  "duboce-triangle",
]);

type UnknownRecord = Record<string, unknown>;

export interface ParsedSongMatch {
  title: string;
  artists: string[];
  album?: string;
  score?: number;
  acrid: string;
  isrc?: string;
  spotifyId?: string;
  youtubeId?: string;
}

export type ParsedAcrcloudResponse =
  | { status: "match"; match: ParsedSongMatch }
  | { status: "no_match" }
  | { status: "error"; message: string };

export function buildAcrcloudStringToSign(accessKey: string, timestamp: string) {
  return ["POST", IDENTIFY_PATH, accessKey, DATA_TYPE, SIGNATURE_VERSION, timestamp].join("\n");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function signAcrcloudRequest(
  accessSecret: string,
  accessKey: string,
  timestamp: string,
) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(accessSecret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(buildAcrcloudStringToSign(accessKey, timestamp)),
  );
  return bytesToBase64(new Uint8Array(signature));
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(record: UnknownRecord, key: string) {
  return typeof record[key] === "string" && record[key] ? record[key] : undefined;
}

function getPlatformId(metadata: unknown, platform: "spotify" | "youtube") {
  if (!isRecord(metadata)) return undefined;
  const rawPlatform = metadata[platform];
  const platformData = Array.isArray(rawPlatform) ? rawPlatform[0] : rawPlatform;
  if (!isRecord(platformData)) return undefined;

  if (platform === "youtube") {
    const videoId = getString(platformData, "vid");
    if (videoId) return videoId;
  }

  const track = platformData.track;
  if (isRecord(track)) return getString(track, "id");
  return getString(platformData, "id");
}

export function parseAcrcloudResponse(payload: unknown): ParsedAcrcloudResponse {
  if (!isRecord(payload)) return { status: "error", message: "ACRCloud returned an unreadable response." };

  const rawStatus = payload.status;
  const status = isRecord(rawStatus) ? rawStatus : {};
  const statusCode = typeof status.code === "number" ? status.code : Number(status.code);
  if (statusCode === 1001) return { status: "no_match" };
  if (statusCode !== 0) {
    return { status: "error", message: "Song recognition is temporarily unavailable." };
  }

  const metadata = isRecord(payload.metadata) ? payload.metadata : {};
  const rawMusic = Array.isArray(metadata.music) ? metadata.music : [];
  const candidate = rawMusic.find(isRecord);
  if (!candidate) return { status: "no_match" };

  // Identification responses contain the match directly. File-scanning-style
  // responses wrap it in `result`, so tolerate both shapes.
  const song = isRecord(candidate.result) ? candidate.result : candidate;
  const title = getString(song, "title");
  const acrid = getString(song, "acrid");
  if (!title || !acrid) return { status: "no_match" };

  const artists = Array.isArray(song.artists)
    ? song.artists.flatMap((artist) => isRecord(artist) && getString(artist, "name") ? [getString(artist, "name")!] : [])
    : [];
  const album = isRecord(song.album) ? getString(song.album, "name") : undefined;
  const score = typeof song.score === "number" ? song.score : undefined;
  const externalIds = isRecord(song.external_ids) ? song.external_ids : {};

  return {
    status: "match",
    match: {
      title,
      artists,
      acrid,
      ...(album ? { album } : {}),
      ...(score !== undefined ? { score } : {}),
      ...(getString(externalIds, "isrc") ? { isrc: getString(externalIds, "isrc") } : {}),
      ...(getPlatformId(song.external_metadata, "spotify")
        ? { spotifyId: getPlatformId(song.external_metadata, "spotify") }
        : {}),
      ...(getPlatformId(song.external_metadata, "youtube")
        ? { youtubeId: getPlatformId(song.external_metadata, "youtube") }
        : {}),
    },
  };
}

function normalizeHost(value: string) {
  const candidate = value.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  if (!/^[a-z0-9.-]+\.acrcloud\.com$/i.test(candidate)) return null;
  return candidate;
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

function filenameForMimeType(mimeType: string) {
  if (mimeType.includes("ogg")) return "festival-sample.ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "festival-sample.m4a";
  return "festival-sample.webm";
}

export const identify = action({
  args: {
    stageId: v.string(),
    audioBase64: v.string(),
    mimeType: v.string(),
  },
  handler: async (_ctx, args): Promise<
    ParsedAcrcloudResponse | { status: "unavailable"; message: string }
  > => {
    if (!VALID_STAGE_IDS.has(args.stageId)) {
      return { status: "error", message: "Choose a festival stage before identifying a song." };
    }

    const host = process.env.ACRCLOUD_HOST;
    const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
    const accessSecret = process.env.ACRCLOUD_ACCESS_SECRET;
    if (!host || !accessKey || !accessSecret) {
      return { status: "unavailable", message: "Song recognition is not configured for this demo." };
    }

    const normalizedHost = normalizeHost(host);
    if (!normalizedHost) {
      return { status: "error", message: "Song recognition has an invalid server configuration." };
    }

    const audio = decodeBase64(args.audioBase64);
    if (!audio || audio.byteLength === 0 || audio.byteLength >= MAX_AUDIO_BYTES) {
      return { status: "error", message: "The audio sample was empty or too large. Try again." };
    }
    if (!args.mimeType.startsWith("audio/") || args.mimeType.length > 100) {
      return { status: "error", message: "This browser produced an unsupported audio sample." };
    }

    const timestamp = String(Math.floor(Date.now() / 1_000));
    const signature = await signAcrcloudRequest(accessSecret, accessKey, timestamp);
    const body = new FormData();
    body.append("sample", new Blob([audio], { type: args.mimeType }), filenameForMimeType(args.mimeType));
    body.append("access_key", accessKey);
    body.append("sample_bytes", String(audio.byteLength));
    body.append("timestamp", timestamp);
    body.append("signature", signature);
    body.append("data_type", DATA_TYPE);
    body.append("signature_version", SIGNATURE_VERSION);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`https://${normalizedHost}${IDENTIFY_PATH}`, {
        method: "POST",
        body,
        signal: controller.signal,
      });
      if (!response.ok) {
        return { status: "error", message: "Song recognition could not reach ACRCloud. Try again." };
      }
      return parseAcrcloudResponse(await response.json());
    } catch {
      return { status: "error", message: "Song recognition timed out. Try once more near the speakers." };
    } finally {
      clearTimeout(timeout);
    }
  },
});

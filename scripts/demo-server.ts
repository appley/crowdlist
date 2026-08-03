import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Presence, Stage, StageOneSnapshot } from "../lib/data/types";
import { identifySong } from "../lib/data/song-recognition";
import {
  cleanSongProposal,
  songProposalKey,
  type SongProposalInput,
} from "../lib/data/song-proposals";
import { loadLocalEnv } from "./script-env";
import { outsideLandsStages } from "./seed-data";

loadLocalEnv();

const port = Number.parseInt(process.env.PORT ?? "5173", 10);
const adminToken = process.env.CROWDLIST_ADMIN_TOKEN;
let snapshot: StageOneSnapshot = { stages: outsideLandsStages, presence: [] };
const proposalVotes = new Map<string, number>();

function agreementThreshold() {
  if (process.env.CROWDLIST_DEMO_THRESHOLD_ENABLED === "true") return 1;
  const configured = Number.parseInt(
    process.env.CROWDLIST_AGREEMENT_THRESHOLD ??
      process.env.EXPO_PUBLIC_AGREEMENT_THRESHOLD ??
      "2",
    10,
  );
  return Number.isFinite(configured) && configured > 0 ? configured : 2;
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "access-control-allow-headers": "content-type, x-crowdlist-admin-token",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    "content-type": "application/json",
  });
  response.end(JSON.stringify(value));
}

function isAdminRequest(request: IncomingMessage) {
  return Boolean(adminToken) && request.headers["x-crowdlist-admin-token"] === adminToken;
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "OPTIONS") {
    sendJson(response, 204, null);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/stage-one") {
    sendJson(response, 200, snapshot);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/identify") {
    try {
      const body = (await readJson(request)) as {
        stageId: string;
        audioBase64: string;
        mimeType: string;
      };
      const result = await identifySong(body, {
        host: process.env.ACRCLOUD_HOST,
        accessKey: process.env.ACRCLOUD_ACCESS_KEY,
        accessSecret: process.env.ACRCLOUD_ACCESS_SECRET,
      });
      sendJson(response, result.status === "error" ? 502 : 200, result);
    } catch {
      sendJson(response, 400, { status: "error", message: "Invalid recording request." });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/songs/propose") {
    try {
      const input = cleanSongProposal((await readJson(request)) as SongProposalInput);
      if (!input || !snapshot.stages.some((stage) => stage.id === input.stageId)) {
        sendJson(response, 400, { error: "Stage, song title, and artist are required." });
        return;
      }
      const key = songProposalKey(input);
      const votes = (proposalVotes.get(key) ?? 0) + 1;
      proposalVotes.set(key, votes);
      const threshold = agreementThreshold();
      sendJson(response, 201, {
        ...input,
        votes,
        threshold,
        status: votes >= threshold ? "confirmed" : "proposed",
      });
    } catch {
      sendJson(response, 400, { error: "Invalid song proposal." });
    }
    return;
  }

  if (request.method === "POST" && url.pathname.startsWith("/api/admin/")) {
    if (!isAdminRequest(request)) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }

    try {
      const body = await readJson(request);
      if (url.pathname === "/api/admin/seed") {
        snapshot = { stages: (body as { stages: Stage[] }).stages, presence: [] };
        proposalVotes.clear();
        sendJson(response, 200, { ok: true });
        return;
      }
      if (url.pathname === "/api/admin/simulate") {
        snapshot = { ...snapshot, presence: (body as { presence: Presence[] }).presence };
        sendJson(response, 200, { ok: true });
        return;
      }
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : "Invalid request.",
      });
      return;
    }
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`CrowdList demo API ready on http://0.0.0.0:${port}`);
  console.log(`Expo Go URL: http://10.104.126.111:${port}`);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function request(path = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(new URL(path, "http://localhost"), init),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

function render(path = "/") {
  return request(path, { headers: { accept: "text/html" } });
}

test("the first response explains the live festival product even before client JavaScript loads", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>CrowdList — The festival, live<\/title>/i);
  assert.match(html, /Seeded demo/);
  assert.match(html, /NOW PLAYING/);
  assert.match(html, /That’s playing/);
  assert.match(html, /Identify song/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("the client keeps demo gaps explicit so seeded data cannot be mistaken for live sponsor data", async () => {
  const [page, identify, agent] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/identify/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/agent/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Seeded demo/);
  assert.match(page, /OpenAI is not connected/);
  assert.match(identify, /ACRCloud is not configured/);
  assert.match(agent, /OpenAI is not configured/);
  assert.doesNotMatch(page, /OPENAI_API_KEY|ACRCLOUD_ACCESS_SECRET|SETLIST_FM_API_KEY/);
});

test("publication remains crowd-gated and offline contributions remain device-local", async () => {
  const [page, serviceWorker] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);
  assert.match(page, /agreement >= 3/);
  assert.match(page, /3 - agreement/);
  assert.match(page, /crowdlist-votes/);
  assert.match(page, /crowdlist-plan/);
  assert.match(page, /serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(serviceWorker, /caches\.match/);
});

test("an unconfigured concierge fails explicitly instead of presenting a fabricated live answer", async () => {
  const response = await request("/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "Where should I go?", stages: [] }),
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /OpenAI is not configured/);
});

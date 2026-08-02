function toBase64(bytes: ArrayBuffer) {
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
  return toBase64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

export async function POST(request: Request) {
  const host = process.env.ACRCLOUD_HOST;
  const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
  const secret = process.env.ACRCLOUD_ACCESS_SECRET;
  if (!host || !accessKey || !secret) {
    return Response.json({ error: "ACRCloud is not configured; the clip remained local." }, { status: 503 });
  }

  const incoming = await request.formData();
  const clip = incoming.get("clip");
  if (!(clip instanceof File) || !clip.type.startsWith("audio/") || clip.size === 0 || clip.size > 2_000_000) {
    return Response.json({ error: "A valid audio clip under 2 MB is required." }, { status: 400 });
  }

  const endpoint = "/v1/identify";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signatureVersion = "1";
  const signature = await sign(secret, ["POST", endpoint, accessKey, "audio", signatureVersion, timestamp].join("\n"));
  const payload = new FormData();
  payload.append("sample", clip, "crowdlist-clip.webm");
  payload.append("sample_bytes", String(clip.size));
  payload.append("access_key", accessKey);
  payload.append("data_type", "audio");
  payload.append("signature_version", signatureVersion);
  payload.append("signature", signature);
  payload.append("timestamp", timestamp);

  try {
    const response = await fetch(`https://${host}${endpoint}`, { method: "POST", body: payload });
    const result = await response.json() as {
      status?: { code?: number; msg?: string };
      metadata?: { music?: Array<{ title?: string; artists?: Array<{ name?: string }>; score?: number; acrid?: string }> };
    };
    if (!response.ok || result.status?.code !== 0) {
      return Response.json({ error: result.status?.msg || "ACRCloud could not identify this clip." }, { status: 502 });
    }
    const match = result.metadata?.music?.[0];
    return Response.json({
      title: match?.title ?? null,
      artist: match?.artists?.map((artist) => artist.name).filter(Boolean).join(", ") || null,
      confidence: match?.score ?? null,
      fingerprintId: match?.acrid ?? null,
    });
  } catch {
    return Response.json({ error: "ACRCloud is temporarily unavailable." }, { status: 502 });
  }
}

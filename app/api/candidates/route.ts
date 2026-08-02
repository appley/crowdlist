export async function GET(request: Request) {
  const key = process.env.SETLIST_FM_API_KEY;
  if (!key) return Response.json({ error: "setlist.fm is not configured." }, { status: 503 });
  const mbid = new URL(request.url).searchParams.get("mbid");
  if (!mbid || !/^[0-9a-f-]{36}$/i.test(mbid)) {
    return Response.json({ error: "A valid MusicBrainz MBID is required." }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.setlist.fm/rest/1.0/artist/${encodeURIComponent(mbid)}/setlists?p=1`, {
      headers: { accept: "application/json", "x-api-key": key },
    });
    if (!response.ok) return Response.json({ error: "setlist.fm request failed." }, { status: 502 });
    const data = await response.json() as { setlist?: Array<{ sets?: { set?: Array<{ song?: Array<{ name?: string }> }> } }> };
    const counts = new Map<string, number>();
    for (const show of data.setlist ?? []) {
      for (const set of show.sets?.set ?? []) {
        for (const song of set.song ?? []) {
          if (song.name) counts.set(song.name, (counts.get(song.name) ?? 0) + 1);
        }
      }
    }
    const candidates = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([title, plays]) => ({ title, source: "tour", priorWeight: plays }));
    return Response.json({ candidates, attribution: "Setlist data provided by setlist.fm" });
  } catch {
    return Response.json({ error: "setlist.fm is temporarily unavailable." }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const key = process.env.JAMBASE_API_KEY;
  if (!key) return Response.json({ error: "JamBase is not configured." }, { status: 503 });
  const requestedName = new URL(request.url).searchParams.get("name")?.trim() || "Outside Lands";
  const url = new URL("https://api.data.jambase.com/v3/events");
  url.searchParams.set("name", requestedName.slice(0, 100));
  url.searchParams.set("perPage", "10");

  try {
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${key}`,
        accept: "application/json",
        "user-agent": "CrowdList/1.0",
      },
    });
    if (!response.ok) return Response.json({ error: "JamBase request failed." }, { status: 502 });
    const data = await response.json();
    return Response.json({ data, attribution: "Live music data provided by JamBase" });
  } catch {
    return Response.json({ error: "JamBase is temporarily unavailable." }, { status: 502 });
  }
}

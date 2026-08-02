import OpenAI from "openai";

const resolverSchema = {
  type: "object",
  properties: {
    candidate_scores: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, p: { type: "number", minimum: 0, maximum: 1 } },
        required: ["title", "p"],
        additionalProperties: false,
      },
    },
    unknown_mass: { type: "number", minimum: 0, maximum: 1 },
    reasoning_tags: { type: "array", items: { type: "string" } },
    recommend_publish: { type: "boolean" },
  },
  required: ["candidate_scores", "unknown_mass", "reasoning_tags", "recommend_publish"],
  additionalProperties: false,
};

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OpenAI resolver credentials are not configured." }, { status: 503 });
  }
  const body = await request.json() as { candidates?: unknown[]; fingerprint?: unknown; votes?: unknown[]; alreadyPlayed?: unknown[] };
  if (!Array.isArray(body.candidates) || body.candidates.length === 0 || body.candidates.length > 50) {
    return Response.json({ error: "Between 1 and 50 candidates are required." }, { status: 400 });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_RESOLVER_MODEL || "gpt-5",
      instructions: "Arbitrate only among the supplied song candidates plus unknown. Use the frequency prior, fingerprint confidence, geofenced human votes, and already-played exclusions. Never recommend publication without independent human agreement. Return only the required structured result.",
      input: JSON.stringify({
        candidates: body.candidates,
        fingerprint: body.fingerprint ?? null,
        votes: Array.isArray(body.votes) ? body.votes : [],
        alreadyPlayed: Array.isArray(body.alreadyPlayed) ? body.alreadyPlayed : [],
      }).slice(0, 18000),
      text: {
        format: { type: "json_schema", name: "track_resolution", strict: true, schema: resolverSchema },
      },
    });
    return Response.json(JSON.parse(response.output_text));
  } catch {
    return Response.json({ error: "The resolver is temporarily unavailable." }, { status: 502 });
  }
}

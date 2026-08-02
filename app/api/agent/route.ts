import OpenAI from "openai";

type Stage = {
  id: string;
  name: string;
  artist: string;
  song: string;
  next: string;
  nextTime: string;
  crowd: number;
  walk: number;
  history: string[];
};

const tools = [
  {
    type: "function" as const,
    name: "crowd_at",
    description: "Return current relative crowd density for a stage or every stage.",
    strict: true,
    parameters: {
      type: "object",
      properties: { stage: { type: ["string", "null"], description: "Stage ID, or null for every stage." } },
      required: ["stage"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "now_playing",
    description: "Return the artist and crowd-verified song currently playing at a stage.",
    strict: true,
    parameters: {
      type: "object",
      properties: { stage: { type: "string", description: "Stage ID." } },
      required: ["stage"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "setlist",
    description: "Return recently played songs at a stage.",
    strict: true,
    parameters: {
      type: "object",
      properties: { stage: { type: "string", description: "Stage ID." } },
      required: ["stage"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "walk_time",
    description: "Return an estimated walk time from the selected stage to another stage.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Starting stage ID." },
        to: { type: "string", description: "Destination stage ID." },
      },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
];

function toolResult(name: string, rawArguments: string, stages: Stage[], selectedStage: string) {
  const args = JSON.parse(rawArguments) as { stage?: string | null; from?: string; to?: string };
  const findStage = (id?: string | null) => stages.find((stage) => stage.id === id);

  if (name === "crowd_at") {
    const stage = findStage(args.stage);
    return stage ? { stage: stage.name, relativeDensity: stage.crowd } : stages.map(({ id, name, crowd }) => ({ id, name, relativeDensity: crowd }));
  }
  if (name === "now_playing") {
    const stage = findStage(args.stage);
    return stage ? { stage: stage.name, artist: stage.artist, song: stage.song } : { error: "Unknown stage" };
  }
  if (name === "setlist") {
    const stage = findStage(args.stage);
    return stage ? { stage: stage.name, recentSongs: stage.history } : { error: "Unknown stage" };
  }
  if (name === "walk_time") {
    const destination = findStage(args.to);
    return destination ? { from: findStage(args.from)?.name ?? findStage(selectedStage)?.name, to: destination.name, minutes: destination.walk } : { error: "Unknown destination" };
  }
  return { error: "Unsupported tool" };
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OpenAI is not configured; using the downloaded festival guide." }, { status: 503 });
  }

  const body = await request.json() as { question?: string; selectedStage?: string; stages?: Stage[] };
  if (!body.question?.trim() || !Array.isArray(body.stages)) {
    return Response.json({ error: "A question and current stage state are required." }, { status: 400 });
  }
  const stages = body.stages.slice(0, 12).map((stage) => ({
    id: String(stage.id), name: String(stage.name), artist: String(stage.artist), song: String(stage.song),
    next: String(stage.next), nextTime: String(stage.nextTime), crowd: Number(stage.crowd),
    walk: Number(stage.walk), history: Array.isArray(stage.history) ? stage.history.slice(0, 12).map(String) : [],
  }));
  const model = process.env.OPENAI_CONCIERGE_MODEL || "gpt-5";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    let response = await client.responses.create({
      model,
      instructions: "You are CrowdList, a concise festival concierge. Use tools for every claim about live crowd state, songs, setlists, or walk time. Give one actionable recommendation in at most three short sentences. Never call density dangerous and never give evacuation or safety instructions. Decline unrelated general chat.",
      input: body.question.slice(0, 500),
      tools,
    });

    for (let turn = 0; turn < 3; turn += 1) {
      const calls = response.output.filter((item) => item.type === "function_call");
      if (!calls.length) break;
      response = await client.responses.create({
        model,
        previous_response_id: response.id,
        input: calls.map((call) => ({
          type: "function_call_output" as const,
          call_id: call.call_id,
          output: JSON.stringify(toolResult(call.name, call.arguments, stages, body.selectedStage || "")),
        })),
        tools,
      });
    }

    if (!response.output_text) throw new Error("The concierge returned no answer.");
    return Response.json({ answer: response.output_text });
  } catch {
    return Response.json({ error: "The live concierge is temporarily unavailable." }, { status: 502 });
  }
}

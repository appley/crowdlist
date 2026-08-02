import { isAdminRequest } from "../../../../lib/data/admin-auth";
import { getCrowdListRepository } from "../../../../lib/data/d1-repository";
import type { Stage } from "../../../../lib/data/types";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { stages?: Stage[] };
  if (!Array.isArray(body.stages)) {
    return Response.json({ error: "stages must be an array" }, { status: 400 });
  }

  await getCrowdListRepository().resetStageOne(body.stages);
  return Response.json({ ok: true, stages: body.stages.length });
}

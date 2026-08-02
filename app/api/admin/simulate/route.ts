import { isAdminRequest } from "../../../../lib/data/admin-auth";
import { getCrowdListRepository } from "../../../../lib/data/d1-repository";
import type { SimulatedPresenceInput } from "../../../../lib/data/types";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { presence?: SimulatedPresenceInput[] };
  if (!Array.isArray(body.presence)) {
    return Response.json({ error: "presence must be an array" }, { status: 400 });
  }

  await getCrowdListRepository().replacePresence(body.presence);
  return Response.json({ ok: true, presence: body.presence.length });
}

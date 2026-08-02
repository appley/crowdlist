import { getCrowdListRepository } from "../../../lib/data/d1-repository";

export async function GET() {
  const snapshot = await getCrowdListRepository().getStageOneSnapshot();
  return Response.json(snapshot, {
    headers: { "cache-control": "no-store" },
  });
}

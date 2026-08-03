import { identifySong } from "../../../lib/data/song-recognition";
import { getCrowdListRuntimeEnv } from "../../../lib/data/runtime-env";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    stageId?: string;
    audioBase64?: string;
    mimeType?: string;
  };
  if (!body.stageId || !body.audioBase64 || !body.mimeType) {
    return Response.json({ status: "error", message: "Stage and audio are required." }, { status: 400 });
  }

  const env = getCrowdListRuntimeEnv();
  const result = await identifySong(
    { stageId: body.stageId, audioBase64: body.audioBase64, mimeType: body.mimeType },
    {
      host: env.ACRCLOUD_HOST,
      accessKey: env.ACRCLOUD_ACCESS_KEY,
      accessSecret: env.ACRCLOUD_ACCESS_SECRET,
    },
  );
  return Response.json(result, { status: result.status === "error" ? 502 : 200 });
}

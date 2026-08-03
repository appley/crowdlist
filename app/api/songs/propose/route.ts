import { getCrowdListRepository } from "../../../../lib/data/d1-repository";
import { getCrowdListRuntimeEnv } from "../../../../lib/data/runtime-env";
import {
  cleanSongProposal,
  type SongProposalInput,
} from "../../../../lib/data/song-proposals";

function agreementThreshold() {
  const env = getCrowdListRuntimeEnv();
  if (env.CROWDLIST_DEMO_THRESHOLD_ENABLED === "true") return 1;
  const configured = Number.parseInt(env.CROWDLIST_AGREEMENT_THRESHOLD ?? "2", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : 2;
}

export async function POST(request: Request) {
  const input = cleanSongProposal((await request.json()) as SongProposalInput);
  if (!input) {
    return Response.json({ error: "Stage, song title, and artist are required." }, { status: 400 });
  }

  try {
    const result = await getCrowdListRepository().submitSongProposal(
      input,
      agreementThreshold(),
    );
    return Response.json(result, { status: 201 });
  } catch {
    return Response.json({ error: "Could not submit that song for this stage." }, { status: 400 });
  }
}

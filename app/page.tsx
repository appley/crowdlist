import { getCrowdListRepository } from "../lib/data/d1-repository";

export const dynamic = "force-dynamic";

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(new Date(iso));
}

export default async function Home() {
  const { stages, presence } = await getCrowdListRepository().getStageOneSnapshot();
  const presenceByStage = new Map<string, number>();
  for (const item of presence) {
    presenceByStage.set(item.stageId, (presenceByStage.get(item.stageId) ?? 0) + 1);
  }
  const lineupSlots = stages.reduce((sum, stage) => sum + stage.lineup.length, 0);
  const newestHeartbeat = presence.reduce(
    (latest, item) => (item.updatedAt > latest ? item.updatedAt : latest),
    "",
  );

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">CL</span>
          <span>CrowdList</span>
        </div>
        <span className="stage-badge">Stage 1 · backend inspector</span>
      </header>

      <section className="hero">
        <p className="eyebrow">Outside Lands 2026 · Golden Gate Park</p>
        <h1>The festival data layer is alive.</h1>
        <p className="hero-copy">
          This is the Stage 1 verification surface: real stages and Friday set times,
          plus raw simulated presence records. Product logic and the Expo screens are
          intentionally not active yet.
        </p>
      </section>

      <section className="metrics" aria-label="Backend summary">
        <article>
          <span className="metric-value">{stages.length}</span>
          <span className="metric-label">stages seeded</span>
        </article>
        <article>
          <span className="metric-value">{lineupSlots}</span>
          <span className="metric-label">lineup slots</span>
        </article>
        <article>
          <span className="metric-value">{presence.length}</span>
          <span className="metric-label">presence records</span>
        </article>
        <article>
          <span className="metric-value metric-time">
            {newestHeartbeat ? formatTime(newestHeartbeat) : "—"}
          </span>
          <span className="metric-label">newest heartbeat</span>
        </article>
      </section>

      <section className="section-heading">
        <div>
          <p className="eyebrow">D1 snapshot</p>
          <h2>Seeded stages</h2>
        </div>
        <p>Presence values below are raw Stage 1 records, not the Stage 2 two-minute crowd calculation.</p>
      </section>

      {stages.length === 0 ? (
        <section className="empty-state">
          <h2>No seed data yet</h2>
          <p>Run the Stage 1 seed and simulator scripts, then refresh this page.</p>
        </section>
      ) : (
        <section className="stage-grid">
          {stages.map((stage) => {
            const next = stage.lineup[0];
            const last = stage.lineup.at(-1);
            return (
              <article className="stage-card" key={stage.id}>
                <div className="stage-card-top">
                  <div>
                    <p className="stage-id">{stage.id}</p>
                    <h3>{stage.name}</h3>
                  </div>
                  <span className="presence-pill">{presenceByStage.get(stage.id) ?? 0} nearby</span>
                </div>
                <dl>
                  <div>
                    <dt>Coordinates</dt>
                    <dd>{stage.lat.toFixed(5)}, {stage.lng.toFixed(5)}</dd>
                  </div>
                  <div>
                    <dt>Friday sets</dt>
                    <dd>{stage.lineup.length}</dd>
                  </div>
                </dl>
                {next && last ? (
                  <div className="lineup-window">
                    <span>{formatTime(next.startTs)} · {next.artist}</span>
                    <span>{formatTime(last.startTs)} · {last.artist}</span>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      )}

      <footer>
        <span className="status-dot" aria-hidden="true" />
        Stage 1 ready for review · Stage 2 has not started
      </footer>
    </main>
  );
}

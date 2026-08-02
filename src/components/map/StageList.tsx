import { CROWD_LABEL, ENERGY_LABEL, TREND_LABEL } from "../../lib/pulse";
import { scheduleAt } from "../../lib/schedule";
import { STAGES } from "../../data/festival";
import type { StagePulse } from "../../types";

interface StageListProps {
  pulses: StagePulse[];
  selectedStageId: string;
  onSelectStage: (stageId: string) => void;
}

export function StageList({ pulses, selectedStageId, onSelectStage }: StageListProps) {
  const pulseByStage = new Map(pulses.map((pulse) => [pulse.stageId, pulse]));

  return (
    <div className="stage-list" data-testid="stage-list">
      <p className="stage-list__note">
        The live map needs graphics support this browser doesn’t offer. Every stage
        pulse is listed below.
      </p>
      <ul>
        {STAGES.map((stage) => {
          const pulse = pulseByStage.get(stage.id);
          const schedule = scheduleAt(stage.id);
          return (
            <li key={stage.id}>
              <button
                type="button"
                className="stage-list__item"
                style={{ "--stage-accent": stage.accent } as React.CSSProperties}
                aria-pressed={stage.id === selectedStageId}
                onClick={() => onSelectStage(stage.id)}
              >
                <span className="stage-list__name">{stage.name}</span>
                <span className="stage-list__meta">
                  {pulse
                    ? `${CROWD_LABEL[pulse.crowd]} · ${ENERGY_LABEL[pulse.energy]} · ${TREND_LABEL[pulse.trend]}`
                    : "No pulse yet"}
                </span>
                <span className="stage-list__now">
                  {schedule.now ? `Now: ${schedule.now.name}` : "Between sets"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

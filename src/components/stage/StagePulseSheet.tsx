import { ArrowDownRight, ArrowRight, ArrowUpRight, Clock3, MessageCircleMore, Music2 } from "lucide-react";
import { formatClock, scheduleAt } from "../../lib/schedule";
import { CROWD_LABEL, ENERGY_LABEL, TREND_LABEL } from "../../lib/pulse";
import type { SongMatch, SongRecognitionInput, SongRecognitionResponse, SongSignal, Stage, StagePulse } from "../../types";
import { SongRecognition } from "./SongRecognition";

interface StagePulseSheetProps {
  stage: Stage;
  pulse: StagePulse;
  now: Date;
  songSignal?: SongSignal;
  onReport: () => void;
  recognizeSong?: (input: SongRecognitionInput) => Promise<SongRecognitionResponse>;
  confirmSong?: (match: SongMatch) => Promise<void>;
}

const TrendIcon = {
  rising: ArrowUpRight,
  steady: ArrowRight,
  falling: ArrowDownRight,
};

export function StagePulseSheet({ stage, pulse, now, songSignal, onReport, recognizeSong, confirmSong }: StagePulseSheetProps) {
  const schedule = scheduleAt(stage.id, now);
  const Icon = TrendIcon[pulse.trend];
  const communityReportCount = pulse.source === "mixed"
    ? Math.max(1, pulse.reportCount - (pulse.baselineCount ?? pulse.reportCount - 1))
    : pulse.source === "community"
      ? pulse.reportCount
      : 0;

  return (
    <section className="stage-sheet" aria-label={`${stage.name} live activity`}>
      <div className="stage-sheet__handle" aria-hidden="true" />
      <div className="stage-sheet__header">
        <div>
          <p className="stage-sheet__zone">{stage.zone}</p>
          <h1>{stage.name}</h1>
        </div>
        <div className={`crowd-pill crowd-pill--${pulse.crowd}`}>
          <span className="crowd-pill__dot" aria-hidden="true" />
          {CROWD_LABEL[pulse.crowd]}
        </div>
      </div>

      <div className="pulse-summary">
        <div className="pulse-summary__item">
          <span className="pulse-summary__label">Energy</span>
          <strong>{ENERGY_LABEL[pulse.energy]}</strong>
        </div>
        <div className="pulse-summary__divider" aria-hidden="true" />
        <div className="pulse-summary__item">
          <span className="pulse-summary__label">Flow</span>
          <strong className="trend-value">
            <Icon size={16} aria-hidden="true" /> {TREND_LABEL[pulse.trend]}
          </strong>
        </div>
        <div className="pulse-summary__divider" aria-hidden="true" />
        <div className="pulse-summary__item">
          <span className="pulse-summary__label">Fresh</span>
          <strong>{pulse.freshnessMinutes === 0 ? "Now" : `${pulse.freshnessMinutes}m`}</strong>
        </div>
      </div>

      <div className="now-next" aria-label="Now and next performance">
        <div className="performance-row performance-row--now">
          <div className="performance-row__icon"><Music2 size={17} aria-hidden="true" /></div>
          <div className="performance-row__copy">
            <span>{schedule.now ? "On stage" : "Between sets"}</span>
            <strong>{schedule.now?.name ?? "A little breathing room"}</strong>
          </div>
          {schedule.now ? <time>{formatClock(schedule.now.end)} end</time> : null}
        </div>
        <div className="performance-row">
          <div className="performance-row__icon"><Clock3 size={17} aria-hidden="true" /></div>
          <div className="performance-row__copy">
            <span>Next</span>
            <strong>{schedule.next?.name ?? "That’s the final set"}</strong>
          </div>
          {schedule.next ? <time>{formatClock(schedule.next.start)}</time> : null}
        </div>
      </div>

      {pulse.summary ? (
        <p className="fan-observation">
          <MessageCircleMore size={15} aria-hidden="true" />
          <span>“{pulse.summary}”</span>
        </p>
      ) : null}

      <SongRecognition
        stage={stage}
        scheduledArtist={schedule.now?.name}
        signal={songSignal}
        recognizeSong={recognizeSong}
        confirmSong={confirmSong}
      />

      <div className="stage-sheet__footer">
        <div className="report-proof">
          <MessageCircleMore size={16} aria-hidden="true" />
          <span>
            {communityReportCount > 0
              ? `${communityReportCount} live fan ${communityReportCount === 1 ? "pulse" : "pulses"}`
              : "Simulated festival baseline"}
          </span>
          <span aria-hidden="true">·</span>
          <a href="https://data.jambase.com/outsidellms" target="_blank" rel="noreferrer">Lineup by JamBase</a>
          <span aria-hidden="true">·</span>
          <a href="https://www.sfoutsidelands.com/schedule/" target="_blank" rel="noreferrer">Times by OSL</a>
        </div>
        <button className="report-button" type="button" onClick={onReport}>
          Add your pulse
          <ArrowUpRight size={19} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

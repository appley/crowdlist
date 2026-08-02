import { useEffect, useRef, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { CROWD_LABEL, ENERGY_LABEL } from "../../lib/pulse";
import type { CrowdLevel, EnergyLevel, ReportInput, Stage, Trend } from "../../types";

interface ReportComposerProps {
  stage: Stage;
  anonId: string;
  onClose: () => void;
  onSubmit: (report: ReportInput) => Promise<void>;
}

const CROWD_OPTIONS: CrowdLevel[] = ["easy", "comfortable", "busy", "packed"];
const ENERGY_OPTIONS: EnergyLevel[] = ["low", "medium", "high"];

function inferTrend(crowd: CrowdLevel): Trend {
  if (crowd === "packed" || crowd === "busy") return "rising";
  if (crowd === "easy") return "falling";
  return "steady";
}

export function ReportComposer({ stage, anonId, onClose, onSubmit }: ReportComposerProps) {
  const [crowd, setCrowd] = useState<CrowdLevel | null>(null);
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submit = async () => {
    if (!crowd || !energy || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        stageId: stage.id,
        crowd,
        energy,
        trend: inferTrend(crowd),
        text: text.trim() || undefined,
        anonId,
      });
      onClose();
    } catch {
      setError("That pulse didn’t send. Check your connection and try once more.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="report-composer" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <div className="report-composer__header">
          <div>
            <span className="report-composer__eyebrow">Fresh from {stage.name}</span>
            <h2 id="report-title">What’s the pulse?</h2>
          </div>
          <button ref={closeRef} className="icon-button" type="button" onClick={onClose} aria-label="Close report">
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <fieldset className="choice-group">
          <legend><span>1</span> How easy is it to move?</legend>
          <div className="choice-grid choice-grid--crowd">
            {CROWD_OPTIONS.map((option) => (
              <button
                type="button"
                className={`choice-chip choice-chip--${option}`}
                aria-pressed={crowd === option}
                onClick={() => setCrowd(option)}
                key={option}
              >
                <span className="choice-chip__signal" aria-hidden="true" />
                {CROWD_LABEL[option]}
                {crowd === option ? <Check size={16} aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="choice-group">
          <legend><span>2</span> What’s the energy?</legend>
          <div className="choice-grid choice-grid--energy">
            {ENERGY_OPTIONS.map((option) => (
              <button
                type="button"
                className="choice-chip choice-chip--energy"
                aria-pressed={energy === option}
                onClick={() => setEnergy(option)}
                key={option}
              >
                {ENERGY_LABEL[option]}
                {energy === option ? <Check size={16} aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="report-note">
          <span>
            Add a detail <em>optional</em>
            <small><Sparkles size={13} aria-hidden="true" /> OpenAI turns it into a map signal</small>
          </span>
          <textarea
            value={text}
            maxLength={140}
            onChange={(event) => setText(event.target.value)}
            placeholder="Sutro is filling up, but there’s room by the back trees."
          />
          <span className="character-count">{text.length}/140</span>
        </label>

        <button
          className="submit-report"
          type="button"
          disabled={!crowd || !energy || submitting}
          onClick={submit}
        >
          {submitting ? "Sending pulse…" : "Send to the map"}
        </button>
        {error ? <p className="report-error" role="alert">{error}</p> : null}
        <p className="privacy-note">Anonymous · expires from the live pulse · location is never sent</p>
      </section>
    </div>
  );
}

import { Radio } from "lucide-react";

interface MapHeaderProps {
  status: "connecting" | "live" | "fixture" | "degraded";
}

const STATUS_LABEL = {
  connecting: "Syncing live",
  live: "Sim + live",
  fixture: "Simulated demo",
  degraded: "Demo backup",
};

export function MapHeader({ status }: MapHeaderProps) {
  return (
    <header className="map-header">
      <div className="brand-lockup" aria-label="CrowdList">
        <span className="brand-lockup__eyebrow">Outside Lands</span>
        <span className="brand-lockup__name">CrowdList</span>
      </div>
      <div className={`live-badge live-badge--${status}`} role="status">
        <Radio size={14} aria-hidden="true" />
        <span>{STATUS_LABEL[status]}</span>
      </div>
    </header>
  );
}

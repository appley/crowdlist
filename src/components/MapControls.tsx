import { Crosshair, LocateFixed, MapPinned } from "lucide-react";

interface MapControlsProps {
  onLocate: () => void;
  onDemoLocation: () => void;
  onRecenter: () => void;
  showDemoFallback: boolean;
  locating: boolean;
}

export function MapControls({
  onLocate,
  onDemoLocation,
  onRecenter,
  showDemoFallback,
  locating,
}: MapControlsProps) {
  return (
    <div className="map-controls" aria-label="Map controls">
      <button className="map-control" type="button" onClick={onRecenter} aria-label="View all stages">
        <MapPinned size={21} aria-hidden="true" />
      </button>
      <button
        className="map-control map-control--primary"
        type="button"
        onClick={onLocate}
        aria-label={locating ? "Finding your location" : "Find my location"}
        disabled={locating}
      >
        <LocateFixed size={21} aria-hidden="true" />
      </button>
      {showDemoFallback ? (
        <button className="map-control map-control--demo" type="button" onClick={onDemoLocation}>
          <Crosshair size={18} aria-hidden="true" />
          <span>Demo spot</span>
        </button>
      ) : null}
    </div>
  );
}

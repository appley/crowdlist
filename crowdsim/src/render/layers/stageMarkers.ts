import { ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { FestivalDay, Stage } from "../../data/schema";
import { currentSet } from "../../sim/schedule";

export function stageMarkers(day: FestivalDay, time: number, selectedStage: string | null, onPick: (stage: Stage) => void) {
  const points = new ScatterplotLayer<Stage>({
    id: "stage-points", data: day.site.stages, pickable: true,
    getPosition: (stage) => [stage.lng, stage.lat], getRadius: (stage) => selectedStage === stage.id ? 34 : 22,
    radiusUnits: "meters", getFillColor: (stage) => selectedStage === stage.id ? [214, 255, 79, 255] : [226, 231, 224, 240],
    getLineColor: [16, 19, 19, 255], stroked: true, lineWidthMinPixels: 2,
    onClick: (info) => { if (info.object) onPick(info.object); }, updateTriggers: { getRadius: [selectedStage], getFillColor: [selectedStage] },
  });
  const labels = new TextLayer<Stage>({
    id: "stage-labels", data: day.site.stages, getPosition: (stage) => [stage.lng, stage.lat],
    getText: (stage) => `${stage.name.toUpperCase()}\n${currentSet(day.sets, stage.id, time)?.artistName || "Between sets"}`,
    getSize: (stage) => selectedStage === stage.id ? 13 : 11, sizeUnits: "pixels", getColor: [238, 241, 236, 245],
    getTextAnchor: "middle", getAlignmentBaseline: "bottom", getPixelOffset: [0, -22], fontFamily: "Inter, Arial, sans-serif",
    fontWeight: 700, background: true, getBackgroundColor: [15, 18, 18, 205], backgroundPadding: [6, 4],
    updateTriggers: { getText: [time], getSize: [selectedStage] },
  });
  return [points, labels];
}

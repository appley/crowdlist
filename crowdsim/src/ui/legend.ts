export function createLegend(): HTMLElement {
  const element = document.createElement("aside");
  element.className = "legend";
  element.innerHTML = `<div class="legend-title">DENSITY · CONTRIBUTORS / H3 CELL</div><div class="legend-ramp"></div><div class="legend-labels"><span>5 · private floor</span><span>peak</span></div><p><i></i> Low confidence appears pale and translucent. Height and warmth both increase with contributor count.</p>`;
  return element;
}

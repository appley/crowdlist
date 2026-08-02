import type { FestivalSite, Set } from "../data/schema";

const artists = [
  ["Orion Sun", "The Marías", "Vampire Weekend", "Hozier", "Tyler, The Creator"],
  ["Fcukers", "Mk.gee", "Kaytranada", "Charli xcx", "Jamie xx"],
  ["Medium Build", "Amaarae", "Doechii", "Anderson .Paak", "St. Vincent"],
  ["La Doña", "Channel Tres", "Sammy Virji", "Floating Points", "The Blessed Madonna"],
  ["Nia Archives", "DJ Seinfeld", "Romy", "Barry Can’t Swim", "Four Tet"],
  ["Kenny Mason", "Mannequin Pussy", "Men I Trust", "Khruangbin", "The Postal Service"],
];

export function buildSchedule(site: FestivalSite, start: number, end: number): Set[] {
  const duration = 68 * 60_000;
  const gap = 28 * 60_000;
  const sets: Set[] = [];
  site.stages.forEach((stage, stageIndex) => {
    artists[stageIndex].forEach((artistName, slot) => {
      const startsAt = start + (slot * (duration + gap)) + ((stageIndex % 3) * 8 * 60_000);
      const endsAt = Math.min(end, startsAt + duration + (slot === 4 ? 28 * 60_000 : 0));
      sets.push({
        id: `${stage.id}-${slot}`,
        stageId: stage.id,
        artistName,
        startsAt,
        endsAt,
        popularity: Math.min(1, 0.28 + slot * 0.15 + ((stageIndex * 7 + slot * 3) % 5) * 0.025),
      });
    });
  });
  return sets.sort((a, b) => a.startsAt - b.startsAt || a.id.localeCompare(b.id));
}

export function currentSet(sets: Set[], stageId: string, t: number): Set | undefined {
  return sets.find((set) => set.stageId === stageId && set.startsAt <= t && set.endsAt > t);
}

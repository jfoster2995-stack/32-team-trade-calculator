// src/utils/picks.ts
const TEAMS = 32;

export const pickKey = (season: string | number, round: number, pick: number) =>
  `${season}-${round}-${pick}`;

export function overallFrom(round: number, pick: number, teams = TEAMS) {
  return (round - 1) * teams + pick;
}

export function buildPickName(season: string | number, round: number, pick: number) {
  return `${season} ${round}.${String(pick).padStart(2, "0")}`;
}

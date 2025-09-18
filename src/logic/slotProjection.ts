// src/logic/slotProjection.ts

// Minimal type for the bits we actually use
export type SleeperRoster = {
  roster_id: number;
  settings?: {
    wins?: number;   // total wins
    fpts?: number;   // total fantasy points for (can be fractional in Sleeper)
  };
};

/**
 * Safely coerce a value to a finite number (or a fallback).
 */
const toNum = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Core: compute reverse-standings draft slots for a set of rosters.
 * - Worst record picks first (slot = 1)
 * - Tiebreaker: lower points-for picks earlier
 * - Output: { [roster_id]: slotNumber }
 */
export function buildReverseOrderSlotProjection(
  rosters: SleeperRoster[],
  years?: Iterable<number | string> // kept for backwards-compat; ignored in calculation
): Record<number, number> {
  // Guard against non-iterables passed as `years`
  // (previous code crashed on "for (const y of years)" when years was undefined)
  const _years =
    years && typeof (years as any)[Symbol.iterator] === "function"
      ? Array.from(years)
      : [];

  // NOTE: If you ever want to return a per-year map, you could loop _years here.
  // For this app we always return a flat map for the active season.

  const list = Array.isArray(rosters) ? rosters.slice() : [];

  // Sort by: wins ASC (fewest first), then points-for ASC (fewest first)
  list.sort((a, b) => {
    const aw = toNum(a?.settings?.wins, 0);
    const bw = toNum(b?.settings?.wins, 0);
    if (aw !== bw) return aw - bw;

    const ap = toNum(a?.settings?.fpts, 0);
    const bp = toNum(b?.settings?.fpts, 0);
    if (ap !== bp) return ap - bp;

    // Final deterministic tie-breaker: roster_id ASC (stable order)
    return toNum(a?.roster_id, 0) - toNum(b?.roster_id, 0);
  });

  // Build slot map: index 0 -> slot 1 (worst team first)
  const out: Record<number, number> = {};
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const rid = toNum(r?.roster_id, -1);
    if (rid >= 0) out[rid] = i + 1;
  }

  return out;
}

/**
 * Friendly wrapper used by the page.
 * - Accepts rosters and optional years (ignored; kept to prevent call-site errors).
 * - Returns the flat map { roster_id -> slot } expected by computeOwnedPicks.
 */
export function buildSlotProjection(
  rosters: SleeperRoster[],
  years?: Iterable<number | string>
): Record<number, number> {
  return buildReverseOrderSlotProjection(rosters, years);
}

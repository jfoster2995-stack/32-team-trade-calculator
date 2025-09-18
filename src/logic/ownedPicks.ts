/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * This module exports computeOwnedPicks() exactly as TradeCalculatorPage.tsx expects:
 * computeOwnedPicks(leagueId, rosters, tradedPicks, slotProjection, pickMap) -> OwnedPicksResult
 *
 * - Builds all native picks for every roster across the seasons/rounds visible in pickMap.
 * - Applies trades from Sleeper's /traded_picks to reassign current ownership.
 * - Builds labels like "2026 1.01" using the origin roster's projected slot (reverse order).
 * - Looks up values from pickMap[label].
 * - Returns { byRosterId, byUserId, all } for PlayersTables.
 */

// -------- Types (kept local; no external deps) --------
type SleeperRoster = {
  roster_id: number;
  owner_id?: string;
  players?: any[];
  settings?: { wins?: number; fpts?: number };
};

type TradedPick = {
  season: number | string;
  round: number;
  roster_id: number;   // origin team (decides slot via slotProjection)
  owner_id: number;    // current owner (roster_id)
};

type OwnedPicksResult = {
  byUserId: Record<string, any[]>;
  byRosterId: Record<string, any[]>;
  all: any[];
};

// -------- Helpers --------
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Build "YYYY R.PP" label from season/round and origin team's projected slot. */
const makeLabel = (
  season: number | string,
  round: number,
  originRosterId: number,
  slotProjection: Record<number, number>
): string => {
  const slot = slotProjection?.[originRosterId];
  if (!Number.isFinite(slot)) return `pick-${season}-${round}-${originRosterId}`;
  return `${season} ${round}.${pad2(Number(slot))}`;
};

/** Extract unique seasons/rounds present in pickMap keys of the form "2026 1.01". */
const inferSeasonsAndRounds = (pickMap: Record<string, number>) => {
  const seasons = new Set<string>();
  const rounds = new Set<number>();
  for (const k of Object.keys(pickMap)) {
    const m = k.match(/^(\d{4})\s+(\d+)\.\d{2}$/);
    if (!m) continue;
    seasons.add(m[1]);
    rounds.add(Number(m[2]));
  }
  return {
    seasons: Array.from(seasons).sort(),
    rounds: Array.from(rounds).sort((a, b) => a - b),
  };
};

// -------- Main API --------
export function computeOwnedPicks(
  _leagueId: string,
  rosters: SleeperRoster[],
  tradedPicks: TradedPick[],
  slotProjection: Record<number, number>,   // origin roster -> projected slot (1..32)
  pickMap: Record<string, number>           // { "YYYY R.PP": value }
): OwnedPicksResult {
  // 1) Discover seasons/rounds from your curve keys.
  const { seasons, rounds } = inferSeasonsAndRounds(pickMap);
  if (seasons.length === 0 || rounds.length === 0) {
    return { byUserId: {}, byRosterId: {}, all: [] };
    // (No curve keys → nothing to build)
  }

  // 2) Build native ownership for every (season,round,originRoster)
  //    then apply traded_picks to reassign current owner roster_id.
  type Key = string; // "YYYY-round-originRosterId"
  const currentOwnerByKey = new Map<Key, number>();
  const rosterIds = rosters.map(r => r.roster_id);

  for (const season of seasons) {
    for (const round of rounds) {
      for (const origin of rosterIds) {
        currentOwnerByKey.set(`${season}-${round}-${origin}`, origin);
      }
    }
  }

  for (const tp of tradedPicks) {
    const season = String(tp.season);
    const round = Number(tp.round);
    const origin = Number(tp.roster_id);
    const owner = Number(tp.owner_id);
    const key = `${season}-${round}-${origin}`;
    if (currentOwnerByKey.has(key)) {
      currentOwnerByKey.set(key, owner);
    }
    // If a traded pick references a season/round not in your curve, it’s skipped gracefully.
  }

  // 3) Flatten to "all" with labels + values
  const all: any[] = [];
  for (const [key, ownerRosterId] of currentOwnerByKey.entries()) {
    const [season, roundStr, originStr] = key.split("-");
    const round = Number(roundStr);
    const originRosterId = Number(originStr);

    const label = makeLabel(season, round, originRosterId, slotProjection);
    const value = Number(pickMap[label] ?? 0);

    all.push({
      season,
      round,
      roster_id: originRosterId,   // origin team
      owner_id: ownerRosterId,     // current owner roster_id
      pick_name: label,
      value,
    });
  }

  // 4) Group by current owner roster_id (and mirror for byUserId)
  const byRosterId: Record<string, any[]> = {};
  const byUserId:  Record<string, any[]> = {};

  for (const p of all) {
    const k = String(p.owner_id);
    if (!byRosterId[k]) byRosterId[k] = [];
    byRosterId[k].push(p);

    if (!byUserId[k]) byUserId[k] = [];
    byUserId[k].push(p);
  }

  // 5) Sort for stable display
  const cmp = (a: any, b: any) =>
    String(a.season).localeCompare(String(b.season)) ||
    Number(a.round) - Number(b.round) ||
    String(a.pick_name).localeCompare(String(b.pick_name));

  all.sort(cmp);
  for (const k of Object.keys(byRosterId)) byRosterId[k].sort(cmp);
  for (const k of Object.keys(byUserId))  byUserId[k].sort(cmp);

  return { byUserId, byRosterId, all };
}

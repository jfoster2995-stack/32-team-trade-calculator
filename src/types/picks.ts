// src/types/picks.ts
export type SleeperTradedPick = {
  season: string;          // "2026"
  round: number;           // 1..N
  roster_id: number;       // original team whose finish sets the slot
  owner_id: number;        // current owner of the pick
  previous_owner_id: number;
};

export type PickCurveRow = {
  season: string;          // "2026"
  round: number;           // 1..N
  pick: number;            // 1..32 (projected slot)
  overall_pick: number;    // e.g. (round-1)*32 + pick
  pick_name: string;       // "2026 1.01"
  value: number;           // your curve value
};

export type DisplayPick = {
  id: string;              // stable React key
  season: string;
  round: number;
  pick: num

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import PlayersTables from "../components/PlayersTables";
import {
  getUser,
  getLeagues as getLeagues,
  getRosters,
  getTradedPicks,
  getPlayersMap,
} from "../api/sleeper";
import {
  loadValuesCSV as loadValues,
  loadPickValuesCSV as loadPickValues,
} from "../data/loaders";
import { computeOwnedPicks } from "../logic/ownedPicks";
import { buildSlotProjection } from "../logic/slotProjection";

/* ----------------------
   Types (loose, resilient)
----------------------- */
type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
};

type SleeperRoster = {
  roster_id: number;
  owner_id?: string;
  players?: any[];
  settings?: { wins?: number; fpts?: number };
};

type TradedPick = {
  season: number;
  round: number;
  roster_id: number; // origin team (who the pick belongs to)
  owner_id: number;  // current owner (roster_id)
};

type ValueRow = {
  sleeper_id?: string | number;
  player_id?: string;
  id?: string | number;
  name?: string;
  Name?: string;
  full_name?: string;
  team?: string;
  positions?: string[] | string;
  new_pos_for_value?: string;
  Pos?: string; // ensure we can check 'DEF'
  Tier?: number | string;
  Age?: number | string;
  value_final_1000?: number | string;
  uid?: string;
};

type PickCurveRow = {
  pick_name: string; // e.g., "2026 1.01"
  value: number;
};

type OwnedPicksResult = {
  byUserId: Record<string, any[]>;
  byRosterId: Record<string, any[]>;
  all: any[];
};

/* ----------------------
   Utilities
----------------------- */
const num = (x: any) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};

const safeArray = <T,>(x: any): T[] =>
  Array.isArray(x) ? x : Array.isArray(x?.rows) ? x.rows : Array.isArray(x?.data) ? x.data : [];

const normalizePositions = (p: any): string[] => {
  if (Array.isArray(p?.positions)) return p.positions;
  if (typeof p?.positions === "string" && p.positions.trim().length) {
    return p.positions.split(/[;,|/]/g).map((s: string) => s.trim()).filter(Boolean);
  }
  return p?.new_pos_for_value ? [String(p.new_pos_for_value)] : [];
};

const withUid = (p: ValueRow, idx: number): ValueRow => {
  const primary =
    p.sleeper_id ?? p.player_id ?? p.id ?? p.Name ?? p.name ?? p.full_name ?? `fallback-${idx}`;

  const uid = String(primary);
  return {
    ...p,
    uid,
    positions: normalizePositions(p),
    value_final_1000:
      p?.value_final_1000 !== undefined && p?.value_final_1000 !== null
        ? Number(p.value_final_1000)
        : 0,
    Tier:
      (p as any)?.Tier !== undefined && (p as any)?.Tier !== null && (p as any)?.Tier !== ""
        ? Number((p as any).Tier)
        : (p as any)?.tier,
  } as any;
};

const pickValuesToMap = (rows: PickCurveRow[]): Record<string, number> => {
  const m: Record<string, number> = {};
  for (const r of rows) if (r?.pick_name) m[r.pick_name] = Number(r.value ?? 0);
  return m;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFKD").replace(/\s+/g, " ").trim();

const includesAll = (hay: string, needle: string) => {
  if (!needle) return true;
  const words = needle.split(" ");
  return words.every((w) => hay.includes(w));
};

/** Build canonical label like "2026 1.02" using season/round and origin's projected slot. */
function pickLabelFrom(pk: any, slotProjection: Record<number, number>) {
  const season = Number(pk?.season ?? pk?.year);
  const round = Number(pk?.round);
  const originRoster = Number(pk?.roster_id);
  const slot = Number(slotProjection?.[originRoster]);

  if (Number.isFinite(season) && Number.isFinite(round) && Number.isFinite(slot)) {
    return `${season} ${round}.${pad2(slot)}`;
  }
  if (pk?.pick_name) return String(pk.pick_name);
  return `pick-${season || "?"}-${round || "?"}-${originRoster || "?"}-${pk?.owner_id ?? "?"}`;
}

/* quick letter grade from difference percentage, unchanged */
function gradeFromEdge(edgePct: number): string {
  if (edgePct >= 15) return "A+";
  if (edgePct >= 10) return "A";
  if (edgePct >= 7)  return "A-";
  if (edgePct >= 5)  return "B+";
  if (edgePct >= 3)  return "B";
  if (edgePct >= 0)  return "B-";
  if (edgePct > 0)  return "C";
  if (edgePct > -5)  return "C-";
  if (edgePct > -10) return "D";
  return "F";
}

/* ----------------------
   Asset builders (for trade sides)
----------------------- */
type Asset = { kind: "player" | "pick"; id: string; label: string; val: number };

function toAssetFromPlayer(p: any): Asset {
  const sid = String(p?.uid ?? p?.player_id ?? p?.sleeper_id ?? p?.id ?? "");
  const id = `player:${sid}`;
  const label = String(p?.name ?? p?.full_name ?? p?.Name ?? "Unknown");
  const val = num(p?.value_final_1000);
  return { kind: "player", id, label, val };
}

function toAssetFromPick(
  pk: any,
  pickValues: Record<string, number>,
  proj: Record<number, number>
): Asset {
  const label = pickLabelFrom(pk, proj);
  const val = num(pickValues?.[label]);
  const id = `pick:${label}`;
  return { kind: "pick", id, label, val };
}

/* ----------------------
   Component
----------------------- */
export default function TradeCalculatorPage() {
  // Controls
  const [username, setUsername] = useState<string>("");
  const [season, setSeason] = useState<string>(new Date().getFullYear().toString());
  const [leagues, setLeagues] = useState<SleeperLeague[]>([]);
  const [leagueId, setLeagueId] = useState<string>("");

  // Data
  const [values, setValues] = useState<ValueRow[]>([]);
  const [pickValues, setPickValues] = useState<PickCurveRow[]>([]);
  const [rosters, setRosters] = useState<SleeperRoster[]>([]);
  const [tradedPicks, setTradedPicks] = useState<TradedPick[]>([]);
  const [slotProjection, setSlotProjection] = useState<Record<number, number>>({});
  const [owned, setOwned] = useState<OwnedPicksResult | null>(null);
  const [myRoster, setMyRoster] = useState<SleeperRoster | null>(null);
  const [playersMeta, setPlayersMeta] = useState<Record<string, any>>({});

  // Trade selections
  const [sideA, setSideA] = useState<Asset[]>([]);
  const [sideB, setSideB] = useState<Asset[]>([]);

  // UI
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("");

  // FIXED: keep hidden keys INSIDE component (hooks must be in component body)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // Keys for rows (so list filtering matches the asset IDs)
  const keyFromPlayerRow = useCallback((v: ValueRow) => {
    const sid = String(v?.sleeper_id ?? (v as any)?.id ?? v?.uid ?? "");
    return `player:${sid}`;
  }, []);
  const keyFromPickRow = useCallback((pk: any) => {
    const label = String(pk?.display ?? pickLabelFrom(pk, slotProjection));
    return `pick:${label}`;
  }, [slotProjection]);

  // Hide/show helpers that operate on Asset IDs
  const hideAsset = useCallback((asset: Asset) => {
    setHiddenIds(prev => {
      if (prev.has(asset.id)) return prev;
      const next = new Set(prev);
      next.add(asset.id);
      return next;
    });
  }, []);

  const unhideById = useCallback((id: string) => {
    setHiddenIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Persist last-used
  useEffect(() => {
    try {
      const last = localStorage.getItem("blft:last");
      if (last) {
        const parsed = JSON.parse(last);
        if (parsed?.username) setUsername(parsed.username);
        if (parsed?.season) setSeason(parsed.season);
        if (parsed?.leagueId) setLeagueId(parsed.leagueId);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("blft:last", JSON.stringify({ username, season, leagueId }));
    } catch {}
  }, [username, season, leagueId]);

  // Fetch flows
  const onGetLeagues = useCallback(async () => {
    setStatus("Looking up user…");
    setLoading(true);
    try {
      const user = await getUser(username.trim());
      const list = await getLeagues(user.user_id, season);
      setLeagues(list ?? []);
      setStatus(`Found ${list?.length ?? 0} leagues`);
    } catch (e: any) {
      console.error(e);
      setStatus("Failed to fetch leagues");
      setLeagues([]);
    } finally {
      setLoading(false);
    }
  }, [username, season]);

  const onSubmit = useCallback(async () => {
    if (!leagueId) return;
    setLoading(true);
    setStatus("Loading values & picks…");
    try {
      const valuesRaw = safeArray<ValueRow>(await loadValues());
      const valuesNorm = valuesRaw.map(withUid);
      setValues(valuesNorm);

      const pickCurveRaw = safeArray<PickCurveRow>(await loadPickValues());
      const pickCurve = pickCurveRaw.map((r) => ({ pick_name: String(r.pick_name), value: Number(r.value ?? 0) }));
      setPickValues(pickCurve);

      setStatus("Loading rosters, traded picks & players meta…");
      const r = safeArray<SleeperRoster>(await getRosters(leagueId));
      const tp = safeArray<TradedPick>(await getTradedPicks(leagueId));
      const meta = (await getPlayersMap(leagueId)) ?? {};
      setPlayersMeta(meta);

      const projection = buildSlotProjection(r);
      setSlotProjection(projection);

      // Resolve my roster
      const user = await getUser(username.trim());
      const mine = r.find((rr) => rr.owner_id === user.user_id) ?? null;
      const finalMyRoster = mine ?? (r.find((rr) => Array.isArray(rr.players) && rr.players.length > 0) ?? r[0] ?? null);
      setMyRoster(finalMyRoster);

      // Compute owned picks
      const pickMap = pickValuesToMap(pickCurve);
      const ownedRes = computeOwnedPicks(leagueId, r, tp, projection, pickMap);
      setOwned(ownedRes);

      setRosters(r);
      setTradedPicks(tp);
      setStatus("Ready");
      setSideA([]); setSideB([]);
      setHiddenIds(new Set()); // reset hidden on new submit
    } catch (e: any) {
      console.error(e);
      setStatus("Failed to load league data");
      setRosters([]); setTradedPicks([]); setOwned(null); setPlayersMeta({});
    } finally {
      setLoading(false);
    }
  }, [leagueId, username]);

  /* ----------------------
     Derived data for PlayersTables
  ----------------------- */

  // 1) Build roster_id -> DEF team code map by scanning each roster for a DEF in values
  const rosterDefById = useMemo(() => {
    const map: Record<string, string> = {};
    if (!Array.isArray(rosters) || rosters.length === 0) return map;

    const isTeamCode = (x: unknown) =>
      typeof x === "string" && /^[A-Z]{2,3}$/.test(x);

    const valueById = new Map<string, any>(
      (values ?? []).map((row: any) => [
        String(row?.sleeper_id ?? row?.id ?? row?.player_id ?? row?.uid ?? ""),
        row,
      ])
    );

    for (const r of rosters) {
      const rid = String(r.roster_id);
      if (map[rid]) continue;

      const ids: any[] = Array.isArray(r.players) ? r.players : [];

      const direct = ids.find((pid) => isTeamCode(pid));
      if (isTeamCode(direct)) {
        map[rid] = String(direct);
        continue;
      }

      for (const pid of ids) {
        const meta = playersMeta?.[String(pid)];
        if (meta?.position === "DEF") {
          const code = String(meta?.team ?? pid).toUpperCase();
          if (isTeamCode(code)) {
            map[rid] = code;
            break;
          }
        }
      }
      if (map[rid]) continue;

      const defRow = ids
        .map((pid) => valueById.get(String(pid)))
        .find((row) => String(row?.Pos ?? row?.positions ?? "").includes("DEF"));

      const code =
        (defRow?.Name ?? defRow?.name ?? defRow?.Team)?.toString().toUpperCase();
      if (code && isTeamCode(code)) {
        map[rid] = code;
      }
    }

    return map;
  }, [rosters, playersMeta, values]);

  const ownerByPlayerId = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rosters ?? []) {
      const list = Array.isArray(r.players) ? r.players : [];
      for (const pid of list) m[String(pid)] = r.roster_id;
    }
    return m;
  }, [rosters]);

  // All players & my players (raw)
  const allPlayersForTables = useMemo(() => {
    return (values ?? []).map((v) => {
      const id = String(v?.sleeper_id ?? (v as any)?.id ?? v?.uid ?? "");
      const owner_roster_id = ownerByPlayerId[id] ?? null; // null = FA / unknown
      return { ...v, owner_roster_id };
    });
  }, [values, ownerByPlayerId]);

  const myPlayersForTables = useMemo(() => {
    if (!myRoster || !Array.isArray(myRoster.players)) return [];
    const ids = new Set((myRoster.players ?? []).map((x) => String(x)));
    return values.filter((v) => ids.has(String(v.sleeper_id ?? (v as any).id ?? v.uid)));
  }, [values, myRoster]);

  // Pick value map
  const pickValueMap = useMemo(() => pickValuesToMap(pickValues), [pickValues]);

  // 2) Build pick rows WITH owner_roster_id & roster_id for “Owned by / From”
  const toPickRow = useCallback(
    (pk: any) => {
      const display = pickLabelFrom(pk, slotProjection);
      const season = Number(pk?.season ?? pk?.year ?? display?.split(" ")?.[0] ?? NaN);
      const round = Number(pk?.round ?? display?.split(" ")?.[1]?.split(".")?.[0] ?? NaN);
      const projSlot = slotProjection?.[Number(pk?.roster_id)] ?? Number(display?.split(".")?.[1] ?? NaN);

      return {
        season,
        round,
        pick: projSlot,
        overall_pick: undefined,
        display,
        value: pickValueMap[display] ?? 0,

        owner_roster_id: Number(pk?.owner_id ?? pk?.owner_roster_id ?? NaN), // current holder
        roster_id: Number(pk?.roster_id ?? NaN),                              // origin
      };
    },
    [slotProjection, pickValueMap]
  );

  const myPicksForTables = useMemo(() => {
    if (!owned || !myRoster) return [];
    const list =
      owned.byRosterId?.[String(myRoster.roster_id)] ?? owned.byRosterId?.[myRoster.roster_id] ?? [];
    return safeArray<any>(list).map(toPickRow);
  }, [owned, myRoster, toPickRow]);

  const allPicksForTables = useMemo(() => {
    if (!owned) return [];
    return safeArray<any>(owned.all).map(toPickRow);
  }, [owned, toPickRow]);

  /* ----------------------
     Filters
  ----------------------- */

  // My row filters (search + position + value)
  const [mySearch, setMySearch] = useState("");
  const [myPos, setMyPos] = useState("all"); // QB/RB/WR/TE/DL/LB/DB/K/DEF/all
  const [myValMin, setMyValMin] = useState(0);
  const [myValMax, setMyValMax] = useState(1000);

  // All row filters (search + position + team + value)
  const [allSearch, setAllSearch] = useState("");
  const [allPos, setAllPos] = useState("all");
  const [allTeamRosterId, setAllTeamRosterId] = useState<string>("all"); // roster_id or "all"
  const [allValMin, setAllValMin] = useState(0);
  const [allValMax, setAllValMax] = useState(1000);

  // helpers
  const matchPos = (row: any, sel: string) => {
    if (sel === "all") return true;
    const pos = String(row?.Pos ?? "");
    return pos.split("/").some((p) => p.trim() === sel) || pos.includes(sel);
  };
  const matchSearchPlayer = (row: any, q: string) => {
    if (!q) return true;
    const hay = norm(`${row?.Name ?? row?.name ?? row?.full_name ?? ""} ${row?.Team ?? ""} ${row?.Pos ?? ""}`);
    return includesAll(hay, norm(q));
  };
  const matchSearchPick = (row: any, q: string) => {
    if (!q) return true;
    const hay = norm(`${row?.display ?? ""} ${row?.season ?? ""} ${row?.round ?? ""} ${row?.pick ?? ""}`);
    return includesAll(hay, norm(q));
  };
  const matchVal = (val: number | string | undefined | null, min: number, max: number) => {
    const v = num(val ?? 0);
    return v >= min && v <= max;
  };
  const matchTeamByOwner = (ownerRosterId: any, sel: string) => {
    if (sel === "all") return true;
    return String(ownerRosterId ?? "") === sel;
  };

  // Apply base filters
  const myPlayersFiltered = useMemo(
    () =>
      myPlayersForTables.filter(
        (p) =>
          matchSearchPlayer(p, mySearch) &&
          matchPos(p, myPos) &&
          matchVal(p?.value_final_1000, myValMin, myValMax)
      ),
    [myPlayersForTables, mySearch, myPos, myValMin, myValMax]
  );

  const myPicksFiltered = useMemo(
    () =>
      myPicksForTables.filter((pk) =>
        matchVal(pk?.value, myValMin, myValMax)
      ).filter((pk) => matchSearchPick(pk, mySearch)),
    [myPicksForTables, mySearch, myValMin, myValMax]
  );

  const allPlayersFiltered = useMemo(
    () =>
      allPlayersForTables.filter(
        (p) =>
          matchSearchPlayer(p, allSearch) &&
          matchPos(p, allPos) &&
          matchVal(p?.value_final_1000, allValMin, allValMax) &&
          matchTeamByOwner((p as any)?.owner_roster_id, allTeamRosterId)
      ),
    [allPlayersForTables, allSearch, allPos, allValMin, allValMax, allTeamRosterId]
  );

  const allPicksFiltered = useMemo(
    () =>
      allPicksForTables
        .filter((pk) => matchSearchPick(pk, allSearch))
        .filter((pk) => matchVal(pk?.value, allValMin, allValMax))
        .filter((pk) => matchTeamByOwner(pk?.owner_roster_id, allTeamRosterId)),
    [allPicksForTables, allSearch, allValMin, allValMax, allTeamRosterId]
  );

  // FIXED: Apply hidden-ids on top of filtered sets so Send/Receive removes from lists
  const myPlayersVisible = useMemo(
    () => myPlayersFiltered.filter((p) => !hiddenIds.has(keyFromPlayerRow(p))),
    [myPlayersFiltered, hiddenIds, keyFromPlayerRow]
  );
  const myPicksVisible = useMemo(
    () => myPicksFiltered.filter((pk) => !hiddenIds.has(keyFromPickRow(pk))),
    [myPicksFiltered, hiddenIds, keyFromPickRow]
  );
  const allPlayersVisible = useMemo(
    () => allPlayersFiltered.filter((p) => !hiddenIds.has(keyFromPlayerRow(p))),
    [allPlayersFiltered, hiddenIds, keyFromPlayerRow]
  );
  const allPicksVisible = useMemo(
    () => allPicksFiltered.filter((pk) => !hiddenIds.has(keyFromPickRow(pk))),
    [allPicksFiltered, hiddenIds, keyFromPickRow]
  );

  // Build options for Team (Sleeper roster) filter
  const teamOptions = useMemo(() => {
    return Object.entries(rosterDefById)
      .map(([rid, code]) => ({ rid, code }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [rosterDefById]);

  /* ----------------------
     Trade math & handlers
  ----------------------- */
  const sideTotal = (assets: Asset[]) => assets.reduce((sum, a) => sum + num(a?.val), 0);
  const sideATotal = useMemo(() => sideTotal(sideA), [sideA]);
  const sideBTotal = useMemo(() => sideTotal(sideB), [sideB]);
  const edge = useMemo(() => sideATotal - sideBTotal, [sideATotal, sideBTotal]);
  const edgePct = useMemo(() => {
    const denom = Math.max(sideATotal, sideBTotal, 1);
    return Math.round((edge / denom) * 1000) / 10;
  }, [edge, sideATotal, sideBTotal]);
  const letter = useMemo(() => gradeFromEdge(edgePct), [edgePct]);

  const onReceivePlayer = useCallback((p: any) => {
    const a = toAssetFromPlayer(p);
    setSideA((prev) => (prev.find((x) => x.id === a.id) ? prev : [...prev, a]));
    setSideB((prev) => prev.filter((x) => x.id !== a.id));
    hideAsset(a); // hide from source lists
  }, [hideAsset]);

  const onSendPlayer = useCallback((p: any) => {
    const a = toAssetFromPlayer(p);
    setSideB((prev) => (prev.find((x) => x.id === a.id) ? prev : [...prev, a]));
    setSideA((prev) => prev.filter((x) => x.id !== a.id));
    hideAsset(a); // hide from source lists
  }, [hideAsset]);

  const onReceivePick = useCallback((pk: any) => {
    const a = toAssetFromPick(pk, pickValueMap, slotProjection);
    setSideA((prev) => (prev.find((x) => x.id === a.id) ? prev : [...prev, a]));
    setSideB((prev) => prev.filter((x) => x.id !== a.id));
    hideAsset(a);
  }, [pickValueMap, slotProjection, hideAsset]);

  const onSendPick = useCallback((pk: any) => {
    const a = toAssetFromPick(pk, pickValueMap, slotProjection);
    setSideB((prev) => (prev.find((x) => x.id === a.id) ? prev : [...prev, a]));
    setSideA((prev) => prev.filter((x) => x.id !== a.id));
    hideAsset(a);
  }, [pickValueMap, slotProjection, hideAsset]);

  // FIXED: pass BOTH side and id; also unhide by id so the asset returns to lists
  const removeFromSide = useCallback((side: "A" | "B", id: string) => {
    if (side === "A") setSideA((prev) => prev.filter((a) => a.id !== id));
    else setSideB((prev) => prev.filter((a) => a.id !== id));
    unhideById(id); // show back in source lists
  }, [unhideById]);

  const clearAll = useCallback(() => {
    setSideA([]);
    setSideB([]);
    setHiddenIds(new Set()); // reveal everything again
  }, []);

  /* ----------------------
     RENDER
----------------------- */

  return (
    <div className="max-w-5xl mx-auto px-3 py-4">
      {/* Header / Controls */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            32-Team IDP Trade Calculator for Sleeper Fantasy Football
          </h1>
          <p className="text-gray-600 mt-2 max-w-3xl">
            Enter your sleeper username and select your 32 team league to get started.
            The values in this trade calculator have been pulled from various sources
            to give you the most comprehensive evaluation of trades in a 32-team
            Independant Defensive Player league as possible.
          </p>
        </div>
        <img src="/images/BLFT_logo_final.png" alt="BLFT Logo" className="w-24 h-24 object-contain ml-4" />
      </div>

      <div className="sticky top-0 z-10 bg-white/80 dark:bg-neutral-900/80 backdrop-blur border-b border-neutral-200 dark:border-neutral-800 py-3 mb-4">
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Sleeper Username</label>
            <input
              className="input input-bordered h-9 px-2 rounded-md dark:bg-neutral-800"
              placeholder="e.g., RevengeTour2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Season</label>
            <input
              className="input input-bordered h-9 px-2 rounded-md w-24 dark:bg-neutral-800"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
            />
          </div>
          <button
            className="btn btn-sm rounded-md px-3 py-2 bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
            onClick={onGetLeagues}
            disabled={!username || !season || loading}
          >
            Get Leagues
          </button>
          <div className="flex flex-col min-w-[240px]">
            <label className="text-xs text-neutral-500">League</label>
            <select
              className="select select-bordered h-9 rounded-md dark:bg-neutral-800"
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
            >
              <option value="">Select a league…</option>
              {leagues.map((lg) => (
                <option key={lg.league_id} value={lg.league_id}>
                  {lg.name} ({lg.season})
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-sm rounded-md px-3 py-2 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            onClick={onSubmit}
            disabled={!leagueId || loading}
          >
            Submit
          </button>
          <div className="ml-auto text-xs text-neutral-500">
            {status}
            {loading ? "…" : ""}
          </div>
        </div>

        <div className="mt-2 text-xs text-neutral-500 flex gap-4">
          <span>Players: {values.length}</span>
          <span>Pick curve: {pickValues.length}</span>
          <span>Rosters: {rosters.length}</span>
          <span>Owned picks: {owned?.all?.length ?? 0}</span>
          {myRoster && <span className="text-emerald-600">my roster_id: {myRoster.roster_id}</span>}
        </div>
      </div>

      {/* ---------------- FILTER ROW #1: My Players + My Picks ---------------- */}
      <div className="mb-3 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <span className="i-lucide-search opacity-60" aria-hidden />
            <input
              className="w-full bg-transparent outline-none rounded-md border px-3 py-2 dark:bg-neutral-900/60"
              placeholder="Search my players or picks…"
              value={mySearch}
              onChange={(e) => setMySearch(e.target.value)}
            />
          </div>

          <select
            className="select select-bordered rounded-md dark:bg-neutral-900/60"
            value={myPos}
            onChange={(e) => setMyPos(e.target.value)}
            title="Position filter (multi-pos aware)"
          >
            <option value="all">All positions</option>
            <option value="QB">QB</option><option value="RB">RB</option>
            <option value="WR">WR</option><option value="TE">TE</option>
            <option value="DL">DL</option><option value="LB">LB</option>
            <option value="DB">DB</option><option value="K">K</option>
            <option value="DEF">DEF</option>
          </select>

          {/* Value slider (min/max) */}
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-70">≥</span>
            <input
              type="number"
              className="w-16 rounded-md border px-2 py-1 dark:bg-neutral-900/60"
              value={myValMin}
              min={0}
              max={1000}
              onChange={(e) => setMyValMin(Math.min(Number(e.target.value) || 0, myValMax))}
            />
            <span className="text-xs opacity-70">≤</span>
            <input
              type="number"
              className="w-16 rounded-md border px-2 py-1 dark:bg-neutral-900/60"
              value={myValMax}
              min={0}
              max={1000}
              onChange={(e) => setMyValMax(Math.max(Number(e.target.value) || 0, myValMin))}
            />
          </div>
        </div>
      </div>

      {/* Tables */}
      <PlayersTables
        myPlayers={myPlayersVisible}
        allPlayers={allPlayersVisible}
        myPicks={myPicksVisible}
        allPicks={allPicksVisible}
        playersMeta={playersMeta}
        rosterDefById={rosterDefById}
        onReceivePlayer={onReceivePlayer}
        onSendPlayer={onSendPlayer}
        onReceivePick={onReceivePick}
        onSendPick={onSendPick}
        context={{
          myPlayersShowSend: true,
          allPlayersShowReceive: true,
          myPicksShowSend: true,
          allPicksShowReceive: true,
        }}
        middleContent={
          <div className="mb-1 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <span className="i-lucide-search opacity-60" aria-hidden />
                <input
                  className="w-full bg-transparent outline-none rounded-md border px-3 py-2 dark:bg-neutral-900/60"
                  placeholder="Search all players or picks…"
                  value={allSearch}
                  onChange={(e) => setAllSearch(e.target.value)}
                />
              </div>

              <select
                className="select select-bordered rounded-md dark:bg-neutral-900/60"
                value={allPos}
                onChange={(e) => setAllPos(e.target.value)}
                title="Position filter (multi-pos aware)"
              >
                <option value="all">All positions</option>
                <option value="QB">QB</option><option value="RB">RB</option>
                <option value="WR">WR</option><option value="TE">TE</option>
                <option value="DL">DL</option><option value="LB">LB</option>
                <option value="DB">DB</option><option value="K">K</option>
                <option value="DEF">DEF</option>
              </select>

              <div className="flex items-center gap-2">
                <label className="text-xs opacity-70">Team</label>
                <select
                  className="select select-bordered rounded-md dark:bg-neutral-900/60"
                  value={allTeamRosterId}
                  onChange={(e) => setAllTeamRosterId(e.target.value)}
                  title="Filter by Sleeper roster"
                >
                  <option value="all">All</option>
                  {teamOptions.map(({ rid, code }) => (
                    <option key={rid} value={rid}>{code}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs opacity-70">≥</span>
                <input
                  type="number"
                  className="w-16 rounded-md border px-2 py-1 dark:bg-neutral-900/60"
                  value={allValMin}
                  min={0}
                  max={1000}
                  onChange={(e) => setAllValMin(Math.min(Number(e.target.value) || 0, allValMax))}
                />
                <span className="text-xs opacity-70">≤</span>
                <input
                  type="number"
                  className="w-16 rounded-md border px-2 py-1 dark:bg-neutral-900/60"
                  value={allValMax}
                  min={0}
                  max={1000}
                  onChange={(e) => setAllValMax(Math.max(Number(e.target.value) || 0, allValMin))}
                />
              </div>
            </div>
          </div>
        }
      />

      {/* Trade summary + controls */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Receive</h3>
            <span className="text-sm text-neutral-500">Total: {num(sideATotal).toFixed(0)}</span>
          </div>
          {sideA.length === 0 ? (
            <div className="text-sm text-neutral-500">No assets yet.</div>
          ) : (
            <ul className="space-y-1">
              {sideA.map((a) => (
                <li key={`A-${a.id}`} className="flex items-center justify-between gap-2">
                  <span className="truncate">{a.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-500">{num(a?.val).toFixed(0)}</span>
                    <button className="btn btn-xs rounded-md" onClick={() => removeFromSide("A", a.id)}>
                      remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Send</h3>
            <span className="text-sm text-neutral-500">Total: {num(sideBTotal).toFixed(0)}</span>
          </div>
          {sideB.length === 0 ? (
            <div className="text-sm text-neutral-500">No assets yet.</div>
          ) : (
            <ul className="space-y-1">
              {sideB.map((a) => (
                <li key={`B-${a.id}`} className="flex items-center justify-between gap-2">
                  <span className="truncate">{a.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-500">{num(a?.val).toFixed(0)}</span>
                    <button className="btn className=btn-xs rounded-md" onClick={() => removeFromSide("B", a.id)}>
                      remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Footer actions + grade */}
      <div className="mt-4 flex flex-col md:flex-row items-start md:items-center gap-3">
        <button className="btn rounded-md" onClick={clearAll}>Clear All</button>
        <div className="ml-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 p-3 w-full md:w-auto">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs text-neutral-500">GRADE FOR SIDE A</div>
              <div className="text-2xl font-semibold">{letter}</div>
              <div className="text-xs text-neutral-500">
                {edge >= 0 ? "+" : ""}
                {num(edge).toFixed(0)} value edge ({edgePct}%)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

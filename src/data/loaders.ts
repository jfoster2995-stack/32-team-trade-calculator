// src/data/loaders.ts

// ---------- Shared utils ----------

/** Tiny robust CSV parser: handles quotes, embedded commas & newlines. */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        const next = text[i + 1];
        if (next === '"') {
          cur += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(cur);
        cur = '';
      } else if (c === '\n') {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = '';
      } else if (c === '\r') {
        // normalize CRLF -> handle at LF
      } else {
        cur += c;
      }
    }
  }
  // flush last cell/row
  row.push(cur);
  if (row.length && !(row.length === 1 && row[0] === '')) rows.push(row);
  return rows;
}

const toNum = (v: unknown, d = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const pad2 = (n: number) => String(n).padStart(2, '0');

// ---------- Players (values.csv) ----------

export type PlayerRow = {
  sleeper_id: string;             // required key
  name?: string;
  Name?: string;                  // tolerate both
  team?: string;
  Team?: string;
  pos?: string;
  Pos?: string;
  tier?: string | number;
  Tier?: string | number;
  value_final_1000?: number;
  [k: string]: any;               // keep all original columns
};

export type LoadedPlayers = {
  rows: PlayerRow[];
  bySleeperId: Record<string, PlayerRow>;
  valueBySleeperId: Record<string, number>;
};

/**
 * Load player values from CSV.
 * Default path: /data/values.csv
 */
export async function loadValuesCSV(path = '/data/values.csv'): Promise<LoadedPlayers> {
  const text = await fetch(path).then(r => {
    if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`);
    return r.text();
  });

  const table = parseCSV(text.trim());
  if (table.length === 0) return { rows: [], bySleeperId: {}, valueBySleeperId: {} };

  const headers = table[0].map(h => h.trim());
  const idx = (name: string) => headers.indexOf(name);

  // Try common header variants
  const idCol = idx('sleeper_id') >= 0 ? 'sleeper_id' : headers.find(h => /sleeper.?id/i.test(h));
  if (!idCol) throw new Error('values.csv missing sleeper_id column');

  const valueCol =
    idx('value_final_1000') >= 0
      ? 'value_final_1000'
      : headers.find(h => /value[_ ]?final[_ ]?1000/i.test(h));

  const rows: PlayerRow[] = [];
  const bySleeperId: Record<string, PlayerRow> = {};
  const valueBySleeperId: Record<string, number> = {};

  for (let r = 1; r < table.length; r++) {
    const line = table[r];
    if (line.every(c => c.trim() === '')) continue;

    const obj: PlayerRow = {};
    headers.forEach((h, i) => (obj[h] = line[i]?.trim?.() ?? ''));

    const key = String(obj[idCol]).trim();
    if (!key) continue;

    // Normalize common fields (non-destructive: keep originals too)
    obj.sleeper_id = key;
    obj.value_final_1000 = valueCol ? toNum(obj[valueCol], undefined as any) : undefined;

    rows.push(obj);
    bySleeperId[key] = obj;
    if (obj.value_final_1000 != null) valueBySleeperId[key] = Number(obj.value_final_1000);
  }

  return { rows, bySleeperId, valueBySleeperId };
}

// ---------- Picks (draft_pick_values_2026_2028.csv) ----------

export type PickCurveRow = {
  pick_name: string;       // e.g., "2026 1.01"
  type?: string;           // keep if present
  value: number;

  season: number;
  round: number;
  pick: number;            // 1..32 (slot within round)
  overall_pick?: number;   // optional if provided
  [k: string]: any;        // keep all original columns
};

export type LoadedPickValues = {
  rows: PickCurveRow[];
  byPickName: Record<string, number>;           // "2026 1.01" -> value
  byTriple: Record<string, number>;             // "2026|1|1"   -> value
  bySeasonRoundPick: (s: number, r: number, p: number) => number | undefined;
};

export const pickKeyFromParts = (season: number, round: number, pick: number) =>
  `${season} ${round}.${pad2(pick)}`;

/** Overall (within a season): 1..224 for a 32-team league */
export const overallInSeason = (round: number, pick: number) =>
  (round - 1) * 32 + pick;

/** Cross-year cumulative overall (zero-indexed if zeroIndexed=true) */
export const overallCumulative = (
  season: number,
  round: number,
  pick: number,
  baseSeason = 2026,
  zeroIndexed = true
) => {
  const within = overallInSeason(round, pick); // 1..224
  const baseOffset = (season - baseSeason) * 224;
  return zeroIndexed ? baseOffset + within - 1 : baseOffset + within;
};

/**
 * Load draft pick curve with expanded columns.
 * Default path: /data/draft_pick_values_2026_2028.csv
 */
export async function loadPickValuesCSV(path = '/data/draft_pick_values_2026_2028.csv'): Promise<LoadedPickValues> {
  const text = await fetch(path).then(r => {
    if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`);
    return r.text();
  });

  const table = parseCSV(text.trim());
  if (table.length === 0) {
    const empty = {
      rows: [] as PickCurveRow[],
      byPickName: {} as Record<string, number>,
      byTriple: {} as Record<string, number>,
      bySeasonRoundPick: () => undefined as number | undefined,
    };
    return empty;
  }

  const headers = table[0].map(h => h.trim());
  const idx = (name: string) => headers.indexOf(name);

  const col = {
    pick_name: idx('pick_name'),
    type: idx('type'),
    value: idx('value'),
    season: idx('season'),
    round: idx('round'),
    pick: idx('pick'),
    overall_pick: idx('overall_pick'),
  };

  if (col.value < 0) throw new Error('pick values CSV missing "value" column');

  const rows: PickCurveRow[] = [];
  const byPickName: Record<string, number> = {};
  const byTriple: Record<string, number> = {};

  for (let r = 1; r < table.length; r++) {
    const line = table[r];
    if (line.every(c => c.trim() === '')) continue;

    const pick_nameRaw = col.pick_name >= 0 ? line[col.pick_name] : '';
    const type = col.type >= 0 ? line[col.type]?.trim() : undefined;
    const value = toNum(line[col.value], 0);

    // Prefer explicit season/round/pick columns; fall back to pick_name parsing.
    const season =
      col.season >= 0 ? toNum(line[col.season], NaN) :
      toNum(pick_nameRaw?.split(' ')[0], NaN);

    const round =
      col.round >= 0 ? toNum(line[col.round], NaN) :
      toNum(pick_nameRaw?.split(' ')[1]?.split('.')[0], NaN);

    const pick =
      col.pick >= 0 ? toNum(line[col.pick], NaN) :
      toNum(pick_nameRaw?.split('.')[1], NaN);

    const overall_pick =
      col.overall_pick >= 0 ? toNum(line[col.overall_pick], NaN) : undefined;

    // Build canonical pick_name
    const pick_name =
      pick_nameRaw?.trim() ||
      pickKeyFromParts(season, round, pick);

    const row: PickCurveRow = {
      pick_name,
      type,
      value,
      season,
      round,
      pick,
      overall_pick: Number.isFinite(overall_pick)
        ? overall_pick
        : undefined,
    };

    rows.push(row);
    byPickName[pick_name] = value;
    if (Number.isFinite(season) && Number.isFinite(round) && Number.isFinite(pick)) {
      byTriple[`${season}|${round}|${pick}`] = value;
    }
  }

  const bySeasonRoundPick = (s: number, r: number, p: number) =>
    byTriple[`${s}|${r}|${p}`];

  return { rows, byPickName, byTriple, bySeasonRoundPick };
}

// ---------- Compatibility aliases (so older imports still work) ----------
export const loadValues = loadValuesCSV;
export const loadPickValues = loadPickValuesCSV;

// ---------- Convenience: tiny safe array helper (optional to re-use) ----------
export const safeArray = <T,>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : []);

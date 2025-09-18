// src/data/loadPickCurve.ts
import Papa from "papaparse";
import type { PickCurveRow } from "../types/picks";
import { overallFrom, buildPickName } from "../utils/picks";

// Path defaults to your public CSV
export async function loadPickCurve(csvPath = "/data/draft_pick_values_2026_2028.csv") {
  const res = await fetch(csvPath);
  if (!res.ok) throw new Error(`Failed to load pick curve CSV at ${csvPath}`);
  const text = await res.text();

  const { data } = Papa.parse(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  const rows: PickCurveRow[] = (data as any[]).map((r) => {
    const season = String(r.season);
    const round = Number(r.round);
    const pick = Number(r.pick);
    const overall_pick = Number(
      r.overall_pick ?? overallFrom(round, pick, 32)
    );
    const pick_name =
      r.pick_name ?? buildPickName(season, round, pick);
    const value = Number(r.value ?? 0);

    return { season, round, pick, overall_pick, pick_name, value };
  });

  return rows;
}

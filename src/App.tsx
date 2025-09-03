import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Range } from "react-range";
import Papa from "papaparse";
import { Search, Trash2, Download } from "lucide-react";

/** ------------ Types ------------ */
type Asset = {
  id: string;
  name: string;
  pos?: string;           // e.g., "DL, LB" allowed
  team?: string;          // NFL team (players only)
  value: number;          // your precomputed value (0–1000 scale)
  age?: number;
  tier?: string;
  meta?: Record<string, any>;
  kind: "player" | "pick";
};

type SideItem = Asset;

/** ------------ Utils ------------ */
function tryNum(x: any): number {
  const n = typeof x === "number" ? x : parseFloat(String(x).replace(/[, $]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function downloadJSON(filename: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function gradeTrade(diff: number, base: number) {
  const denom = Math.max(1, Math.min(base, base + Math.abs(diff)));
  const pct = (diff / denom) * 100;
  if (pct >= 18) return { letter: "A+", color: "text-green-600" };
  if (pct >= 12) return { letter: "A", color: "text-green-600" };
  if (pct >= 7)  return { letter: "B+", color: "text-emerald-600" };
  if (pct >= 3)  return { letter: "B", color: "text-emerald-600" };
  if (pct >= 0)  return { letter: "B-", color: "text-emerald-600" };
  if (pct >= -3) return { letter: "C", color: "text-yellow-600" };
  if (pct >= -7) return { letter: "C-", color: "text-amber-700" };
  if (pct >= -12) return { letter: "D", color: "text-orange-700" };
  if (pct >= -18) return { letter: "D-", color: "text-red-600" };
  return { letter: "F", color: "text-red-700" };
}

/** ------------ Small UI bits ------------ */
function NumberStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-xl font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}

function AssetRow({
  a,
  onReceive,
  onSend,
}: {
  a: Asset;
  onReceive: (a: Asset) => void;
  onSend: (a: Asset) => void;
}) {
  const warn = a.kind === "player" && ((a.pos === "P") || !a.team);
  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded-2xl border hover:shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 w-2 h-8 rounded bg-gray-200" />
        <div className="min-w-0">
          <div className="font-medium truncate">{a.name}</div>
             <div className="text-xs text-gray-500">
                 {a.pos || a.kind.toUpperCase()} 
                  {a.team ? ` • ${a.team}` : ""}
  {a.age ? ` • ${a.age}y` : ""}
</div>
          {warn && (
            <div className="text-[11px] text-amber-600">
              Note: players with null team should probably be avoided.
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
  <div className="text-sm tabular-nums font-semibold">{a.value.toFixed(1)}</div>
  {a.tier && <div className="text-[12px] leading-3 text-gray-500">TIER: {a.tier}</div>}
</div>
        <button
          onClick={() => onReceive(a)}
          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm"
        >
          Receive
        </button>
        <button
          onClick={() => onSend(a)}
          className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm"
        >
          Send
        </button>
      </div>
    </div>
  );
}

function SideCard({
  title,
  items,
  onRemove,
  side,
  teamNeeds,
}: {
  title: string;
  items: SideItem[];
  onRemove: (id: string) => void;
  side: "A" | "B";
  teamNeeds: string[];
}) {
  const total = items.reduce((s, x) => s + x.value, 0);

  const isNeedMatch = (it: SideItem) => {
    if (!it.pos) return false;
    const posList = String(it.pos)
      .split(",")
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean);
    return teamNeeds.some((need) => posList.includes(need.toUpperCase()));
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4 flex-1">
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-semibold">{title}</div>
        <NumberStat label="Total Value" value={Math.round(total)} />
      </div>
      <div className="space-y-2">
        {items.length === 0 && <div className="text-sm text-gray-500">No assets yet.</div>}
        {items.map((it) => {
          const need = isNeedMatch(it);
          const overlay = need ? (side === "A" ? "bg-green-50" : "bg-red-50") : "";
          return (
            <div
              key={it.id}
              className={`flex items-center justify-between gap-2 p-2 rounded-xl border ${overlay}`}
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{it.name}</div>
<div className="text-xs text-gray-500">
  {it.pos || it.kind.toUpperCase()}
  {it.team ? ` • ${it.team}` : ""}
  {it.age ? ` • ${it.age}y` : ""}
</div>
              </div>
              <div className="flex items-center gap-2">
<div className="w-20 text-right">
  <div className="tabular-nums text-sm font-semibold">
    {it.value.toFixed(1)}
  </div>
  {it.tier && <div className="text-[12px] leading-3 text-gray-500">TIER: {it.tier}</div>}
</div>
                <button onClick={() => onRemove(it.id)} className="p-2 rounded-xl hover:bg-gray-100">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** ------------ Main App ------------ */
export default function TradeCalculatorApp() {
  // Data state
  const [players, setPlayers] = useState<Asset[]>([]);
  const [picks, setPicks] = useState<Asset[]>([]);

  // Controls
  const [query, setQuery] = useState("");
  const [includePicks, setIncludePicks] = useState(true);
  const [posFilter, setPosFilter] = useState<string>("All");
  const [teamFilter, setTeamFilter] = useState<string>("All");

  // Team needs (toggle buttons)
  const [teamNeeds, setTeamNeeds] = useState<string[]>([]);

  // Value range slider (dual thumb)
  const [minVal, setMinVal] = useState<number>(0);
  const [maxVal, setMaxVal] = useState<number>(1000);
  const MIN_GAP = 50; // enforce at least 50

  // Paging of visible items
  const [viewLimit, setViewLimit] = useState<number>(10); // default show 10 (5 per column)

  // Sides
  const [sideA, setSideA] = useState<SideItem[]>([]);
  const [sideB, setSideB] = useState<SideItem[]>([]);
  const csvUrl = new URL("values.csv", import.meta.env.BASE_URL).href;

  // Load your single CSV at startup (public/values.csv)
  useEffect(() => {
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (res) => {
        const rows = (res.data as any[]).filter(Boolean);
        const pl: Asset[] = [];
        const pk: Asset[] = [];
        rows.forEach((r, i) => {
          const name = (r.Name ?? r.name ?? "").toString().trim();
          const pos = (r.Pos ?? r.pos ?? "").toString().trim();   // allow "DL, LB"
          const team = (r.Team ?? r.team ?? "").toString().trim();
          const ageVal = r.Age ?? r.age ?? r.PlayerAge ?? r.player_age;
          const age = Number.isFinite(ageVal) ? Number(ageVal) : tryNum(ageVal);
          const tier = (r.Tier ?? r.tier ?? r.DynastyTier ?? r.dynasty_tier ?? "").toString().trim();
          const kind = (r.kind ?? (pos ? "player" : "pick")).toString().trim().toLowerCase();
          const value = tryNum(r.value_final_1000 ?? r.value ?? r.val ?? r.trade_value);
          if (!name || !Number.isFinite(value)) return;

          const asset: Asset = {
            id: `${kind}-${name}-${pos}-${team}-${value}-${i}`,
            name,
            pos: kind === "player" ? pos : undefined,
            team: kind === "player" ? team : undefined,
            value,
            age: kind === "player" ? (Number.isFinite(age) ? age : undefined) : undefined,  // NEW
            tier: kind === "player" && tier ? tier : undefined,                              // NEW
            meta: r,
            kind: kind === "pick" ? "pick" : "player",
          };

          if (asset.kind === "player") pl.push(asset);
          else pk.push(asset);
        });
        setPlayers(pl);
        setPicks(pk);
      },
      error: (e) => console.error("Failed to load /values.csv", e),
    });
  }, []);

  // All assets list
  const allAssets = useMemo(() => {
    return includePicks ? [...players, ...picks] : players;
  }, [players, picks, includePicks]);

  // Fixed position list + dynamic team list
  const allowedPositions = ["DL", "DB", "LB", "K", "WR", "TE", "RB", "QB"] as const;
  const posOptions = useMemo(() => ["All", ...allowedPositions], []);
  const teamOptions = useMemo(() => {
    const set = new Set<string>();
    allAssets.forEach((a) => {
      if (a.kind === "player" && a.team) set.add(a.team);
    });
    return ["All", ...Array.from(set).sort()];
  }, [allAssets]);

  // Hide already-selected items from the list
  const selectedIds = useMemo(() => new Set([...sideA, ...sideB].map((x) => x.id)), [sideA, sideB]);

  // Filtering logic (text, pos/team, value range, picks visibility)
  const filteredAll = useMemo(() => {
    const q = query.toLowerCase();
    return allAssets.filter((a) => {
      // already selected? hide from the list
      if (selectedIds.has(a.id)) return false;

      // text search
      if (q) {
        const hit =
          a.name.toLowerCase().includes(q) ||
          (a.pos && a.pos.toLowerCase().includes(q)) ||
          (a.team && a.team.toLowerCase().includes(q));
        if (!hit) return false;
      }
      // position (supports "DL, LB")
      if (posFilter !== "All" && a.kind === "player") {
        const posList = String(a.pos || "")
          .split(",")
          .map((x) => x.trim().toUpperCase())
          .filter(Boolean);
        if (!posList.includes(posFilter.toUpperCase())) return false;
      }
      // team
      if (teamFilter !== "All" && a.kind === "player") {
        if ((a.team || "") !== teamFilter) return false;
      }
      // picks hidden when pos/team filter is active
      if (a.kind === "pick" && (posFilter !== "All" || teamFilter !== "All")) return false;

      // value range (applies to players and picks)
      const v = a.value;
      if (Number.isFinite(minVal) && v < minVal) return false;
      if (Number.isFinite(maxVal) && v > maxVal) return false;

      return true;
    });
  }, [allAssets, query, posFilter, teamFilter, minVal, maxVal, selectedIds]);

  // View window
  const visible = useMemo(() => filteredAll.slice(0, viewLimit), [filteredAll, viewLimit]);

  // Totals + grade
  const totals = useMemo(() => {
    const ta = sideA.reduce((s, x) => s + x.value, 0);
    const tb = sideB.reduce((s, x) => s + x.value, 0);
    const { letter, color } = gradeTrade(ta - tb, Math.min(ta, tb));
    const edge = ta - tb;
    const pct = (edge / Math.max(1, Math.min(ta, tb))) * 100;
    return { ta, tb, edge, pct, letter, color };
  }, [sideA, sideB]);

  // Actions
  function handleAdd(to: "A" | "B", a: Asset) {
    if (selectedIds.has(a.id)) return; // guard double-adds
    const next: SideItem = { ...a };
    if (to === "A") setSideA((s) => [...s, next]);
    else setSideB((s) => [...s, next]);
  }
  function removeItem(which: "A" | "B", id: string) {
    const upd = (arr: SideItem[]) => arr.filter((x) => x.id !== id);
    if (which === "A") setSideA(upd);
    else setSideB(upd);
  }
  function clearSideA() {
    setSideA([]);
  }
  function clearSideB() {
    setSideB([]);
  }
  function exportConfig() {
    const payload = {
      created: new Date().toISOString(),
      playersCount: players.length,
      picksCount: picks.length,
      sideA,
      sideB,
      grading: "v1",
      filters: { query, posFilter, teamFilter, minVal, maxVal, teamNeeds },
    };
    downloadJSON("trade-calculator-export.json", payload);
  }

  /** ------------ Render ------------ */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl md:text-3xl font-bold mb-1"
        >
          32-Team IDP Trade Calculator
        </motion.h1>
        <div className="text-sm text-gray-600 mb-6">
          Data auto-loaded from <code>/values.csv</code>. No uploads needed.
        </div>

        {/* Stats + Team Needs */}
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          {/* Data Stats */}
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="font-semibold mb-2">Data Stats</div>
            <div className="grid grid-cols-3 gap-2">
              <NumberStat label="Players" value={players.length} />
              <NumberStat label="Picks" value={picks.length} />
              <NumberStat
                label="Assets"
                value={players.length + (includePicks ? picks.length : 0)}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includePicks}
                  onChange={(e) => {
                    setIncludePicks(e.target.checked);
                  }}
                />
                Include picks
              </label>
              <button onClick={exportConfig} className="px-3 py-1.5 rounded-xl border text-sm">
                <Download className="w-4 h-4 inline-block mr-1" />
                Export current trade
              </button>
            </div>
          </div>

          {/* Team Needs */}
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="font-semibold mb-2">Team Needs</div>
            <div className="flex flex-wrap gap-2">
              {allowedPositions.map((pos) => {
                const active = teamNeeds.includes(pos);
                const cls = active
                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                  : "border hover:bg-gray-50";
                return (
                  <button
                    key={pos}
                    onClick={() =>
                      setTeamNeeds((prev) =>
                        prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
                      )
                    }
                    className={`px-3 py-1.5 rounded-xl text-sm ${cls}`}
                  >
                    {pos}
                  </button>
                );
              })}
            </div>
            {teamNeeds.length > 0 && (
              <div className="mt-2 text-xs text-gray-600">Selected: {teamNeeds.join(", ")}</div>
            )}
          </div>
        </div>

        {/* Search + Filters */}
        <div className="bg-white rounded-2xl shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setViewLimit(10);
                }}
                placeholder="Search by player/pick, position, or team"
                className="w-full px-3 py-2 rounded-xl border"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={posFilter}
                onChange={(e) => {
                  setPosFilter(e.target.value);
                  setViewLimit(10);
                }}
                className="px-3 py-2 rounded-xl border text-sm"
              >
                {["All", ...allowedPositions].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              <select
                value={teamFilter}
                onChange={(e) => {
                  setTeamFilter(e.target.value);
                  setViewLimit(10);
                }}
                className="px-3 py-2 rounded-xl border text-sm"
              >
                {teamOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              {/* Value range control (dual-thumb slider + numeric inputs) */}
              <div className="flex flex-col min-w-[260px]">
                {/* Slider */}
                <div className="px-2 pt-1">
                  <Range
                    step={1}
                    min={0}
                    max={1000}
                    values={[minVal, maxVal]}
                    onChange={(vals) => {
                      let [lo, hi] = vals as [number, number];
                      if (hi - lo < MIN_GAP) {
                        if (lo !== minVal) {
                          lo = Math.min(lo, 1000 - MIN_GAP);
                          hi = lo + MIN_GAP;
                        } else {
                          hi = Math.max(hi, MIN_GAP);
                          lo = hi - MIN_GAP;
                        }
                      }
                      setMinVal(lo);
                      setMaxVal(hi);
                      setViewLimit(10);
                    }}
                    renderTrack={({ props, children }) => (
                      <div
                        {...props}
                        className="h-2 rounded-full bg-gray-200 relative"
                        style={{ ...props.style }}
                      >
                        <div
                          className="absolute h-2 bg-gray-800 rounded-full"
                          style={{
                            left: `${(minVal / 1000) * 100}%`,
                            right: `${100 - (maxVal / 1000) * 100}%`,
                          }}
                        />
                        {children}
                      </div>
                    )}
                    renderThumb={({ props }) => (
                      <div
                        {...props}
                        className="w-4 h-4 bg-white border border-gray-400 rounded-full shadow"
                      />
                    )}
                  />
                </div>

                {/* Typed inputs */}
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <span>≥</span>
                    <input
                      type="number"
                      className="w-20 rounded-xl border px-2 py-1 text-sm"
                      value={minVal}
                      onChange={(e) => {
                        const n = Math.max(0, Math.min(1000 - MIN_GAP, Number(e.target.value) || 0));
                        const lo = Math.min(n, maxVal - MIN_GAP);
                        setMinVal(lo);
                        setViewLimit(10);
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <span>≤</span>
                    <input
                      type="number"
                      className="w-20 rounded-xl border px-2 py-1 text-sm"
                      value={maxVal}
                      onChange={(e) => {
                        const n = Math.min(1000, Math.max(MIN_GAP, Number(e.target.value) || 0));
                        const hi = Math.max(n, minVal + MIN_GAP);
                        setMaxVal(Math.min(hi, 1000));
                        setViewLimit(10);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results grid */}
          <div className="grid md:grid-cols-2 gap-3">
            {visible.map((a) => (
              <AssetRow
                key={a.id}
                a={a}
                onReceive={(asset) => handleAdd("A", asset)}
                onSend={(asset) => handleAdd("B", asset)}
              />
            ))}
          </div>

          {/* Paging controls */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setViewLimit((n) => Math.min(n + 10, filteredAll.length))}
              className="px-3 py-2 rounded-xl border text-sm"
            >
              Show more
            </button>
            <button
              onClick={() => setViewLimit(filteredAll.length)}
              className="px-3 py-2 rounded-xl border text-sm"
            >
              Show all
            </button>
            <div className="text-xs text-gray-500 ml-auto">
              Showing {visible.length} of {filteredAll.length}
            </div>
          </div>
        </div>

        {/* Side A / Side B */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold">Side A receives</h2>
              <button onClick={clearSideA} className="px-2 py-1 text-xs border rounded">
                Clear All
              </button>
            </div>
            {sideA.length === 0 && <div className="text-sm text-gray-500">No assets yet.</div>}
            {sideA.map((it) => (
              <div
                key={it.id}
                className={`flex items-center justify-between gap-2 p-2 rounded-xl border ${
                  // Soft green overlay if matches team needs
                  it.pos &&
                  it.pos
                    .split(",")
                    .map((p) => p.trim().toUpperCase())
                    .some((p) => teamNeeds.includes(p))
                    ? "bg-green-50"
                    : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{it.name}</div>
                  <div className="text-xs text-gray-500">
                    {it.pos || it.kind.toUpperCase()} {it.team ? `• ${it.team}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="tabular-nums text-sm font-semibold w-20 text-right">
                    {it.value.toFixed(1)}
                  </div>
                  <button onClick={() => removeItem("A", it.id)} className="p-2 rounded-xl hover:bg-gray-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold">Side B receives</h2>
              <button onClick={clearSideB} className="px-2 py-1 text-xs border rounded">
                Clear All
              </button>
            </div>
            {sideB.length === 0 && <div className="text-sm text-gray-500">No assets yet.</div>}
            {sideB.map((it) => (
              <div
                key={it.id}
                className={`flex items-center justify-between gap-2 p-2 rounded-xl border ${
                  // Soft red overlay if matches team needs
                  it.pos &&
                  it.pos
                    .split(",")
                    .map((p) => p.trim().toUpperCase())
                    .some((p) => teamNeeds.includes(p))
                    ? "bg-red-50"
                    : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{it.name}</div>
                  <div className="text-xs text-gray-500">
                    {it.pos || it.kind.toUpperCase()} {it.team ? `• ${it.team}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="tabular-nums text-sm font-semibold w-20 text-right">
                    {it.value.toFixed(1)}
                  </div>
                  <button onClick={() => removeItem("B", it.id)} className="p-2 rounded-xl hover:bg-gray-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Grade summary */}
        <div className="mt-6 bg-white rounded-2xl shadow p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Side A Total</div>
              <div className="text-2xl font-bold tabular-nums">{Math.round(totals.ta)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Side B Total</div>
              <div className="text-2xl font-bold tabular-nums">{Math.round(totals.tb)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Edge (A − B)</div>
              <div className="text-2xl font-bold tabular-nums">{Math.round(totals.edge)}</div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs uppercase tracking-wide text-gray-500">Grade for Side A</div>
            <div className={`text-3xl font-extrabold ${totals.color}`}>{totals.letter}</div>
            <div className="text-xs text-gray-500">~{totals.pct.toFixed(1)}% value edge</div>
          </div>
        </div>
      </div>
    </div>
  );
}

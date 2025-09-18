import React, { useMemo, useState } from "react";

/** ===== Types (loose for resilience) ===== */
type PlayerValueRow = {
  sleeper_id?: string | number | null;
  Name?: string | null;
  Pos?: string | null;
  Team?: string | null;
  Age?: number | string | null;
  Tier?: number | string | null;
  value_final_1000?: number | string | null;
};

type PickRow = {
  season?: number | string | null;
  round?: number | string | null;
  pick?: number | string | null;
  overall_pick?: number | string | null;
  display?: string | null;
  value?: number | null;

  // NEW: needed to render Owned by / From
  owner_roster_id?: number | null; // current owner roster_id
  roster_id?: number | null;       // origin roster_id
};

type AllPlayersMapEntry = { injury_status?: string | null };
type AllPlayersMap = Record<string, AllPlayersMapEntry | undefined>;

type Props = {
  myPlayers?: PlayerValueRow[];
  allPlayers?: PlayerValueRow[];
  myPicks?: PickRow[];
  allPicks?: PickRow[];

  playersMeta?: AllPlayersMap;

  // NEW: roster_id -> DEF abbreviation (e.g., "NE", "TEN")
  rosterDefById?: Record<string | number, string>;

  onSendPlayer?: (p: PlayerValueRow) => void;
  onReceivePlayer?: (p: PlayerValueRow) => void;
  onSendPick?: (p: PickRow) => void;
  onReceivePick?: (p: PickRow) => void;

  context?: {
    myPlayersShowSend?: boolean;
    allPlayersShowReceive?: boolean;
    myPicksShowSend?: boolean;
    allPicksShowReceive?: boolean;
  };
  
  middleContent?: React.ReactNode;
};

/** ===== Color helpers ===== */
function posToColors(pos: string) {
  const base: Record<string, string> = {
    QB: "bg-indigo-500",
    RB: "bg-rose-500",
    WR: "bg-blue-500",
    TE: "bg-emerald-500",
    DL: "bg-purple-500",
    LB: "bg-yellow-500",
    DB: "bg-cyan-500",
    K: "bg-amber-500",
    DEF: "bg-slate-500",
  };
  const keys = ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "K", "DEF"];
  const first = keys.find((k) => pos.includes(k)) ?? "WR";
  const second = keys.find((k) => k !== first && pos.includes(k)) ?? first;
  return { first: base[first], second: base[second] };
}

function LeftStripe({ pos, isPick }: { pos?: string | null; isPick?: boolean }) {
  if (isPick) return <div className="h-7 w-1.5 rounded-full bg-gray-300 dark:bg-neutral-600" />;
  const p = pos ?? "";
  const { first, second } = posToColors(p);
  const isDual = /QB|RB|WR|TE|DL|LB|DB/.test(p) && p.length > 2 && first !== second;
  if (isDual) {
    return (
      <div className="h-7 w-1.5 rounded-full relative overflow-hidden" aria-hidden>
        <div className={`absolute inset-0 ${first}`} style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />
        <div className={`absolute inset-0 ${second}`} style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }} />
      </div>
    );
  }
  return <div className={`h-7 w-1.5 rounded-full ${first}`} />;
}

/** ===== Small UI atoms ===== */
function TierBadge({ tier }: { tier?: number | string | null }) {
  if (tier === undefined || tier === null || tier === "") return null;
  return (
    <div
      title={`Tier ${tier}`}
      className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-gray-300 bg-white text-[13px] font-semibold leading-none text-gray-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100"
    >
      {tier}
    </div>
  );
}

function InjuryChip({ status }: { status?: string | null }) {
  if (!status) return null;
  const s = status.toLowerCase();
  let label = ""; let className = "bg-gray-200 text-gray-800";
  if (s.startsWith("quest")) { label = "Q"; className = "bg-yellow-300 text-yellow-900"; }
  else if (s.startsWith("doubt")) { label = "D"; className = "bg-orange-300 text-orange-900"; }
  else if (s === "out") { label = "O"; className = "bg-red-500 text-white"; }
  else if (s.includes("reserve")) { label = "IR"; className = "bg-fuchsia-500 text-white"; }
  else if (s.includes("pup")) { label = "PUP"; className = "bg-rose-300 text-rose-900"; }
  else if (s.includes("susp")) { label = "SUS"; className = "bg-amber-400 text-black"; }
  else { label = status.toUpperCase().slice(0, 3); }
  return <span className={`ml-2 inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${className}`} title={status}>{label}</span>;
}

function ValuePill({ value }: { value?: number | string | null }) {
  if (value === undefined || value === null || value === "") return null;
  const v = typeof value === "string" ? value : Math.round((value as number) ?? 0).toString();
  return <div className="ml-3 select-none text-right text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{v}</div>;
}

/** ===== Row renderers ===== */
function PlayerRow({
  row, meta, showSend, showReceive, onSend, onReceive,
}: {
  row: PlayerValueRow;
  meta?: AllPlayersMapEntry;
  showSend?: boolean;
  showReceive?: boolean;
  onSend?: (p: PlayerValueRow) => void;
  onReceive?: (p: PlayerValueRow) => void;
}) {
  const name = row.Name ?? "—";
  const pos = row.Pos ?? "";
  const team = row.Team ?? "—";
  const age = row.Age ?? "—";
  const tier = row.Tier;
  const value = row.value_final_1000 != null ? Number(row.value_final_1000 as any) : undefined;

  return (
    <div className="group flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/70 p-3 shadow-sm hover:shadow transition dark:border-neutral-700/70 dark:bg-neutral-900/60">
      <div className="flex items-center gap-3">
        <LeftStripe pos={pos} />
        <div>
          <div className="flex items-center">
            <div className="truncate text-[15px] font-semibold">{name}</div>
            <TierBadge tier={tier} />
            <InjuryChip status={meta?.injury_status ?? null} />
          </div>
          <div className="text-[12px] text-gray-600 dark:text-gray-300">
            {pos || "—"} • {team} • {age}
          </div>
        </div>
      </div>
      <div className="flex items-center">
        <ValuePill value={value} />
        {showSend && (
          <button onClick={() => onSend?.(row)} className="ml-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700">Send</button>
        )}
        {showReceive && (
          <button onClick={() => onReceive?.(row)} className="ml-3 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">Receive</button>
        )}
      </div>
    </div>
  );
}

function PickRow({
  row, rosterDefById, showSend, showReceive, onSend, onReceive, idxForKey,
}: {
  row: PickRow;
  rosterDefById?: Record<string | number, string>;
  showSend?: boolean;
  showReceive?: boolean;
  onSend?: (p: PickRow) => void;
  onReceive?: (p: PickRow) => void;
  idxForKey: number;
}) {
  const title =
    row.display ?? `${row.season ?? "—"} ${row.round ?? "—"}${row.pick != null ? `.${row.pick}` : ""}`;
  const value = typeof row.value === "number" ? row.value : undefined;

  // NEW: resolve DEF codes
  const ownerAbbr =
    rosterDefById?.[String(row.owner_roster_id ?? "")] ??
    rosterDefById?.[Number(row.owner_roster_id ?? -1)] ?? null;
  const originAbbr =
    rosterDefById?.[String(row.roster_id ?? "")] ??
    rosterDefById?.[Number(row.roster_id ?? -1)] ?? null;

  const subtitle =
    ownerAbbr && originAbbr ? (
      <div className="text-[12px] text-gray-600 dark:text-gray-300">
        Owned by: <span className="font-semibold">{ownerAbbr}</span> | From: <span className="font-semibold">{originAbbr}</span>
      </div>
    ) : value != null ? (
      <div className="text-[12px] text-gray-600 dark:text-gray-300">{Math.round(value)} val</div>
    ) : (
      <div className="text-[12px] text-gray-600 dark:text-gray-300">&nbsp;</div>
    );

  return (
    <div
      className="group flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/70 p-3 shadow-sm hover:shadow transition dark:border-neutral-700/70 dark:bg-neutral-900/60"
      key={`pick-${row.season ?? "x"}-${row.round ?? "x"}-${row.pick ?? idxForKey}`}
    >
      <div className="flex items-center gap-3">
        <LeftStripe isPick />
        <div>
          <div className="text-[15px] font-semibold">{title}</div>
          {subtitle}
        </div>
      </div>
      <div className="flex items-center">
        <ValuePill value={value} />
        {showSend && (
          <button onClick={() => onSend?.(row)} className="ml-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700">Send</button>
        )}
        {showReceive && (
          <button onClick={() => onReceive?.(row)} className="ml-3 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">Receive</button>
        )}
      </div>
    </div>
  );
}

/** ===== Table wrapper with per-quadrant paging ===== */
const PAGE = 5;

export default function PlayersTables({
  myPlayers = [],
  allPlayers = [],
  myPicks = [],
  allPicks = [],
  playersMeta = {},
  rosterDefById = {},
  onSendPlayer,
  onReceivePlayer,
  onSendPick,
  onReceivePick,
  context = {},
  middleContent,
}: Props) {
  const [myPlayersVisible, setMyPlayersVisible] = useState(PAGE);
  const [myPicksVisible, setMyPicksVisible] = useState(PAGE);
  const [allPlayersVisible, setAllPlayersVisible] = useState(PAGE);
  const [allPicksVisible, setAllPicksVisible] = useState(PAGE);

  // meta lookup by sleeper id
  const metaById = useMemo(() => {
    const m: Record<string, AllPlayersMapEntry> = {};
    Object.entries(playersMeta || {}).forEach(([id, v]) => { if (v) m[String(id)] = v; });
    return m;
  }, [playersMeta]);
  const getMeta = (row: PlayerValueRow) => metaById[String(row?.sleeper_id ?? "")];

  const ShowMore = ({ hasMore, onClick }: { hasMore: boolean; onClick: () => void }) =>
    hasMore ? (
      <button
        onClick={onClick}
        className="mt-3 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100 dark:hover:bg-neutral-800"
      >
        Show more
      </button>
    ) : null;

  const ShowLess = ({ isExpanded, onClick }: { isExpanded: boolean; onClick: () => void }) =>
    isExpanded ? (
      <button
        onClick={onClick}
        className="mt-2 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-300 dark:hover:bg-neutral-700"
      >
        Show less
      </button>
    ) : null;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* My Players */}
      <div className="rounded-2xl border border-gray-200 p-4 dark:border-neutral-700/70">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">My Players</h3>
        <div className="space-y-3">
          {myPlayers.slice(0, myPlayersVisible).map((p) => (
            <PlayerRow
              key={`my-player-${String(p?.sleeper_id ?? Math.random())}`}
              row={p}
              meta={getMeta(p)}
              showSend={!!context.myPlayersShowSend}
              onSend={onSendPlayer}
            />
          ))}
        </div>
        <ShowMore hasMore={myPlayersVisible < myPlayers.length} onClick={() => setMyPlayersVisible((n) => Math.min(n + PAGE, myPlayers.length))} />
        <ShowLess isExpanded={myPlayersVisible > PAGE} onClick={() => setMyPlayersVisible(PAGE)} />
      </div>

      {/* My Picks */}
      <div className="rounded-2xl border border-gray-200 p-4 dark:border-neutral-700/70">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">My Picks</h3>
        <div className="space-y-3">
          {myPicks.slice(0, myPicksVisible).map((p, idx) => (
            <PickRow
              key={`my-pick-${idx}`}
              row={p}
              idxForKey={idx}
              rosterDefById={rosterDefById}
              showSend={!!context.myPicksShowSend}
              onSend={onSendPick}
            />
          ))}
        </div>
        <ShowMore hasMore={myPicksVisible < myPicks.length} onClick={() => setMyPicksVisible((n) => Math.min(n + PAGE, myPicks.length))} />
        <ShowLess isExpanded={myPicksVisible > PAGE} onClick={() => setMyPicksVisible(PAGE)} />
      </div>

      {/* NEW: middle splitter row */}
      {middleContent ? (
        <div className="md:col-span-2">{middleContent}</div>
      ) : null}

      {/* All Players */}
      <div className="rounded-2xl border border-gray-200 p-4 dark:border-neutral-700/70">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">All Players</h3>
        <div className="space-y-3">
          {allPlayers.slice(0, allPlayersVisible).map((p) => (
            <PlayerRow
              key={`all-player-${String(p?.sleeper_id ?? Math.random())}`}
              row={p}
              meta={getMeta(p)}
              showReceive={!!context.allPlayersShowReceive}
              onReceive={onReceivePlayer}
            />
          ))}
        </div>
        <ShowMore hasMore={allPlayersVisible < allPlayers.length} onClick={() => setAllPlayersVisible((n) => Math.min(n + PAGE, allPlayers.length))} />
        <ShowLess isExpanded={allPlayersVisible > PAGE} onClick={() => setAllPlayersVisible(PAGE)} />
      </div>

      {/* All Picks */}
      <div className="rounded-2xl border border-gray-200 p-4 dark:border-neutral-700/70">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">All Picks</h3>
        <div className="space-y-3">
          {allPicks.slice(0, allPicksVisible).map((p, idx) => (
            <PickRow
              key={`all-pick-${idx}`}
              row={p}
              idxForKey={idx}
              rosterDefById={rosterDefById}
              showReceive={!!context.allPicksShowReceive}
              onReceive={onReceivePick}
            />
          ))}
        </div>
        <ShowMore hasMore={allPicksVisible < allPicks.length} onClick={() => setAllPicksVisible((n) => Math.min(n + PAGE, allPicks.length))} />
        <ShowLess isExpanded={allPicksVisible > PAGE} onClick={() => setAllPicksVisible(PAGE)} />
      </div>
    </div>
  );
}
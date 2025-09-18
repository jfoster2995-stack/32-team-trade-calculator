// =================================
// FILE: src/components/Badges.tsx
// =================================
import React from "react";

// Injury status mapping per spec
export function InjuryChip({ status }: { status?: string | null }) {
  if (!status) return null;
  const s = status.trim().toUpperCase();
  const map: Record<string, { label: string; cls: string; emoji?: string }> = {
    QUESTIONABLE: { label: "Q", cls: "bg-yellow-400 text-black" },
    DOUBTFUL: { label: "D", cls: "bg-orange-500 text-white" },
    DOUBTFULL: { label: "D", cls: "bg-orange-500 text-white" }, // handle misspelling
    IR: { label: "IR", cls: "bg-red-600 text-white" },
    SUS: { label: "S", cls: "bg-red-600 text-white" },
    SUSPENDED: { label: "S", cls: "bg-red-600 text-white" },
    PUP: { label: "P", cls: "bg-red-600 text-white" },
    OUT: { label: "O", cls: "bg-red-400 text-white" },
    DNR: { label: "DNR", cls: "bg-red-700 text-white" },
    NA: { label: "NA", cls: "bg-red-700 text-white" },
    COV: { label: "COV", cls: "bg-orange-500 text-white", emoji: "🦠" },
    COVID: { label: "COV", cls: "bg-orange-500 text-white", emoji: "🦠" },
  };
  const match = map[s] || null;
  if (!match) return null;
  return (
    <span className={`ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${match.cls}`}>
      {match.label}
      {match.emoji ? <span>{match.emoji}</span> : null}
    </span>
  );
}

export function TierBadge({ tier }: { tier?: number | null }) {
  if (tier == null) return null;
  if (tier === 1) {
    return <span className="ml-1 inline-flex items-center rounded bg-amber-300 text-black px-1.5 py-0.5 text-[10px] font-semibold shimmer">Tier 1</span>;
  }
  if (tier === 2) {
    return <span className="ml-1 inline-flex items-center rounded bg-green-400 text-black px-1.5 py-0.5 text-[10px] font-semibold shimmer">Tier 2</span>;
  }
  if (tier >= 3 && tier <= 10) {
    return (
      <span className="ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold text-black gradient-gyR">
        Tier {tier}
      </span>
    );
  }
  if (tier === 11) {
    return (
      <span className="ml-1 inline-flex items-center rounded bg-black text-white px-1.5 py-0.5 text-[10px] font-semibold">
        Tier 11 <span className="ml-1">♨️</span>
      </span>
    );
  }
  return null;
}

// Add shimmer & gradient utilities (can also live in global CSS)
export const ShimmerStyle = () => (
  <style>{`
  .shimmer { position: relative; overflow: hidden; }
  .shimmer::after { content: ""; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 0%, rgba(255,255,255,.35) 45%, transparent 60%); transform: translateX(-100%); animation: shimmer 2.2s infinite; }
  @media (prefers-reduced-motion: reduce) { .shimmer::after { animation: none; } }
  @keyframes shimmer { 100% { transform: translateX(100%); } }
  .gradient-gyR { background: linear-gradient(90deg, #22c55e, #eab308, #ef4444); color: #111827; }
`}</style>
);
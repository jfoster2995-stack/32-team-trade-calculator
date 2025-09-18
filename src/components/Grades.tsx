// ==========================================
// FILE: src/components/Grades.tsx
// ==========================================
import React, { useMemo } from "react";
import { useTradeStore } from "../state/trade";
import { applyDropAdjustment } from "../logic/dropAdjustment";

interface GradeProps {
  sendPlayers?: any[];
  sendPicks?: any[];
  receivePlayers?: any[];
  receivePicks?: any[];
}

/**
 * Compute total value for a side.
 */
function computeTotal(players: any[], picks: any[], dropAdjustment: boolean) {
  const playerValue = (players ?? []).reduce(
    (sum, p) => sum + (p.value_final_1000 ?? 0),
    0
  );
  const pickValue = (picks ?? []).reduce((sum, pk) => sum + (pk.value ?? 0), 0);
  let total = playerValue + pickValue;

  if (dropAdjustment) {
    total = applyDropAdjustment(total, players, picks);
  }

  return total;
}

export default function Grades({
  sendPlayers = [],
  sendPicks = [],
  receivePlayers = [],
  receivePicks = [],
}: GradeProps) {
  const { dropAdjustment, toggleDropAdjustment } = useTradeStore();

  // --- compute totals ---
  const sendTotal = useMemo(
    () => computeTotal(sendPlayers, sendPicks, dropAdjustment),
    [sendPlayers, sendPicks, dropAdjustment]
  );

  const receiveTotal = useMemo(
    () => computeTotal(receivePlayers, receivePicks, dropAdjustment),
    [receivePlayers, receivePicks, dropAdjustment]
  );

  return (
    <section className="rounded-2xl border p-4 space-y-4">
      <h3 className="text-lg font-semibold">Trade Grades</h3>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-3">
          <h4 className="font-medium mb-2">My Side</h4>
          <div className="text-2xl font-bold">{sendTotal.toFixed(1)}</div>
        </div>

        <div className="rounded-lg border p-3">
          <h4 className="font-medium mb-2">Their Side</h4>
          <div className="text-2xl font-bold">{receiveTotal.toFixed(1)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="drop-adjustment"
          type="checkbox"
          checked={dropAdjustment}
          onChange={toggleDropAdjustment}
        />
        <label htmlFor="drop-adjustment" className="text-sm">
          Apply drop adjustment
        </label>
      </div>
    </section>
  );
}

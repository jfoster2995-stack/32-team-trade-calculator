// ==========================================
// FILE: src/logic/dropAdjustment.ts
// ==========================================
import type { ValueRow } from "./dropAdjustment"; // adjust if your types are elsewhere

/**
 * Apply a drop adjustment to a total value based on roster balance.
 * Example logic: penalize 1-for-2 or 2-for-3 trades slightly.
 */
export function applyDropAdjustment(
  baseTotal: number,
  players: ValueRow[] = [],
  picks: any[] = []
): number {
  const totalAssets = (players?.length ?? 0) + (picks?.length ?? 0);

  // Example adjustment: if sending more pieces than receiving, apply a small drop
  if (totalAssets > 2) {
    return baseTotal * 0.95; // drop 5%
  }

  return baseTotal;
}

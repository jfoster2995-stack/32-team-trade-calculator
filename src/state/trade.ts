// ==========================================
// FILE: src/state/trade.ts
// ==========================================
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TradeState {
  dropAdjustment: boolean;
  toggleDropAdjustment: () => void;
}

/**
 * Zustand store for trade calculator settings.
 * Persists dropAdjustment toggle across sessions.
 */
export const useTradeStore = create<TradeState>()(
  persist(
    (set) => ({
      dropAdjustment: true, // default ON
      toggleDropAdjustment: () =>
        set((state) => ({ dropAdjustment: !state.dropAdjustment })),
    }),
    {
      name: "trade-settings", // localStorage key
    }
  )
);

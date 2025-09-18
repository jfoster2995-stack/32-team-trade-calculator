// ===================================
// FILE: src/components/PositionBar.tsx
// ===================================
import React from "react";
import { normalizeDualPositions, positionBarStyle } from "../utils/positions";

type Props = {
  primaryPos?: string | null; // New pos_for_value
  displayPos?: string | string[] | null; // e.g. "DB/LB" or ["DB","LB"] or "DBLB"
};

export default function PositionBar({ primaryPos, displayPos }: Props) {
  const [p1, p2] = normalizeDualPositions(primaryPos, displayPos);
  const style = positionBarStyle(p1, p2);
  return <span aria-hidden className="h-4 w-1.5 rounded-sm ring-1 ring-black/5 dark:ring-white/10" style={style} />;
}

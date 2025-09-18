// ==================================
// FILE: src/utils/positions.ts
// ==================================
export const POS_COLOR: Record<string, string> = {
  RB: "#14B8A6", // teal-ish
  WR: "#7287FD", // periwinkle-ish
  TE: "#FEB019", // yellow-orange
  QB: "#EF4444", // red
  K:  "#D946EF", // magenta
  DL: "#C2410C", // dark orange
  LB: "#7C3AED", // purple
  DB: "#EC4899", // pink
};
export const DEFAULT_BAR = "#9CA3AF"; // gray-400

export const BASE_POS = ["QB","RB","WR","TE","K","DL","LB","DB"] as const;
export type BasePos = typeof BASE_POS[number];

export function normalizeDualPositions(
  primaryPos?: string | null,
  displayPos?: string | string[] | null
): [BasePos | null, BasePos | null] {
  const pick = (p?: string | null): BasePos | null => {
    const u = (p || "").toUpperCase();
    return (BASE_POS as readonly string[]).includes(u) ? (u as BasePos) : null;
  };
  const p = pick(primaryPos);
  if (Array.isArray(displayPos) && displayPos.length) {
    const a = pick(displayPos[0]);
    const b = pick(displayPos[1] ?? null);
    return [p ?? a, b && b !== (p ?? a) ? b : null];
  }
  if (typeof displayPos === "string" && displayPos.includes("/")) {
    const [a0, b0] = displayPos.split("/").map(s => s.trim());
    const a = pick(a0); const b = pick(b0);
    return [p ?? a, b && b !== (p ?? a) ? b : null];
  }
  if (typeof displayPos === "string" && displayPos.length >= 4) {
    const found: BasePos[] = [];
    for (const code of BASE_POS) {
      if (displayPos.toUpperCase().includes(code)) found.push(code);
      if (found.length === 2) break;
    }
    const a = p ?? found[0] ?? null; const b = found[1] && found[1] !== a ? found[1] : null;
    return [a, b];
  }
  return [p ?? null, null];
}

export function positionBarStyle(primary: BasePos | null, secondary: BasePos | null): React.CSSProperties {
  const c1 = primary ? POS_COLOR[primary] : DEFAULT_BAR;
  if (!secondary) {
    return { backgroundColor: c1, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.06)" } as React.CSSProperties;
  }
  const c2 = POS_COLOR[secondary] ?? DEFAULT_BAR;
  return {
    background: `linear-gradient(45deg, ${c1} 0 50%, ${c2} 50% 100%)`,
    backgroundRepeat: "no-repeat",
    boxShadow: "inset 0 0 0 1px rgba(0,0,0,.06)",
  } as React.CSSProperties;
}
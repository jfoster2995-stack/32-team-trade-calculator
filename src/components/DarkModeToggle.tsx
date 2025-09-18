// ==========================================
// FILE: src/components/DarkModeToggle.tsx
// ==========================================
import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme";

export default function DarkModeToggle() {
  const [theme, setTheme] = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm shadow-sm hover:bg-muted/50"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {isDark ? "Light" : "Dark"}
    </button>
  );
}

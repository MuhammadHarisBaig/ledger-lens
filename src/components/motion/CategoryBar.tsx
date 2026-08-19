"use client";

import { motion, useReducedMotion } from "framer-motion";

// Animates a category bar's fill from 0 to its share on mount. Reduced motion → renders at final
// width immediately. `pct` is a 0–100 number; `color` is the category hue (inline style).
export function CategoryBar({ pct, color }: { pct: number; color: string }) {
  const reduce = useReducedMotion();
  return (
    <span aria-hidden className="block h-2 w-full overflow-hidden rounded-full bg-white/5">
      <motion.span
        className="block h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={reduce ? false : { width: "0%" }}
        animate={{ width: `${pct}%` }}
        transition={reduce ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
      />
    </span>
  );
}

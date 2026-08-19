import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

// Glass surface: a subtle translucent fill over the gradient canvas, a hairline border, a soft
// shadow, ~16px radius, and a gentle backdrop blur.
export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] shadow-lg shadow-black/20 backdrop-blur-sm ${className}`}
      {...props}
    />
  );
}

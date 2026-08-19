import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

// A card surface: slightly lighter than the canvas, hairline border, ~12px radius.
export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface-1 ${className}`}
      {...props}
    />
  );
}

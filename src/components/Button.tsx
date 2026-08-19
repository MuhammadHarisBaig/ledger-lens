import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "@/components/Spinner";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  loading?: boolean; // shows an inline spinner and disables while true
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all " +
  "disabled:cursor-not-allowed disabled:opacity-60 " +
  "motion-safe:hover:-translate-y-0.5 motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98]";

const SIZES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
};

const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm shadow-emerald-500/20",
  secondary: "border border-white/10 bg-white/5 text-fg hover:bg-white/10",
};

// Hook-free so it renders in both server and client components.
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  );
}

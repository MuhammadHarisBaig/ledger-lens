type SpinnerProps = {
  className?: string;
  /** Diameter in px. */
  size?: number;
  /** Accessible label; omit (and set aria-hidden) when adjacent text already conveys the state. */
  label?: string;
};

// CSS-only spinning ring (no animation library). Reused by buttons, the status region, etc.
export function Spinner({ className = "", size = 16, label }: SpinnerProps) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

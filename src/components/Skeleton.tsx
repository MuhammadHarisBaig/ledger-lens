type SkeletonProps = {
  className?: string;
};

// Shimmering placeholder. A translucent base with a light gradient bar sweeping across it
// (motion-safe only — the sweep is disabled under prefers-reduced-motion). Size via className.
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={`relative block overflow-hidden rounded-md bg-white/5 ${className}`}
    >
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent motion-safe:animate-[shimmer_1.5s_infinite]" />
    </span>
  );
}

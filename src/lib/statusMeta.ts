/**
 * The ONE place statement/job status → presentation is defined (label + pill classes + icon key).
 * Classes are LITERAL strings so Tailwind's scanner keeps them. `queued` (a polling alias) maps to
 * the same look as UPLOADED.
 */
export type StatusTone = "muted" | "info" | "success" | "danger";
export type StatusIcon = "clock" | "spinner" | "check" | "alert";

export type StatusMeta = {
  label: string;
  pill: string; // literal Tailwind classes for the badge background/text/border
  icon: StatusIcon;
};

const META: Record<string, StatusMeta> = {
  UPLOADED: {
    label: "Queued",
    pill: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
    icon: "clock",
  },
  QUEUED: {
    label: "Queued",
    pill: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
    icon: "clock",
  },
  PROCESSING: {
    label: "Processing",
    pill: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    icon: "spinner",
  },
  PROCESSED: {
    label: "Processed",
    pill: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    icon: "check",
  },
  FAILED: {
    label: "Failed",
    pill: "bg-red-500/15 text-red-300 border-red-500/30",
    icon: "alert",
  },
};

const FALLBACK: StatusMeta = {
  label: "Unknown",
  pill: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  icon: "clock",
};

export function statusMeta(status: string): StatusMeta {
  return META[status?.toUpperCase()] ?? FALLBACK;
}

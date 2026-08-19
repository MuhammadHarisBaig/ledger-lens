import { statusMeta, type StatusIcon } from "@/lib/statusMeta";

// Tiny inline icons (no icon library). 12px, currentColor so they inherit the pill's text color.
function Icon({ icon }: { icon: StatusIcon }) {
  const common = { width: 12, height: 12, viewBox: "0 0 24 24", "aria-hidden": true } as const;
  switch (icon) {
    case "check":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={3}>
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "alert":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={3}>
          <path d="M12 8v5M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "spinner":
      return (
        <span
          className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      );
    case "clock":
    default:
      return <span className="inline-block h-2 w-2 rounded-full bg-current" />;
  }
}

export function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.pill}`}
    >
      <Icon icon={meta.icon} />
      {meta.label}
    </span>
  );
}

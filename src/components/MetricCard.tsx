import type { ReactNode } from "react";
import { Card } from "@/components/Card";

type MetricCardProps = {
  label: string;
  children: ReactNode; // the big value (often a <Money/>)
  tone?: "neutral" | "success" | "danger";
};

const TONE: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  neutral: "text-fg",
  success: "text-success",
  danger: "text-danger",
};

export function MetricCard({ label, children, tone = "neutral" }: MetricCardProps) {
  return (
    <Card className="flex flex-col gap-1.5 p-5 ring-1 ring-emerald-400/10">
      <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</span>
      <span className={`text-3xl font-semibold tabular-nums ${TONE[tone]}`}>{children}</span>
    </Card>
  );
}

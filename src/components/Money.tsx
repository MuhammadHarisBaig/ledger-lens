import { Prisma } from "@prisma/client";
import { formatMoney } from "@/lib/formatMoney";

type MoneyProps = {
  value: Prisma.Decimal | number | string;
  className?: string;
};

// Formats via formatMoney and colors by sign: negative = danger, positive = success, zero = neutral.
// Sign is read exactly from the Decimal (no float). tabular-nums keeps columns aligned.
export function Money({ value, className = "" }: MoneyProps) {
  const dec = new Prisma.Decimal(value);
  const tone = dec.isZero() ? "text-fg" : dec.isNegative() ? "text-danger" : "text-success";
  return <span className={`tabular-nums ${tone} ${className}`}>{formatMoney(value)}</span>;
}

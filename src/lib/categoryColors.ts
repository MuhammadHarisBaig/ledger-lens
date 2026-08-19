import { TransactionCategory } from "@prisma/client";

/**
 * The ONE place category → color is defined. Reused by every category dot/bar so a category is the
 * same hue everywhere. Hex (not Tailwind classes) because these drive inline `style` for dots and
 * dynamic-width bars — Tailwind's JIT can't see runtime-built class names, but inline hex always works.
 */
export const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  TRANSPORT: "#3b82f6", // blue
  UTILITIES: "#f59e0b", // amber
  GROCERIES: "#22c55e", // green
  DINING: "#fb7185", // coral
  INCOME: "#10b981", // teal
  HEALTH: "#ec4899", // pink
  ENTERTAINMENT: "#a855f7", // purple
  RENT: "#6366f1", // indigo
  TRANSFER: "#06b6d4", // cyan
  FEES: "#ef4444", // red
  OTHER: "#71717a", // gray
};

const UNCATEGORIZED_COLOR = "#52525b"; // muted gray for null/absent category

export function categoryColor(category: TransactionCategory | null): string {
  return category ? CATEGORY_COLORS[category] : UNCATEGORIZED_COLOR;
}

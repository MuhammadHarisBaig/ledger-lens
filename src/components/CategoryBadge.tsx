import { TransactionCategory } from "@prisma/client";
import { categoryColor } from "@/lib/categoryColors";

// Colored dot (from the central category map) + label. A null/absent category renders a muted
// "Uncategorized" — never a bare dash — so pre-categorization rows look intentional, not broken.
export function CategoryBadge({ category }: { category: TransactionCategory | null }) {
  const label = category ?? "Uncategorized";
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        aria-hidden
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: categoryColor(category) }}
      />
      <span className={category ? "text-fg" : "text-fg-subtle"}>{label}</span>
    </span>
  );
}

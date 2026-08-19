import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";

// App Router streams this instantly while the statements page's server data fetch is pending,
// so navigation shows a shimmer skeleton rather than a blank screen.
export default function StatementsLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>

        <Card className="flex flex-col gap-4 p-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-9 w-28" />
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

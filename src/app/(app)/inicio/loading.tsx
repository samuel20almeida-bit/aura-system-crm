import { PageBody } from "@/components/layout/PageBody";
import { Skeleton, SkeletonKpiRow } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageBody>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3 w-72" />
      </div>
      <SkeletonKpiRow />
      <div className="grid flex-1 grid-cols-[1.55fr_1fr] gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <Skeleton className="h-2.5 w-40" />
          <div className="mt-4 flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <Skeleton className="h-2.5 w-32" />
            <Skeleton className="mt-3 h-12 w-full" />
          </div>
          <div className="flex-1 rounded-xl border border-border bg-surface p-4">
            <Skeleton className="h-2.5 w-32" />
            <Skeleton className="mt-3 h-24 w-full" />
          </div>
        </div>
      </div>
    </PageBody>
  );
}

import { PageBody } from "@/components/layout/PageBody";
import { Skeleton, SkeletonKpiRow } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageBody>
      <div className="flex items-center gap-3.5">
        <Skeleton className="h-10 w-10 rounded-[10px]" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      <SkeletonKpiRow />
      <div className="grid flex-1 grid-cols-[1.6fr_1fr] gap-3.5">
        <div className="flex flex-col gap-3.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-4">
              <Skeleton className="h-2.5 w-32" />
              <Skeleton className="mt-3 h-16 w-full" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-4">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="mt-3 h-20 w-full" />
            </div>
          ))}
        </div>
      </div>
    </PageBody>
  );
}

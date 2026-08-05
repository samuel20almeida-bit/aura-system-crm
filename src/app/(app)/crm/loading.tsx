import { PageBody } from "@/components/layout/PageBody";
import { Skeleton, SkeletonKpiRow, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageBody>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-3 w-72" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="flex gap-4.5 border-b border-border pb-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-24" />
        ))}
      </div>
      <SkeletonKpiRow />
      <SkeletonTable rows={6} cols={3} />
    </PageBody>
  );
}

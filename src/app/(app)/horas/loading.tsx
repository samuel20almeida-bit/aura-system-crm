import { PageBody } from "@/components/layout/PageBody";
import { Skeleton, SkeletonKpiRow, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageBody>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-3 w-72" />
        </div>
        <Skeleton className="h-9 w-72" />
      </div>
      <SkeletonKpiRow />
      <div className="grid flex-1 grid-cols-1 gap-3.5 md:grid-cols-[1.75fr_1fr]">
        <SkeletonTable rows={5} cols={5} />
        <div className="flex flex-col gap-3.5">
          <div className="rounded-xl border border-border bg-surface p-4">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="mt-3 h-20 w-full" />
          </div>
          <div className="flex-1 rounded-xl border border-border bg-surface p-4">
            <Skeleton className="h-2.5 w-32" />
            <Skeleton className="mt-3 h-16 w-full" />
          </div>
        </div>
      </div>
    </PageBody>
  );
}

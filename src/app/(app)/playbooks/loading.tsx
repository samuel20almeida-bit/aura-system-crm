import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex w-[200px] flex-none flex-col gap-2 border-r border-border bg-surface p-3">
        <Skeleton className="h-2.5 w-20" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="grid flex-1 grid-cols-[1.7fr_1fr] gap-3.5">
          <SkeletonTable rows={4} cols={4} />
          <div className="rounded-xl border border-border bg-surface p-4">
            <Skeleton className="h-2.5 w-32" />
            <Skeleton className="mt-3 h-40 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

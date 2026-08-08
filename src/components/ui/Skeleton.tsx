import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("rounded bg-[#EDEAE2] animate-pulse-soft", className)} />;
}

export function SkeletonKpiRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-1.5 w-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex-1 rounded-xl border border-border bg-surface p-4">
      <div className="flex gap-3 border-b border-border pb-2">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-2 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 border-b border-border-soft py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid flex-1 grid-cols-3 gap-3.5">
      {Array.from({ length: count }).map((_, col) => (
        <div key={col} className="flex flex-col gap-2.25 rounded-xl border border-neutral-tint-border bg-neutral-tint p-2.75">
          <Skeleton className="h-2.5 w-20" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-[10px] border border-border bg-surface p-2.75">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

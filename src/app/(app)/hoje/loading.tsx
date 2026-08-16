import { PageBody } from "@/components/layout/PageBody";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * O esqueleto copia a grade da tela que ele precede — lista de pendências à
 * esquerda, `LiveActivity` à direita (`md:grid-cols-[1.55fr_1fr]`, igual às
 * três variantes de `HojeClient.tsx`). `/hoje` é o destino de `/`, do
 * middleware pós-login e do login/signup — sem este arquivo, toda entrada fria
 * no sistema congelava na tela anterior até os dados chegarem.
 */
export default function Loading() {
  return (
    <PageBody>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-[1.55fr_1fr]">
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3.5">
          {Array.from({ length: 5 }).map((_, linha) => (
            <div key={linha} className="flex items-center gap-3 py-1">
              <Skeleton className="h-2 w-2 flex-none rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3.5">
          <Skeleton className="h-2.5 w-28" />
          {Array.from({ length: 4 }).map((_, linha) => (
            <Skeleton key={linha} className="h-3 w-full" />
          ))}
        </div>
      </div>
    </PageBody>
  );
}

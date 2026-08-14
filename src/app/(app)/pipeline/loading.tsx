import { PageBody } from "@/components/layout/PageBody";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * O esqueleto copia a grade da tela que ele precede — cinco colunas no desktop,
 * empilhadas no celular, como o `PipelineBoard`. Divergir troca o desenho por um
 * salto no momento em que os dados chegam.
 */
export default function Loading() {
  return (
    <PageBody>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3 w-72" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid flex-1 grid-cols-1 gap-3.5 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, coluna) => (
          <div
            key={coluna}
            className="flex flex-col gap-2.25 rounded-xl border border-neutral-tint-border bg-neutral-tint p-2.75"
          >
            <Skeleton className="h-2.5 w-20" />
            {Array.from({ length: 2 }).map((_, cartao) => (
              <div key={cartao} className="flex flex-col gap-2 rounded-[10px] border border-border bg-surface p-2.75">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </PageBody>
  );
}

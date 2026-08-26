import { PageBody } from "@/components/layout/PageBody";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Copia a forma da tela: cabeçalho, o título da seção com o controle
 * segmentado ao lado, e as linhas de reunião — que são cartões de uma linha
 * só, não os blocos altos dos outros quadros.
 */
export default function Loading() {
  return (
    <PageBody>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-56" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-card border border-border bg-surface p-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-2.5 w-1/4" />
              </div>
              <Skeleton className="h-4 w-16 flex-none rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </PageBody>
  );
}

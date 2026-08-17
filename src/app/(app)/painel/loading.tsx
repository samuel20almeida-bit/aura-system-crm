import { PageBody } from "@/components/layout/PageBody";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * O esqueleto copia a grade da tela que ele precede: cabeçalho fantasma + 6
 * blocos no formato de `Kpi`, no mesmo `grid-cols-2 md:grid-cols-3` da página
 * real, mais uma barra no lugar da tabela de Origem → receita.
 *
 * Não reusa `SkeletonKpiRow` (`src/components/ui/Skeleton.tsx`) porque aquele
 * componente só sabe desenhar 3 ou 4 colunas — o Painel tem 6 blocos numa
 * grade de 3 colunas no desktop, um caso que `KPI_ROW_COLS` não cobre. Os
 * blocos abaixo copiam a mesma forma interna (rótulo + valor + linha de
 * apoio) que `SkeletonKpiRow` já usa, só com a grade certa para este caso.
 */
export default function Loading() {
  return (
    <PageBody>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-2.5 w-32" />
          </div>
        ))}
      </div>
      <div className="flex-1 rounded-xl border border-border bg-surface p-4">
        <Skeleton className="mb-3 h-2.5 w-32" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="mb-2 h-3 w-full" />
        ))}
      </div>
    </PageBody>
  );
}

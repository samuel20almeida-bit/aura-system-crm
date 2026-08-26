import { PageBody } from "@/components/layout/PageBody";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * O esqueleto copia a forma da tela que ele precede: cabeçalho fantasma, e
 * depois as três seções do Painel — os 6 blocos de `Kpi` na mesma grade
 * `grid-cols-2 md:grid-cols-3`, a tabela de Origem → receita, e a faixa de
 * Tendência com os quatro gráficos em `md:grid-cols-2`.
 *
 * Cada seção começa por uma barra estreita no lugar do título: sem ela, a
 * página trocava um esqueleto sem títulos por uma página com três, e todo o
 * conteúdo descia de uma vez no momento em que os dados chegavam.
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

      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-16" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-2.5 w-32" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-36" />
        <div className="rounded-card border border-border bg-surface p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-3 w-full" />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-[220px] w-full" />
            </div>
          ))}
        </div>
      </div>
    </PageBody>
  );
}

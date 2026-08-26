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
        {/* A lista real é agrupada por saúde, com cabeçalho grudado em cada
            grupo. Sem a barra de cabeçalho aqui, a página trocava uma lista
            corrida por uma lista com títulos e tudo descia de uma vez. */}
        <div className="flex flex-col rounded-card border border-border bg-surface">
          {[3, 2].map((linhas, grupo) => (
            <div key={grupo}>
              <div className="flex items-center gap-2 bg-bone px-3.5 py-2 shadow-[inset_0_-1px_0_var(--color-border)]">
                <Skeleton className="h-2 w-2 flex-none rounded-full" />
                <Skeleton className="h-2.5 w-24" />
              </div>
              {Array.from({ length: linhas }).map((_, linha) => (
                <div key={linha} className="flex items-center gap-3 border-b border-border-soft px-3.5 py-3 last:border-b-0">
                  <Skeleton className="h-2.5 w-[68px] flex-none" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-2.5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
          <Skeleton className="h-2.5 w-28" />
          {Array.from({ length: 4 }).map((_, linha) => (
            <Skeleton key={linha} className="h-3 w-full" />
          ))}
        </div>
      </div>
    </PageBody>
  );
}

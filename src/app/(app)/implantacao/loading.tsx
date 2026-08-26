import { PageBody } from "@/components/layout/PageBody";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * O esqueleto copia a grade da tela que ele precede — uma coluna por etapa,
 * empilhadas no celular, como o `ImplantacaoBoard`. Nasce junto com o
 * primeiro commit desta tela: `/hoje` (Task 5 da 3A) só ganhou o dela numa
 * revisão corretiva por ter sido esquecido — não repetir aqui.
 *
 * Seis colunas porque `implantacao_etapas` tem seis linhas hoje (dado, não
 * código — ver `ImplantacaoBoard.tsx`); a classe é literal porque o Tailwind
 * lê o código-fonte, não uma string montada em runtime. Se o número de
 * etapas mudar, este esqueleto para de bater exatamente com a grade real —
 * o mesmo preço já aceito em `SkeletonKpiRow`.
 */
export default function Loading() {
  return (
    <PageBody>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-72" />
        </div>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-3.5 md:grid-cols-6">
        {Array.from({ length: 6 }).map((_, coluna) => (
          <div
            key={coluna}
            className="flex flex-col gap-2.25 rounded-card border border-neutral-tint-border bg-neutral-tint p-2.75"
          >
            <Skeleton className="h-2.5 w-20" />
            {Array.from({ length: 2 }).map((_, cartao) => (
              <div key={cartao} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3">
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

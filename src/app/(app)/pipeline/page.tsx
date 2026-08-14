import { PageBody } from "@/components/layout/PageBody";
import { PipelineClient } from "@/components/pipeline/PipelineClient";
import { listNegociosAbertos } from "@/lib/data/deals";
import { listProfiles } from "@/lib/data/profile";

/**
 * A tela ainda não está no menu lateral: a navegação (e a aposentadoria do CRM
 * antigo) é a Task 6 desta fase. Até lá, `/pipeline` se acessa direto.
 *
 * Também não assina tempo real: `negocios` e `contas` não estão publicadas, e
 * publicar é decisão consciente para quando o modelo estiver estável — o mesmo
 * raciocínio da migration 0013.
 */
export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ negocio?: string }>;
}) {
  const [{ negocio: negocioId }, dados, profiles] = await Promise.all([
    searchParams,
    listNegociosAbertos(),
    listProfiles(),
  ]);

  // Falha de leitura não pode tirar a capacidade de escrever: o quadro vira
  // aviso, o "+ Novo negócio" continua.
  if (dados.unavailable) {
    return (
      <PageBody>
        <PipelineClient negocios={[]} profiles={profiles} unavailable />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PipelineClient negocios={dados.negocios} profiles={profiles} negocioInicialId={negocioId ?? null} />
    </PageBody>
  );
}

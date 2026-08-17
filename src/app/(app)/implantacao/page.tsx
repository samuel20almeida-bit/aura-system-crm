import { PageBody } from "@/components/layout/PageBody";
import { ImplantacaoClient } from "@/components/implantacao/ImplantacaoClient";
import { listEtapas, listImplantacoesAbertas } from "@/lib/data/implantacoes";

/**
 * A esteira de implantação: nasce quando um negócio é ganho no Pipeline
 * (`ganharNegocio`, `src/lib/actions/deals.ts`), atravessa as etapas de
 * `implantacao_etapas` e termina quando a conta vira cliente.
 *
 * Ainda não está no menu lateral — é a Task 6 desta fase.
 *
 * Se QUALQUER uma das duas leituras falhar, a tela inteira vira aviso — mesma
 * disciplina de `/hoje`: uma tela "isto é tudo que precisa de atenção"
 * mentindo por omissão (etapas sem SLA visível, ou implantações que
 * simplesmente não aparecem) é pior que avisar que não carregou.
 */
export default async function ImplantacaoPage() {
  const [etapasLidas, implantacoesLidas] = await Promise.all([listEtapas(), listImplantacoesAbertas()]);

  if (etapasLidas.unavailable || implantacoesLidas.unavailable) {
    return (
      <PageBody>
        <ImplantacaoClient implantacoes={[]} etapas={[]} unavailable />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <ImplantacaoClient implantacoes={implantacoesLidas.implantacoes} etapas={etapasLidas.etapas} />
    </PageBody>
  );
}

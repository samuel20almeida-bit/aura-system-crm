"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageBody";
import { Button } from "@/components/ui/Button";
import { Unavailable } from "@/components/ui/Unavailable";
import { useToast } from "@/components/ui/Toast";
import { PipelineBoard } from "./PipelineBoard";
import { NegocioDrawer } from "./NegocioDrawer";
import { NovoNegocioModal } from "./NovoNegocioModal";
import { formatCurrency } from "@/lib/format";
import { baixarPlanilha } from "@/lib/baixar-planilha";
import { abasDoPipeline, estaParado, nomeDaPlanilha } from "@/lib/pipeline-planilha";
import type { NegocioAberto } from "@/lib/data/deals";
import { EmptyState } from "@/components/ui/EmptyState";

export function PipelineClient({
  negocios,
  profiles,
  unavailable = false,
  negocioInicialId = null,
}: {
  negocios: NegocioAberto[];
  profiles: { id: string; full_name: string }[];
  unavailable?: boolean;
  /**
   * Vem de `searchParams.negocio`, lido uma vez no server (mesmo padrão de
   * `KanbanClient`/`kanban/page.tsx`: o server lê o parâmetro e passa como
   * prop inicial, sem `useSearchParams` no cliente). Deep-link de `/hoje`.
   */
  negocioInicialId?: string | null;
}) {
  const { notify } = useToast();
  const [mostrarNovo, setMostrarNovo] = useState(false);
  // A planilha é montada e zipada no navegador. Com o funil grande isso leva
  // um instante, e um botão que não responde ao clique é lido como quebrado.
  const [exportando, setExportando] = useState(false);
  const [idSelecionado, setIdSelecionado] = useState<string | null>(negocioInicialId);

  // Um instante só para a tela inteira: cartões, gaveta e resumo têm que
  // concordar sobre que horas são. Reancorado a cada leitura nova de `negocios`
  // — não fotografado uma vez para a vida inteira do componente. Com deps
  // vazias, uma aba deixada aberta de um dia para o outro nunca envelhece: um
  // negócio que cruzou os 7 dias parado continuaria desenhado "ok" mesmo depois
  // de `negocios` chegar atualizado — seja no payload que a Server Action
  // devolve junto da resposta (a action revalida `/pipeline`), seja pelo
  // `router.refresh()` que ainda existe no caminho de erro do arraste —,
  // porque o React preserva o estado do componente entre renders. A tela que
  // existe para gritar sobre negócio esquecido ficaria ela mesma esquecida.
  // `negocios` é usado como sinal de "leitura nova chegou", não como valor lido
  // dentro do memo — daí o disable, na linha certa, logo antes do código.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const agora = useMemo(() => new Date(), [negocios]);

  // `estaParado` é `saudeDoNegocio(...) === "podre"` embrulhado — o mesmo
  // predicado que a planilha usa para montar a aba "Parados". Compartilhar a
  // função, e não repetir a condição, é o que garante que o número desta linha
  // e a contagem de linhas do arquivo exportado nunca divirjam.
  const podres = negocios.filter((n) => estaParado(n, agora)).length;

  const mrrEmJogo = negocios.reduce((soma, n) => soma + Number(n.mrr ?? 0), 0);

  // A gaveta lê da lista do servidor, não de uma cópia: depois de salvar, o
  // payload novo da rota chega junto com a resposta da Server Action (que
  // revalida `/pipeline`), `negocios` é atualizado e a gaveta acompanha. Se o
  // negócio saiu do funil (ganho ou perdido), ela simplesmente não encontra
  // mais e fecha.
  const selecionado = idSelecionado ? negocios.find((n) => n.id === idSelecionado) ?? null : null;

  return (
    <>
      <PageHeader
        title="Pipeline"
        sub={
          unavailable
            ? "Cadastre um negócio — a leitura do quadro falhou, a escrita não."
            : `${negocios.length} ${negocios.length === 1 ? "negócio em aberto" : "negócios em aberto"} · ${podres} apodrecendo · ${formatCurrency(mrrEmJogo)}/mês em jogo`
        }
        actions={
          <>
            {/* Exporta o que ESTÁ NO QUADRO — o funil aberto, na mesma
                ordem —, e não uma segunda consulta ao banco. Duas razões: o
                arquivo bate com o que a pessoa acabou de ver (um export que
                traz negócio ganho seria surpresa), e o dado já está no
                cliente, então não há ida ao servidor nem estado de espera.

                Desabilitado com o quadro vazio: baixar um arquivo só com
                cabeçalho parece falha, e explicar isso depois custa mais que
                não deixar acontecer. */}
            <Button
              variant="ghost"
              disabled={unavailable || negocios.length === 0 || exportando}
              onClick={async () => {
                setExportando(true);
                try {
                  await baixarPlanilha(nomeDaPlanilha(agora), abasDoPipeline(negocios, agora));
                } catch (erro) {
                  console.error("[pipeline] falha ao montar a planilha:", erro);
                  notify("error", "Não foi possível gerar a planilha. Tente de novo — se persistir, me avise.");
                } finally {
                  setExportando(false);
                }
              }}
            >
              {exportando ? "Gerando…" : `Exportar (${podres} parados)`}
            </Button>
            <Button onClick={() => setMostrarNovo(true)}>+ Novo negócio</Button>
          </>
        }
      />

      {/* Uma falha de LEITURA nunca pode tirar a capacidade de ESCREVER: o aviso
          substitui o quadro, mas o botão de cadastrar continua onde estava. É a
          mesma regra que o CRM antigo já seguia. */}
      {unavailable && <Unavailable title="Não foi possível carregar o pipeline agora" />}

      {!unavailable && negocios.length === 0 && (
        <EmptyState
          title="Nenhum negócio no funil ainda."
          sub={'Cadastre o primeiro em "+ Novo negócio" — o quadro só mostra o que existe de verdade.'}
        />
      )}

      {!unavailable && (
        <PipelineBoard negocios={negocios} agora={agora} onOpenNegocio={setIdSelecionado} />
      )}

      {selecionado && (
        <NegocioDrawer
          // Remontar ao trocar de negócio: sem a chave, o texto digitado num
          // negócio reapareceria no seguinte.
          key={selecionado.id}
          negocio={selecionado}
          agora={agora}
          onClose={() => setIdSelecionado(null)}
        />
      )}

      {mostrarNovo && <NovoNegocioModal profiles={profiles} onClose={() => setMostrarNovo(false)} />}
    </>
  );
}

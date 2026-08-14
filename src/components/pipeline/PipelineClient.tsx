"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageBody";
import { Button } from "@/components/ui/Button";
import { Unavailable } from "@/components/ui/Unavailable";
import { PipelineBoard } from "./PipelineBoard";
import { NegocioDrawer } from "./NegocioDrawer";
import { NovoNegocioModal } from "./NovoNegocioModal";
import { formatCurrency } from "@/lib/format";
import { saudeDoNegocio } from "@/lib/negocios";
import type { NegocioAberto } from "@/lib/data/deals";

export function PipelineClient({
  negocios,
  profiles,
  unavailable = false,
}: {
  negocios: NegocioAberto[];
  profiles: { id: string; full_name: string }[];
  unavailable?: boolean;
}) {
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);

  // Um instante só para a tela inteira: cartões, gaveta e resumo têm que
  // concordar sobre que horas são. Fotografado uma vez para não mudar entre
  // dois renders da mesma sessão (é o mesmo cuidado que o Kanban tem com "hoje").
  const agora = useMemo(() => new Date(), []);

  const podres = negocios.filter(
    (n) =>
      saudeDoNegocio(
        { proximoPasso: n.proximo_passo, proximoPassoEm: n.proximo_passo_em, mexidoEm: n.mexido_em },
        agora
      ) === "podre"
  ).length;

  const mrrEmJogo = negocios.reduce((soma, n) => soma + Number(n.mrr ?? 0), 0);

  // A gaveta lê da lista do servidor, não de uma cópia: depois de salvar, o
  // `router.refresh()` traz o dado novo e a gaveta acompanha. Se o negócio saiu
  // do funil (ganho ou perdido), ela simplesmente não encontra mais e fecha.
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
        actions={<Button onClick={() => setMostrarNovo(true)}>+ Novo negócio</Button>}
      />

      {/* Uma falha de LEITURA nunca pode tirar a capacidade de ESCREVER: o aviso
          substitui o quadro, mas o botão de cadastrar continua onde estava. É a
          mesma regra que o CRM antigo já seguia. */}
      {unavailable && <Unavailable title="Não foi possível carregar o pipeline agora" />}

      {!unavailable && negocios.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <div className="text-[13px] font-medium">Nenhum negócio no funil ainda.</div>
          <div className="mt-1 text-[12.5px] text-muted">
            Cadastre o primeiro em &quot;+ Novo negócio&quot; — o quadro só mostra o que existe de verdade.
          </div>
        </div>
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

"use client";

import { useOptimistic, useTransition } from "react";
import { Slideover } from "@/components/ui/Overlay";
import { Field, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { beginMutation } from "@/lib/realtime/mutation-gate";
import { concluirImplantacao, moverEtapa } from "@/lib/actions/implantacoes";
import { ROTULO_DA_SAUDE, diasParado, rotuloVencimento } from "@/lib/negocios";
import { saudeDaImplantacao, vencimentoDaEtapa } from "@/lib/implantacoes";
import type { Etapa, ImplantacaoAberta } from "@/lib/data/implantacoes";

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <>
      <span className="text-muted">{rotulo}</span>
      <span className={valor ? "" : "text-faint"}>{valor || "—"}</span>
    </>
  );
}

/**
 * A gaveta da implantação: abre sobre o quadro, não navega.
 *
 * O pai monta este componente com `key={implantacao.id}` (mesmo padrão de
 * `NegocioDrawer.tsx`), então trocar de implantação remonta.
 */
export function ImplantacaoDrawer({
  implantacao,
  etapas,
  agora,
  onClose,
}: {
  implantacao: ImplantacaoAberta;
  etapas: Etapa[];
  agora: Date;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const [pendente, startTransition] = useTransition();

  // Deliberadamente NÃO usam o valor otimista: dependem de `etapa_desde`, que
  // só o servidor sabe zerar. Um SLA otimista mostraria um prazo que ainda
  // não existe — o seletor responde na hora, mas este rótulo espera a
  // confirmação do servidor.
  const etapaAtual = etapas.find((e) => e.posicao === implantacao.etapa) ?? null;
  const vencimento = etapaAtual ? vencimentoDaEtapa(implantacao.etapa_desde, etapaAtual.sla_dias) : null;
  const saude = etapaAtual ? saudeDaImplantacao(vencimento!, etapaAtual.espera, agora) : "ok";

  // Mesmo padrão da gaveta do negócio (`NegocioDrawer.tsx`): a etapa responde
  // no clique e reverte sozinha se a escrita falhar.
  const [etapaOtimista, setEtapaOtimista] = useOptimistic(implantacao.etapa);

  function trocarEtapa(nova: number) {
    startTransition(async () => {
      setEtapaOtimista(nova);
      const end = beginMutation();
      try {
        await moverEtapa(implantacao.id, nova);
      } catch (erro) {
        console.error("[implantacao] falha ao mover a implantação de etapa:", erro);
        notify("error", "Não foi possível mover a implantação de etapa. Tente de novo — se persistir, me avise.");
      } finally {
        end();
      }
    });
  }

  // Sem `router.refresh()`: `concluirImplantacao` chama
  // `revalidatePath("/implantacao")`, e o Next devolve o payload novo desta
  // rota junto com a resposta da action. Um refresh depois disso renderizaria
  // a rota inteira uma segunda vez. Ver a auditoria action × rota no plano da
  // 5F. `moverEtapa` segue o mesmo raciocínio, mas por um caminho próprio —
  // `trocarEtapa`, acima — porque a resposta some no `useOptimistic` em vez de
  // passar por aqui.
  /** As escritas da gaveta que não têm valor otimista próprio passam por aqui: portão, aviso em caso de falha, e a janela continua aberta. */
  function executar(oQue: string, acao: () => Promise<unknown>, depois?: () => void) {
    startTransition(async () => {
      const end = beginMutation();
      try {
        await acao();
        depois?.();
      } catch (erro) {
        console.error(`[implantacao] falha ao ${oQue}:`, erro);
        notify("error", `Não foi possível ${oQue}. Tente de novo — se persistir, me avise.`);
      } finally {
        end();
      }
    });
  }

  return (
    <Slideover onClose={onClose}>
      <div className="flex items-start gap-2.5 border-b border-border px-5.5 py-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-medium">{implantacao.conta?.nome ?? "Conta sem nome"}</div>
          <div className="mt-0.5 font-mono text-[11px] text-muted">
            {ROTULO_DA_SAUDE[saude]} · na etapa há {diasParado(implantacao.etapa_desde, agora)}d
          </div>
        </div>
        <Avatar initials={implantacao.dono?.initials} size="sm" ghost={!implantacao.dono} />
        <button onClick={onClose} className="text-[15px] text-muted hover:text-ink" aria-label="Fechar">
          ✕
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4.5 overflow-y-auto scrollbar-thin px-5.5 py-4">
        <div>
          <div className="label mb-2">A CONTA</div>
          <div className="grid grid-cols-[112px_1fr] gap-x-3 gap-y-2 text-[13px]">
            <Linha rotulo="Nicho" valor={implantacao.conta?.nicho} />
            <Linha
              rotulo="Cidade"
              valor={[implantacao.conta?.cidade, implantacao.conta?.uf].filter(Boolean).join(" · ") || null}
            />
            <Linha rotulo="Dono" valor={implantacao.dono?.full_name} />
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="label">A IMPLANTAÇÃO</div>
          {/* Único jeito de mudar de etapa sem arrastar: o quadro não tem
              KeyboardSensor, e o arraste fica desabilitado no celular. Sem
              isto, a tela vira somente-leitura fora do desktop com mouse —
              mesmo raciocínio de `NegocioDrawer.tsx`. */}
          <Field label="ETAPA">
            <Select value={String(etapaOtimista)} onChange={(e) => trocarEtapa(Number(e.target.value))}>
              {etapas.map((etapa) => (
                <option key={etapa.posicao} value={etapa.posicao}>
                  {etapa.nome}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
            <div className="text-muted">na etapa há {diasParado(implantacao.etapa_desde, agora)}d</div>
            {/* Mesmo rótulo que /pipeline e /hoje usam para "estourou o
                prazo?" — achado na revisão final: "SLA vence 2026-08-03"
                cru era a única das três telas sem essa gramática. */}
            <div className={saude === "podre" ? "text-red" : "text-muted"}>
              {vencimento ? rotuloVencimento(vencimento, agora) : "sem SLA"}
            </div>
          </div>
        </div>
      </div>

      {/* `disabled` aqui não é espera de leitura — é guarda contra clique
          duplo numa ação que muda a fase da conta. Os seletores otimistas
          desta gaveta não usam mais `disabled`. */}
      <div className="flex items-center justify-end border-t border-border px-5.5 py-3">
        <Button
          disabled={pendente}
          onClick={() => {
            if (!confirm("Concluir a implantação? A conta vira cliente.")) return;
            executar("concluir a implantação", () => concluirImplantacao(implantacao.id), onClose);
          }}
        >
          {pendente ? "Concluindo…" : "Concluir implantação"}
        </Button>
      </div>
    </Slideover>
  );
}

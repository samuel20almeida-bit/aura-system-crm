"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const { notify } = useToast();
  const [pendente, startTransition] = useTransition();

  const etapaAtual = etapas.find((e) => e.posicao === implantacao.etapa) ?? null;
  const vencimento = etapaAtual ? vencimentoDaEtapa(implantacao.etapa_desde, etapaAtual.sla_dias) : null;
  const saude = etapaAtual ? saudeDaImplantacao(vencimento!, etapaAtual.espera, agora) : "ok";

  /** Toda escrita da gaveta passa por aqui: portão, aviso em caso de falha, e a janela continua aberta. */
  function executar(oQue: string, acao: () => Promise<unknown>, depois?: () => void) {
    startTransition(async () => {
      const end = beginMutation();
      try {
        await acao();
        router.refresh();
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
            <Select
              value={String(implantacao.etapa)}
              disabled={pendente}
              onChange={(e) =>
                executar("mover a implantação de etapa", () =>
                  moverEtapa(implantacao.id, Number(e.target.value))
                )
              }
            >
              {etapas.map((etapa) => (
                <option key={etapa.posicao} value={etapa.posicao}>
                  {etapa.nome}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
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

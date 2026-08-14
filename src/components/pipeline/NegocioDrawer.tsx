"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Slideover } from "@/components/ui/Overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { beginMutation } from "@/lib/realtime/mutation-gate";
import { atualizarNegocio, ganharNegocio, moverNegocioParaEstagio, perderNegocio } from "@/lib/actions/deals";
import { diasParado, rotuloVencimento, saudeDoNegocio } from "@/lib/negocios";
import { ESTAGIOS, type EstagioId } from "./PipelineBoard";
import type { NegocioAberto } from "@/lib/data/deals";

const ROTULO_DA_SAUDE = {
  ok: "Em dia",
  atencao: "Pede atenção",
  podre: "Apodrecendo",
} as const;

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <>
      <span className="text-muted">{rotulo}</span>
      <span className={valor ? "" : "text-faint"}>{valor || "—"}</span>
    </>
  );
}

/**
 * A gaveta do negócio: abre sobre o quadro, não navega.
 *
 * O pai monta este componente com `key={negocio.id}`, então trocar de negócio
 * remonta e os campos abaixo voltam a nascer do dado do servidor — sem isso o
 * texto digitado num negócio apareceria no seguinte.
 */
export function NegocioDrawer({
  negocio,
  agora,
  onClose,
}: {
  negocio: NegocioAberto;
  agora: Date;
  onClose: () => void;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pendente, startTransition] = useTransition();

  const [proximoPasso, setProximoPasso] = useState(negocio.proximo_passo ?? "");
  const [proximoPassoEm, setProximoPassoEm] = useState(negocio.proximo_passo_em ?? "");
  const [setup, setSetup] = useState(negocio.setup === null ? "" : String(negocio.setup));
  const [mrr, setMrr] = useState(negocio.mrr === null ? "" : String(negocio.mrr));
  const [pedindoMotivo, setPedindoMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");

  const saude = saudeDoNegocio(
    {
      proximoPasso: negocio.proximo_passo,
      proximoPassoEm: negocio.proximo_passo_em,
      mexidoEm: negocio.mexido_em,
    },
    agora
  );
  const vencimento = rotuloVencimento(negocio.proximo_passo_em, agora);

  /** Toda escrita da gaveta passa por aqui: portão, aviso em caso de falha, e a janela continua aberta. */
  function executar(oQue: string, acao: () => Promise<unknown>, depois?: () => void) {
    startTransition(async () => {
      const end = beginMutation();
      try {
        await acao();
        router.refresh();
        depois?.();
      } catch (erro) {
        console.error(`[pipeline] falha ao ${oQue}:`, erro);
        notify("error", `Não foi possível ${oQue}. Tente de novo — se persistir, me avise.`);
      } finally {
        end();
      }
    });
  }

  function numeroOuNulo(valor: string): number | null {
    const limpo = valor.trim();
    if (limpo === "") return null;
    const numero = Number(limpo);
    return Number.isFinite(numero) ? numero : null;
  }

  // Os campos têm `min="0"`, mas os botões não estão dentro de um `<form>` — a
  // restrição nativa do navegador nunca dispara. O servidor recusa o valor
  // negativo, mas sem isto o toast de erro que o usuário veria é o genérico
  // ("não foi possível salvar"), que não diz o que corrigir. Barrar aqui é o
  // mesmo raciocínio do botão "Confirmar perda", desabilitado até o motivo
  // deixar de estar vazio.
  const valoresInvalidos = (numeroOuNulo(setup) ?? 0) < 0 || (numeroOuNulo(mrr) ?? 0) < 0;

  return (
    <Slideover onClose={onClose}>
      <div className="flex items-start gap-2.5 border-b border-border px-5.5 py-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-medium">{negocio.conta?.nome ?? "Conta sem nome"}</div>
          <div className="mt-0.5 font-mono text-[11px] text-muted">
            {ROTULO_DA_SAUDE[saude]} · parado há {diasParado(negocio.mexido_em, agora)}d
          </div>
        </div>
        <Avatar initials={negocio.dono?.initials} size="sm" ghost={!negocio.dono} />
        <button onClick={onClose} className="text-[15px] text-muted hover:text-ink" aria-label="Fechar">
          ✕
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4.5 overflow-y-auto scrollbar-thin px-5.5 py-4">
        <div>
          <div className="label mb-2">A CONTA</div>
          <div className="grid grid-cols-[112px_1fr] gap-x-3 gap-y-2 text-[13px]">
            <Linha rotulo="Nicho" valor={negocio.conta?.nicho} />
            <Linha
              rotulo="Cidade"
              valor={[negocio.conta?.cidade, negocio.conta?.uf].filter(Boolean).join(" · ") || null}
            />
            <Linha rotulo="Decisor" valor={negocio.conta?.decisor_nome} />
            <Linha rotulo="Software atual" valor={negocio.conta?.software_atual} />
            <Linha rotulo="Origem" valor={negocio.conta?.origem} />
            <Linha rotulo="Dono" valor={negocio.dono?.full_name} />
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="label">O NEGÓCIO</div>
          {/* Único jeito de mudar de estágio sem arrastar: o quadro não tem
              KeyboardSensor, e o arraste fica desabilitado no celular. Sem
              isto, o Pipeline vira somente-leitura fora do desktop com mouse. */}
          <Field label="ESTÁGIO">
            <Select
              value={negocio.estagio}
              disabled={pendente}
              onChange={(e) =>
                executar("mover o negócio de estágio", () =>
                  moverNegocioParaEstagio(negocio.id, e.target.value as EstagioId)
                )
              }
            >
              {ESTAGIOS.map((estagio) => (
                <option key={estagio.id} value={estagio.id}>
                  {estagio.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="PRÓXIMO PASSO">
            <Textarea
              rows={2}
              value={proximoPasso}
              onChange={(e) => setProximoPasso(e.target.value)}
              placeholder="Ligar para confirmar a proposta"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="QUANDO">
              <Input type="date" value={proximoPassoEm} onChange={(e) => setProximoPassoEm(e.target.value)} />
            </Field>
            <div className="flex items-end pb-2 font-mono text-[11px] text-muted">
              {vencimento ? `vence ${vencimento}` : "sem data"}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SETUP (R$)">
              <Input type="number" min="0" step="0.01" value={setup} onChange={(e) => setSetup(e.target.value)} />
            </Field>
            <Field label="MENSALIDADE (R$)">
              <Input type="number" min="0" step="0.01" value={mrr} onChange={(e) => setMrr(e.target.value)} />
            </Field>
          </div>
        </div>

        {pedindoMotivo && (
          <Field label="MOTIVO DA PERDA">
            <Textarea
              autoFocus
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Preço, concorrente, sumiu…"
            />
          </Field>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5.5 py-3">
        {pedindoMotivo ? (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setPedindoMotivo(false);
                setMotivo("");
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={pendente || motivo.trim() === ""}
              onClick={() =>
                executar("marcar o negócio como perdido", () => perderNegocio(negocio.id, motivo.trim()), onClose)
              }
            >
              Confirmar perda
            </Button>
          </>
        ) : (
          <>
            <Button
              disabled={pendente || valoresInvalidos}
              onClick={() =>
                executar("salvar o próximo passo", () =>
                  atualizarNegocio({
                    negocioId: negocio.id,
                    proximoPasso: proximoPasso.trim() || null,
                    proximoPassoEm: proximoPassoEm || null,
                    setup: numeroOuNulo(setup),
                    mrr: numeroOuNulo(mrr),
                  })
                )
              }
            >
              {pendente ? "Salvando…" : "Definir próximo passo"}
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                disabled={pendente}
                onClick={() => {
                  if (!confirm("Marcar como ganho? Isso vira uma implantação depois.")) return;
                  executar("marcar o negócio como ganho", () => ganharNegocio(negocio.id), onClose);
                }}
              >
                Ganhar
              </Button>
              <Button variant="danger" disabled={pendente} onClick={() => setPedindoMotivo(true)}>
                Perder
              </Button>
            </div>
          </>
        )}
      </div>
    </Slideover>
  );
}

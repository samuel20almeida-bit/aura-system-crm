"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";
import { CLASSE_DO_PONTO_DE_SAUDE, ROTULO_DA_SAUDE, diasParado, rotuloVencimento } from "@/lib/negocios";
import { saudeDaImplantacao, vencimentoDaEtapa } from "@/lib/implantacoes";
import type { Etapa, ImplantacaoAberta } from "@/lib/data/implantacoes";

// O ponto de saúde e o vocabulário de cor vêm de `src/lib/negocios.ts`, não
// daqui — a mesma régua visual do Pipeline e de `/hoje`. Um terceiro
// vocabulário nesta tela já foi um bug real (revisão final da 3A): NegocioCard,
// HojeClient e NegocioDrawer tinham cada um sua própria cópia até serem
// consolidados. Não repetir aqui.

const ROTULO_ESPERA: Record<Etapa["espera"], string> = {
  nos: "esperando você",
  cliente: "esperando cliente",
};

export function ImplantacaoCard({
  implantacao,
  etapa,
  agora,
  onOpen,
  dragDisabled,
}: {
  implantacao: ImplantacaoAberta;
  /** A etapa em que o cartão está agora — dono do SLA e de quem se espera. */
  etapa: Etapa;
  /** Um só instante para o quadro inteiro: dois cartões não podem discordar sobre que horas são. */
  agora: Date;
  onOpen: () => void;
  dragDisabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: implantacao.id,
    disabled: dragDisabled,
  });

  const vencimento = vencimentoDaEtapa(implantacao.etapa_desde, etapa.sla_dias);
  const saude = saudeDaImplantacao(vencimento, etapa.espera, agora);
  const parado = diasParado(implantacao.etapa_desde, agora);
  // Achado na revisão final: "{parado}d" sozinho não responde "estourou o
  // prazo?" (o próprio propósito desta tela, spec) — 14d é normal numa
  // etapa de SLA 14 e grave numa de SLA 1. O rótulo de vencimento é o
  // mesmo que /pipeline e /hoje já usam para a mesma pergunta.
  const rotulo = rotuloVencimento(vencimento, agora);
  const contexto = [implantacao.conta?.nicho, implantacao.conta?.cidade].filter(Boolean).join(" · ");

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={clsx(
        "flex cursor-pointer flex-col gap-2 rounded-card border border-border bg-surface p-3 shadow-raised transition-shadow duration-fast hover:shadow-layer",
        isDragging && "opacity-40 shadow-overlay"
      )}
    >
      {/* Mesma correção de hierarquia do cartão do Pipeline, com o campo
          enterrado sendo outro. Lá era o dinheiro; aqui é DE QUEM SE ESPERA —
          a única informação do cartão que responde "isto é comigo agora?", e
          ela era o menor texto da caixa, a 11px, distinguida do outro estado
          só por `text-ink` contra `text-muted`. Vira tag: forma diferente,
          não só cor um pouco mais escura. */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            title={ROTULO_DA_SAUDE[saude]}
            className={clsx("h-2 w-2 flex-none rounded-full", CLASSE_DO_PONTO_DE_SAUDE[saude])}
          />
          <span className="truncate text-title font-medium">{implantacao.conta?.nome ?? "Conta sem nome"}</span>
        </div>
        <span title="dias nesta etapa" className="flex-none font-mono text-label tabular-nums text-faint">
          {parado}d
        </span>
      </div>

      {contexto && <div className="truncate text-small text-faint">{contexto}</div>}

      <div className="flex items-center justify-between gap-2 border-t border-border-soft pt-2">
        {/* `accent` quando a bola está com a gente, `neutral` quando está com o
            cliente: o que exige ação nossa fica com a cor da marca, e o que só
            aguarda recua. */}
        <Tag tone={etapa.espera === "nos" ? "accent" : "neutral"}>{ROTULO_ESPERA[etapa.espera]}</Tag>
        <div className="flex flex-none items-center gap-2">
          {rotulo && (
            <span
              className={clsx(
                "font-mono text-label tabular-nums",
                saude === "podre" ? "text-red" : "text-muted"
              )}
            >
              {rotulo}
            </span>
          )}
          <Avatar initials={implantacao.dono?.initials} size="sm" ghost={!implantacao.dono} />
        </div>
      </div>
    </div>
  );
}

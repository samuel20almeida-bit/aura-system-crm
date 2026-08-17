"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { CLASSE_DO_PONTO_DE_SAUDE, ROTULO_DA_SAUDE, diasParado } from "@/lib/negocios";
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
  const contexto = [implantacao.conta?.nicho, implantacao.conta?.cidade].filter(Boolean).join(" · ");

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={clsx(
        "flex cursor-pointer flex-col gap-2 rounded-[10px] border border-border bg-surface p-2.75 shadow-[0_1px_2px_rgba(30,30,28,.05)] transition-shadow duration-150 hover:shadow-[0_2px_8px_rgba(30,30,28,.10)]",
        isDragging && "opacity-40 shadow-[0_8px_24px_rgba(30,30,28,.18)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            title={ROTULO_DA_SAUDE[saude]}
            className={clsx("h-2 w-2 flex-none rounded-full", CLASSE_DO_PONTO_DE_SAUDE[saude])}
          />
          <span className="truncate text-[13px] font-medium">{implantacao.conta?.nome ?? "Conta sem nome"}</span>
        </div>
        <span className="flex-none font-mono text-[11px] text-muted">{parado}d</span>
      </div>

      {contexto && <div className="truncate text-[11.5px] text-muted">{contexto}</div>}

      <div className="flex items-center justify-between gap-2 border-t border-border-soft pt-2">
        <span
          className={clsx(
            "truncate text-[11px] font-medium",
            etapa.espera === "cliente" ? "text-muted" : "text-ink"
          )}
        >
          {ROTULO_ESPERA[etapa.espera]}
        </span>
        <Avatar initials={implantacao.dono?.initials} size="sm" ghost={!implantacao.dono} />
      </div>
    </div>
  );
}

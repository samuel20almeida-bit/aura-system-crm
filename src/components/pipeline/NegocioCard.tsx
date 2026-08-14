"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import { diasParado, rotuloVencimento, saudeDoNegocio, type SaudeNegocio } from "@/lib/negocios";
import type { NegocioAberto } from "@/lib/data/deals";

/**
 * O ponto de saúde — a assinatura visual da tela.
 *
 * Verde: em dia. Contorno neutro: já pede atenção. Vermelho pulsando: podre. A
 * classe do pulso é a que o sino já usa (`animate-pulse-soft`, globals.css);
 * `motion-safe:` não gera CSS neste projeto e o bloco global de
 * `prefers-reduced-motion` já cobre quem pediu menos movimento.
 */
const CLASSE_DO_PONTO: Record<SaudeNegocio, string> = {
  ok: "bg-accent",
  atencao: "border-[1.5px] border-faint",
  podre: "bg-red animate-pulse-soft",
};

const TITULO_DO_PONTO: Record<SaudeNegocio, string> = {
  ok: "Em dia",
  atencao: "Pede atenção",
  podre: "Apodrecendo",
};

function valorDoNegocio(negocio: { setup: number | null; mrr: number | null }): string | null {
  const partes: string[] = [];
  if (negocio.setup !== null) partes.push(`${formatCurrencyCompact(Number(negocio.setup))} setup`);
  if (negocio.mrr !== null) partes.push(`${formatCurrency(Number(negocio.mrr))}/mês`);
  return partes.length > 0 ? partes.join(" · ") : null;
}

export function NegocioCard({
  negocio,
  agora,
  onOpen,
  dragDisabled,
}: {
  negocio: NegocioAberto;
  /** Um só instante para o quadro inteiro: dois cartões não podem discordar sobre que horas são. */
  agora: Date;
  onOpen: () => void;
  dragDisabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: negocio.id,
    disabled: dragDisabled,
  });

  const saude = saudeDoNegocio(
    {
      proximoPasso: negocio.proximo_passo,
      proximoPassoEm: negocio.proximo_passo_em,
      mexidoEm: negocio.mexido_em,
    },
    agora
  );
  const parado = diasParado(negocio.mexido_em, agora);
  const vencimento = rotuloVencimento(negocio.proximo_passo_em, agora);
  const semProximoPasso = !negocio.proximo_passo || negocio.proximo_passo.trim() === "";
  const valor = valorDoNegocio(negocio);
  const contexto = [negocio.conta?.nicho, negocio.conta?.cidade].filter(Boolean).join(" · ");

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
            title={TITULO_DO_PONTO[saude]}
            className={clsx("h-2 w-2 flex-none rounded-full", CLASSE_DO_PONTO[saude])}
          />
          <span className="truncate text-[13px] font-medium">{negocio.conta?.nome ?? "Conta sem nome"}</span>
        </div>
        <span className="flex-none font-mono text-[11px] text-muted">{parado}d</span>
      </div>

      {contexto && <div className="truncate text-[11.5px] text-muted">{contexto}</div>}

      {valor && <div className="font-mono text-[11.5px] text-ink">{valor}</div>}

      <div className="flex items-center justify-between gap-2 border-t border-border-soft pt-2">
        {semProximoPasso ? (
          // O estado que esta tela existe para gritar.
          <span className="truncate text-[11.5px] font-medium text-red">Sem próximo passo</span>
        ) : (
          <span className="truncate text-[11.5px] text-muted">{negocio.proximo_passo}</span>
        )}
        <div className="flex flex-none items-center gap-2">
          {vencimento && (
            <span className={clsx("font-mono text-[11px]", saude === "podre" ? "text-red" : "text-muted")}>
              {vencimento}
            </span>
          )}
          <Avatar initials={negocio.dono?.initials} size="sm" ghost={!negocio.dono} />
        </div>
      </div>
    </div>
  );
}

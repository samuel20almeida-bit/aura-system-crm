"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import {
  CLASSE_DO_PONTO_DE_SAUDE,
  ROTULO_DA_SAUDE,
  diasParado,
  rotuloVencimento,
  saudeDoNegocio,
} from "@/lib/negocios";
import type { NegocioAberto } from "@/lib/data/deals";

// O ponto de saúde — a assinatura visual da tela. Cor e rótulo vêm de
// `src/lib/negocios.ts`, não daqui: um segundo vocabulário neste arquivo
// divergiria de `/hoje` com o tempo (já aconteceu, corrigido na revisão
// final da 3A). A classe do pulso é a que o sino já usa
// (`animate-pulse-soft`, globals.css); `motion-safe:` não gera CSS neste
// projeto e o bloco global de `prefers-reduced-motion` já cobre quem pediu
// menos movimento.

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
        // Raio e sombras passam a ser os tokens. Eram `rounded-[10px]` e três
        // sombras escritas em `rgba()` à mão — os mesmos valores que a etapa B
        // já tinha nomeado e que ninguém usava.
        "flex cursor-pointer flex-col gap-2 rounded-card border border-border bg-surface p-3 shadow-raised transition-shadow duration-fast hover:shadow-layer",
        isDragging && "opacity-40 shadow-overlay"
      )}
    >
      {/* A auditoria dizia que este cartão não tem hierarquia, e a medida
          confirmava: nome 13px, contexto 11,5px, valor 11,5px, próximo passo
          11,5px, prazo 11px. Tudo dentro de 2px, logo nada salta, e o olho
          percorre linha a linha em vez de encontrar. A ordem que importa numa
          varredura do funil é: QUEM é a conta, QUANTO vale, QUAL o próximo
          movimento. Agora são 15 / 12 / 13 / 12 / 11. */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            title={ROTULO_DA_SAUDE[saude]}
            className={clsx("h-2 w-2 flex-none rounded-full", CLASSE_DO_PONTO_DE_SAUDE[saude])}
          />
          <span className="truncate text-title font-medium">{negocio.conta?.nome ?? "Conta sem nome"}</span>
        </div>
        <span title="dias parado" className="flex-none font-mono text-label tabular-nums text-faint">
          {parado}d
        </span>
      </div>

      {contexto && <div className="truncate text-small text-faint">{contexto}</div>}

      {/* O dinheiro era o penúltimo item mais discreto do cartão, num quadro de
          vendas. Sobe para o corpo, com peso e `tabular-nums` para as colunas
          de valor se alinharem entre cartões. */}
      {valor && <div className="text-body font-medium tabular-nums">{valor}</div>}

      <div className="flex items-center justify-between gap-2 border-t border-border-soft pt-2">
        {semProximoPasso ? (
          // O estado que esta tela existe para gritar.
          <span className="truncate text-small font-medium text-red">Sem próximo passo</span>
        ) : (
          <span className="truncate text-small text-muted">{negocio.proximo_passo}</span>
        )}
        <div className="flex flex-none items-center gap-2">
          {vencimento && (
            <span
              className={clsx(
                "font-mono text-label tabular-nums",
                saude === "podre" ? "text-red" : "text-muted"
              )}
            >
              {vencimento}
            </span>
          )}
          <Avatar initials={negocio.dono?.initials} size="sm" ghost={!negocio.dono} />
        </div>
      </div>
    </div>
  );
}

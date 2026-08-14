"use client";

import { useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import { PageHeader } from "@/components/layout/PageBody";
import { Avatar } from "@/components/ui/Avatar";
import { Unavailable } from "@/components/ui/Unavailable";
import { rotuloVencimento, type SaudeNegocio } from "@/lib/negocios";
import { negocioParaItemHoje, ordenarPorUrgencia, tarefaParaItemHoje, type ItemHoje } from "@/lib/hoje";
import type { NegocioHoje, TarefaHoje } from "@/lib/data/hoje";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * Mesma linguagem visual do ponto de saúde do Pipeline (`NegocioCard.tsx`):
 * verde em dia, contorno neutro pede atenção, vermelho pulsando é podre. A
 * classe do pulso é a que o sino já usa (`animate-pulse-soft`, globals.css) —
 * reusada, não reinventada.
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

export function HojeClient({
  negocios,
  tarefas,
  profiles,
  donoOptions,
  donoAtual,
  unavailable = false,
}: {
  negocios: NegocioHoje[];
  tarefas: TarefaHoje[];
  profiles: Tables<"profiles">[];
  donoOptions: { key: string; label: string; href: string }[];
  donoAtual: string;
  unavailable?: boolean;
}) {
  // Um instante só para a tela inteira — mesmo raciocínio de `PipelineClient`:
  // reancorado a cada leitura nova (`negocios`/`tarefas` como sinal de "dado
  // novo chegou"), não fotografado uma vez para a vida do componente. Sem
  // isso, uma aba deixada aberta de um dia para o outro nunca envelheceria.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const agora = useMemo(() => new Date(), [negocios, tarefas]);

  const itens = useMemo<ItemHoje[]>(() => {
    const doNegocio = negocios.map((n) =>
      negocioParaItemHoje(
        {
          id: n.id,
          proximoPasso: n.proximo_passo,
          proximoPassoEm: n.proximo_passo_em,
          mexidoEm: n.mexido_em,
          donoId: n.dono_id,
          contaNome: n.conta?.nome ?? null,
        },
        agora
      )
    );
    const daTarefa = tarefas.map((t) =>
      tarefaParaItemHoje(
        {
          id: t.id,
          titulo: t.title,
          dueDate: t.due_date,
          donoId: t.assignee_id,
          clienteNome: t.client?.name ?? null,
        },
        agora
      )
    );
    return ordenarPorUrgencia([...doNegocio, ...daTarefa]);
  }, [negocios, tarefas, agora]);

  const profilePorId = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  return (
    <>
      <PageHeader
        title="Hoje"
        sub={
          unavailable
            ? "A leitura falhou — nada aqui deve ser lido como \"nada pendente\""
            : `${itens.length} ${itens.length === 1 ? "pendência" : "pendências"}`
        }
        actions={
          <div className="flex overflow-hidden rounded-lg border border-border bg-surface text-[12px] font-medium">
            {donoOptions.map((o) => (
              <Link
                key={o.key}
                href={o.href}
                className={clsx(
                  "border-r border-border px-3.25 py-1.75 last:border-r-0",
                  o.key === donoAtual ? "bg-ink text-bone" : "text-muted"
                )}
              >
                {o.label}
              </Link>
            ))}
          </div>
        }
      />

      {unavailable && <Unavailable title="Não foi possível carregar o que precisa de atenção hoje" />}

      {!unavailable && itens.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <div className="text-[13px] font-medium">Nada pendente — tudo em dia.</div>
        </div>
      )}

      {!unavailable && itens.length > 0 && (
        <div className="flex-1 overflow-y-auto scrollbar-thin rounded-xl border border-border bg-surface">
          {itens.map((item) => {
            const dono = item.donoId ? profilePorId.get(item.donoId) : undefined;
            const vencimento = rotuloVencimento(item.vencimento, agora);
            const href = item.origem === "negocio" ? `/pipeline?negocio=${item.id}` : `/kanban?task=${item.id}`;

            return (
              <Link
                key={`${item.origem}-${item.id}`}
                href={href}
                className="flex items-center gap-3 border-b border-border-soft px-3.5 py-2.75 text-[13px] last:border-b-0 hover:bg-neutral-tint"
              >
                <span
                  title={TITULO_DO_PONTO[item.saude]}
                  className={clsx("h-2 w-2 flex-none rounded-full", CLASSE_DO_PONTO[item.saude])}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{item.texto}</div>
                  {item.contexto && <div className="truncate text-[11.5px] text-muted">{item.contexto}</div>}
                </div>
                {vencimento && (
                  <span
                    className={clsx(
                      "flex-none font-mono text-[11px]",
                      item.saude === "podre" ? "text-red" : "text-muted"
                    )}
                  >
                    {vencimento}
                  </span>
                )}
                <Avatar initials={dono?.initials} size="sm" ghost={!dono} />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

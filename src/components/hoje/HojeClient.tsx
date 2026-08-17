"use client";

import { useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import { PageHeader } from "@/components/layout/PageBody";
import { Avatar } from "@/components/ui/Avatar";
import { Unavailable } from "@/components/ui/Unavailable";
import { LiveActivity, type LiveActivityItem } from "@/components/hoje/LiveActivity";
import { CLASSE_DO_PONTO_DE_SAUDE, ROTULO_DA_SAUDE, rotuloVencimento } from "@/lib/negocios";
import {
  implantacaoParaItemHoje,
  negocioParaItemHoje,
  ordenarPorUrgencia,
  tarefaParaItemHoje,
  type ItemHoje,
} from "@/lib/hoje";
import type { ImplantacaoHoje, NegocioHoje, TarefaHoje } from "@/lib/data/hoje";
import type { Tables } from "@/lib/supabase/database.types";

// Mesma linguagem visual do ponto de saúde do Pipeline (`NegocioCard.tsx`):
// cor e rótulo vêm de `src/lib/negocios.ts`, para as duas telas nunca
// discordarem sobre o mesmo negócio.

export function HojeClient({
  negocios,
  tarefas,
  implantacoes,
  profiles,
  donoOptions,
  donoAtual,
  activityItems,
  unavailable = false,
}: {
  negocios: NegocioHoje[];
  tarefas: TarefaHoje[];
  implantacoes: ImplantacaoHoje[];
  profiles: Tables<"profiles">[];
  donoOptions: { key: string; label: string; href: string }[];
  donoAtual: string;
  /** `null` quando a consulta de atividade falhou — `LiveActivity` monta igual, ver o componente. */
  activityItems: LiveActivityItem[] | null;
  unavailable?: boolean;
}) {
  // Um instante só para a tela inteira — mesmo raciocínio de `PipelineClient`:
  // reancorado a cada leitura nova (`negocios`/`tarefas`/`implantacoes` como
  // sinal de "dado novo chegou"), não fotografado uma vez para a vida do
  // componente. Sem isso, uma aba deixada aberta de um dia para o outro nunca
  // envelheceria.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const agora = useMemo(() => new Date(), [negocios, tarefas, implantacoes]);

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
    const daImplantacao = implantacoes.map((i) =>
      implantacaoParaItemHoje(
        {
          id: i.id,
          etapaNome: i.etapaNome,
          etapaDesde: i.etapa_desde,
          slaDias: i.slaDias,
          espera: i.espera,
          donoId: i.dono?.id ?? null,
          contaNome: i.conta?.nome ?? null,
        },
        agora
      )
    );
    return ordenarPorUrgencia([...doNegocio, ...daTarefa, ...daImplantacao]);
  }, [negocios, tarefas, implantacoes, agora]);

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

      {/* `LiveActivity` mora fora deste grid quando `unavailable` (a coluna de
          pendências vira um único aviso de largura cheia) e dentro dele nos
          outros dois casos — ver as três variantes abaixo. Monta sempre,
          mesmo com `activityItems` nulo: é o único ponto do sistema que abre
          o canal de tempo real, e trocá-lo por um `<Unavailable>` mataria a
          atualização ao vivo da página inteira até alguém recarregar à mão.
          Comportamento herdado de `/início`, de onde foi transplantado na
          Task 6 — ver `LiveActivity.tsx`. */}
      {unavailable && (
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-[1.55fr_1fr]">
          <Unavailable title="Não foi possível carregar o que precisa de atenção hoje" />
          <LiveActivity items={activityItems ?? []} error={activityItems === null} />
        </div>
      )}

      {!unavailable && itens.length === 0 && (
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-[1.55fr_1fr]">
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <div className="text-[13px] font-medium">Nada pendente — tudo em dia.</div>
          </div>
          <LiveActivity items={activityItems ?? []} error={activityItems === null} />
        </div>
      )}

      {!unavailable && itens.length > 0 && (
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-[1.55fr_1fr]">
          <div className="overflow-y-auto scrollbar-thin rounded-xl border border-border bg-surface">
            {itens.map((item) => {
              const dono = item.donoId ? profilePorId.get(item.donoId) : undefined;
              const vencimento = rotuloVencimento(item.vencimento, agora);
              const href =
                item.origem === "negocio"
                  ? `/pipeline?negocio=${item.id}`
                  : item.origem === "implantacao"
                    ? "/implantacao"
                    : `/kanban?task=${item.id}`;

              return (
                <Link
                  key={`${item.origem}-${item.id}`}
                  href={href}
                  className="flex items-center gap-3 border-b border-border-soft px-3.5 py-2.75 text-[13px] last:border-b-0 hover:bg-neutral-tint"
                >
                  <span
                    title={ROTULO_DA_SAUDE[item.saude]}
                    className={clsx("h-2 w-2 flex-none rounded-full", CLASSE_DO_PONTO_DE_SAUDE[item.saude])}
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
          <LiveActivity items={activityItems ?? []} error={activityItems === null} />
        </div>
      )}
    </>
  );
}

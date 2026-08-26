"use client";

import { useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import { PageHeader } from "@/components/layout/PageBody";
import { Avatar } from "@/components/ui/Avatar";
import { Unavailable } from "@/components/ui/Unavailable";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LiveActivity, type LiveActivityItem } from "@/components/hoje/LiveActivity";
import {
  CLASSE_DO_PONTO_DE_SAUDE,
  ROTULO_DA_SAUDE,
  rotuloVencimento,
  type SaudeNegocio,
} from "@/lib/negocios";
import {
  implantacaoParaItemHoje,
  negocioParaItemHoje,
  ordenarPorUrgencia,
  tarefaParaItemHoje,
  type ItemHoje,
} from "@/lib/hoje";
import type { ImplantacaoHoje, NegocioHoje, TarefaHoje } from "@/lib/data/hoje";
import type { Tables } from "@/lib/supabase/database.types";
import { EmptyState } from "@/components/ui/EmptyState";

// Mesma linguagem visual do ponto de saúde do Pipeline (`NegocioCard.tsx`):
// cor e rótulo vêm de `src/lib/negocios.ts`, para as duas telas nunca
// discordarem sobre o mesmo negócio.

/**
 * O destino do clique depende da origem — negócio abre o Pipeline, tarefa abre
 * o Kanban, implantação abre a Implantação —, e antes nada na linha dizia para
 * onde se estava indo. Três palavras curtas em vez de três ícones: são termos
 * que estas duas pessoas usam falando, e um ícone precisaria ser aprendido.
 */
const ROTULO_DA_ORIGEM: Record<ItemHoje["origem"], string> = {
  negocio: "negócio",
  tarefa: "tarefa",
  implantacao: "implant.",
};

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

  // `ordenarPorUrgencia` já ordena por saúde antes de qualquer outra coisa —
  // este agrupamento não reordena nada, só torna visível o corte que a lista
  // sempre teve. Sem ele, trinta linhas iguais não dizem quantas estão de
  // fato atrasadas; com ele, a resposta é o tamanho do primeiro grupo.
  // Os rótulos vêm de `ROTULO_DA_SAUDE`, o mesmo léxico do Pipeline — inventar
  // "Atrasadas/Em breve" aqui seria um segundo vocabulário para o mesmo dado.
  const grupos = useMemo(() => {
    const ordem: SaudeNegocio[] = ["podre", "atencao", "ok"];
    return ordem
      .map((saude) => ({ saude, itens: itens.filter((i) => i.saude === saude) }))
      .filter((g) => g.itens.length > 0);
  }, [itens]);

  // Estava escrita três vezes, byte a byte igual, nas três variantes abaixo.
  const grid = "grid flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-[1.55fr_1fr]";

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
          <SegmentedControl
            rotuloAcessivel="Filtrar por dono"
            valor={donoAtual}
            opcoes={donoOptions.map((o) => ({ valor: o.key, rotulo: o.label, href: o.href }))}
          />
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
        <div className={grid}>
          <Unavailable title="Não foi possível carregar o que precisa de atenção hoje" />
          <LiveActivity items={activityItems ?? []} error={activityItems === null} />
        </div>
      )}

      {!unavailable && itens.length === 0 && (
        <div className={grid}>
          <EmptyState title="Nada pendente — tudo em dia." />
          <LiveActivity items={activityItems ?? []} error={activityItems === null} />
        </div>
      )}

      {!unavailable && itens.length > 0 && (
        <div className={grid}>
          <div className="overflow-y-auto scrollbar-thin rounded-card border border-border bg-surface">
            {grupos.map((grupo) => (
              <div key={grupo.saude}>
                {/* Cabeçalho grudado, com sombra interna no lugar de `border-b`
                    pelo mesmo motivo do cabeçalho da tabela do Painel: borda de
                    elemento `sticky` desce junto com a rolagem. O número ao lado
                    do rótulo é a informação que a tela devia dar de graça — 
                    quantas estão atrasadas. */}
                <div className="sticky top-0 z-10 flex items-center gap-2 bg-bone px-3.5 py-2 shadow-[inset_0_-1px_0_var(--color-border)]">
                  <span
                    aria-hidden
                    className={clsx("h-2 w-2 flex-none rounded-full", CLASSE_DO_PONTO_DE_SAUDE[grupo.saude])}
                  />
                  <span className="label">{ROTULO_DA_SAUDE[grupo.saude]}</span>
                  <span className="ml-auto font-mono text-label text-faint">{grupo.itens.length}</span>
                </div>

                {grupo.itens.map((item) => {
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
                      className="flex items-center gap-3 border-b border-border-soft px-3.5 py-3 text-body transition-colors duration-fast last:border-b-0 hover:bg-neutral-tint"
                    >
                      {/* O ponto some da linha: ele agora é o cabeçalho do
                          grupo, e repetido em toda linha dizia o que o grupo
                          inteiro já diz. No lugar dele entra a origem, que era
                          a informação que faltava — o destino do clique muda
                          conforme ela, e nada na linha o antecipava. */}
                      <span
                        aria-hidden
                        className="w-[68px] flex-none font-mono text-label text-faint"
                      >
                        {ROTULO_DA_ORIGEM[item.origem]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{item.texto}</div>
                        {item.contexto && <div className="truncate text-small text-muted">{item.contexto}</div>}
                      </div>
                      {vencimento && (
                        <span
                          className={clsx(
                            "flex-none font-mono text-label tabular-nums",
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
            ))}
          </div>
          <LiveActivity items={activityItems ?? []} error={activityItems === null} />
        </div>
      )}
    </>
  );
}

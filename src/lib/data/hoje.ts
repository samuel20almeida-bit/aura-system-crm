import { createClient } from "@/lib/supabase/server";
import { listEtapas, listImplantacoesAbertas } from "@/lib/data/implantacoes";

/**
 * A leitura de `/hoje`: negócio em aberto (qualquer estágio, não só os do
 * Pipeline) + tarefa não concluída + implantação aberta, em consultas
 * paralelas.
 *
 * Sem filtro de dono, todas trazem tudo — o filtro por dono na URL
 * (Step 3, `/app/(app)/hoje/page.tsx`) empurra `donoId` pra cá. Negócio e
 * tarefa filtram no próprio `.eq()` da consulta, porque o banco já sabe
 * filtrar. Implantação filtra em JavaScript, DEPOIS do cruzamento com
 * etapas (abaixo) — a esteira é dado pequeno (Task 4 da 3B), e sem esse
 * filtro escolher "Samuel" no seletor de `/hoje` continuaria mostrando
 * implantações do Saymon, que é exatamente a inconsistência que este filtro
 * existe para evitar nas outras duas fontes.
 */
export async function getItensHoje(donoId?: string) {
  const supabase = await createClient();

  let negociosQuery = supabase
    .from("negocios")
    .select("id, proximo_passo, proximo_passo_em, mexido_em, dono_id, conta:contas(id, nome)")
    // O funil ABERTO inteiro, de qualquer estágio — ao contrário do Pipeline,
    // que também corta por `resultado is null` mas existe para desenhar um
    // quadro por estágio; aqui não há corte a mais, só o mesmo "ainda em jogo".
    .is("resultado", null);
  if (donoId) negociosQuery = negociosQuery.eq("dono_id", donoId);

  let tasksQuery = supabase
    .from("tasks")
    .select("id, title, due_date, assignee_id, client:clients(id, name)")
    // `tasks.status` é `text` com `check`, não enum — "não concluída" é
    // "diferente de 'done'".
    .neq("status", "done");
  if (donoId) tasksQuery = tasksQuery.eq("assignee_id", donoId);

  const [negociosRes, tasksRes, etapasRes, implantacoesRes] = await Promise.all([
    negociosQuery,
    tasksQuery,
    listEtapas(),
    listImplantacoesAbertas(),
  ]);

  // Mesma sentinela do sino e do Pipeline (src/lib/data/notifications.ts,
  // src/lib/data/deals.ts): se qualquer uma das QUATRO fontes falhou, a
  // leitura INTEIRA é `unavailable`. Uma tela que existe para dizer "isto é
  // tudo que precisa de atenção hoje" mentindo por omissão — porque só parte
  // das fontes respondeu — é pior do que ela avisando que não conseguiu
  // carregar.
  if (negociosRes.error || tasksRes.error || etapasRes.unavailable || implantacoesRes.unavailable) {
    console.error(
      "[hoje] falha ao consultar o Supabase:",
      negociosRes.error,
      tasksRes.error,
      etapasRes.unavailable,
      implantacoesRes.unavailable
    );
    return { unavailable: true as const };
  }

  // `implantacoes.etapa` guarda só a posição (int) — sla_dias/espera vivem em
  // `implantacao_etapas`. 6 linhas, cruzamento em memória sem custo, mesmo
  // raciocínio do comentário em `src/lib/data/implantacoes.ts`.
  const etapaPorPosicao = new Map(etapasRes.etapas.map((e) => [e.posicao, e]));
  const implantacoes = implantacoesRes.implantacoes.flatMap((imp) => {
    if (donoId && imp.dono?.id !== donoId) return [];
    const etapa = etapaPorPosicao.get(imp.etapa);
    // Etapa referenciada não encontrada não deveria acontecer (FK garante a
    // integridade), mas se acontecer, a implantação não pode virar item sem
    // `slaDias`/`espera` — melhor sumir da lista do que quebrar a página.
    if (!etapa) return [];
    return [{ ...imp, etapaNome: etapa.nome, slaDias: etapa.sla_dias, espera: etapa.espera }];
  });

  return {
    unavailable: false as const,
    negocios: negociosRes.data ?? [],
    tarefas: tasksRes.data ?? [],
    implantacoes,
  };
}

type LeituraDeHoje = Awaited<ReturnType<typeof getItensHoje>>;
export type NegocioHoje = Extract<LeituraDeHoje, { unavailable: false }>["negocios"][number];
export type TarefaHoje = Extract<LeituraDeHoje, { unavailable: false }>["tarefas"][number];
export type ImplantacaoHoje = Extract<LeituraDeHoje, { unavailable: false }>["implantacoes"][number];

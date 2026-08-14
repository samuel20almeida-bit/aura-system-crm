import { createClient } from "@/lib/supabase/server";

/**
 * A leitura de `/hoje`: negócio em aberto (qualquer estágio, não só os do
 * Pipeline) + tarefa não concluída, em duas consultas paralelas.
 *
 * Sem filtro de dono, as duas trazem tudo — o filtro por dono na URL
 * (Step 3, `/app/(app)/hoje/page.tsx`) empurra `donoId` pra cá, para a
 * página não ter que filtrar em JavaScript uma lista que o banco já sabe
 * filtrar.
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

  const [negociosRes, tasksRes] = await Promise.all([negociosQuery, tasksQuery]);

  // Mesma sentinela do sino e do Pipeline (src/lib/data/notifications.ts,
  // src/lib/data/deals.ts): se qualquer uma das duas fontes falhou, a leitura
  // INTEIRA é `unavailable`. Uma tela que existe para dizer "isto é tudo que
  // precisa de atenção hoje" mentindo por omissão — porque só metade das
  // fontes respondeu — é pior do que ela avisando que não conseguiu carregar.
  if (negociosRes.error || tasksRes.error) {
    console.error("[hoje] falha ao consultar o Supabase:", negociosRes.error, tasksRes.error);
    return { unavailable: true as const };
  }

  return {
    unavailable: false as const,
    negocios: negociosRes.data ?? [],
    tarefas: tasksRes.data ?? [],
  };
}

type LeituraDeHoje = Awaited<ReturnType<typeof getItensHoje>>;
export type NegocioHoje = Extract<LeituraDeHoje, { unavailable: false }>["negocios"][number];
export type TarefaHoje = Extract<LeituraDeHoje, { unavailable: false }>["tarefas"][number];

import { createClient } from "@/lib/supabase/server";
import { addDaysToDateStr, todayInAppTz } from "@/lib/timezone";
import type { Assinatura, FaturaLida, LinhaDeUso } from "@/lib/clubcut";

/**
 * A leitura da operação do ClubCut. Cinco consultas, e nenhuma delas sai
 * deste banco: o que chegou do cliente já foi copiado para cá pelo
 * sincronizador (ver `0022_clubcut.sql` e `0023_clubcut_cobranca.sql`).
 *
 * Todas seguem a sentinela `unavailable` que o resto do projeto usa: uma
 * consulta que falhou não pode virar lista vazia. Nesta tela isso seria
 * especialmente caro — "nenhum uso" e "não consegui ler o uso" levam a
 * decisões opostas sobre um cliente.
 */

export const JANELA_PADRAO_DIAS = 30;

export type SalaoEspelhado = {
  salon_id: string;
  nome: string;
  ativo: boolean;
  sincronizado_em: string;
};

export type ContaVinculada = {
  id: string;
  nome: string;
  fase: string;
  clubcut_salon_id: string | null;
};

export async function listSaloes() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clubcut_saloes")
    .select("salon_id, nome, ativo, sincronizado_em")
    .order("nome");

  if (error) {
    console.error("[clubcut] falha ao consultar salões:", error);
    return { unavailable: true as const };
  }

  return { unavailable: false as const, saloes: (data ?? []) as SalaoEspelhado[] };
}

/**
 * Todas as contas, com o vínculo. Todas, e não só as vinculadas: a tela
 * precisa oferecer as que ainda não têm ClubCut ligado, que é justamente o
 * trabalho que ela existe para permitir.
 */
export async function listContasComVinculo() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contas")
    .select("id, nome, fase, clubcut_salon_id")
    .order("nome");

  if (error) {
    console.error("[clubcut] falha ao consultar contas:", error);
    return { unavailable: true as const };
  }

  return { unavailable: false as const, contas: (data ?? []) as ContaVinculada[] };
}

/**
 * A janela de uso. `dias` conta para trás a partir de HOJE em São Paulo, não
 * de `now()` no banco: a Vercel roda em UTC, e depois das 21h de lá a data do
 * servidor já é a de amanhã aqui — a janela pularia um dia.
 */
export async function listUsoDaJanela(dias: number = JANELA_PADRAO_DIAS) {
  const supabase = await createClient();
  const desde = addDaysToDateStr(todayInAppTz(), -dias + 1);

  const { data, error } = await supabase
    .from("clubcut_uso_diario")
    .select(
      "salon_id, dia, barbeiros, conversas, mensagens, agendamentos_agente, agendamentos_total, valor_gerado, custo_ia_usd, execucoes_erro"
    )
    .gte("dia", desde)
    .order("dia", { ascending: false });

  if (error) {
    console.error("[clubcut] falha ao consultar uso:", error);
    return { unavailable: true as const };
  }

  return { unavailable: false as const, desde, linhas: (data ?? []) as LinhaDeUso[] };
}

export async function listAssinaturas() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clubcut_assinaturas")
    .select("salon_id, plano, status, valor, proximo_vencimento, acesso_ate");

  if (error) {
    console.error("[clubcut] falha ao consultar assinaturas:", error);
    return { unavailable: true as const };
  }

  return { unavailable: false as const, assinaturas: (data ?? []) as Assinatura[] };
}

/**
 * TODAS as faturas, não só as da janela.
 *
 * Dívida não expira com o recorte da tela: uma fatura de junho sem baixa
 * continua sendo dinheiro a receber em setembro, e filtrar por período a
 * esconderia justamente de quem precisa vê-la. O teto de 500 é folga larga —
 * são fechamentos mensais de um punhado de clientes.
 */
export async function listFaturas() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clubcut_faturas")
    .select(
      "salon_id, periodo_inicio, periodo_fim, motivo, valor, valor_gerado, agendamentos, vencimento, paga_em"
    )
    .order("periodo_fim", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[clubcut] falha ao consultar faturas:", error);
    return { unavailable: true as const };
  }

  return { unavailable: false as const, faturas: (data ?? []) as FaturaLida[] };
}

"use server";

import { createClient } from "@/lib/supabase/server";

export type NotaDaConta = {
  id: string;
  texto: string;
  criado_em: string;
  autor: { id: string; full_name: string; initials: string } | null;
};

/**
 * As notas de UMA conta, sob demanda.
 *
 * Não vêm junto da leitura do Pipeline de propósito. O quadro carrega 230
 * negócios; trazer o diário de todos eles para desenhar cinco colunas que não
 * mostram nota nenhuma seria pagar por 230 leituras para usar uma. A gaveta
 * pede a sua quando a aba abre — e é a única tela que exibe isto.
 *
 * Leitura por Server Action (POST), e não por Route Handler: o custo é uma
 * requisição não-cacheável por abertura de aba, e o ganho é herdar a sessão e
 * a RLS sem inventar uma superfície nova de API. No volume desta tela — um
 * clique humano por vez — a troca compensa.
 */
export async function listarNotasDaConta(contaId: string): Promise<NotaDaConta[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conta_notas")
    .select("id, texto, criado_em, autor:profiles(id, full_name, initials)")
    .eq("conta_id", contaId)
    .order("criado_em", { ascending: false });

  // Aqui o erro SOBE, ao contrário da sentinela `unavailable` das leituras de
  // página. A diferença é o que a tela faz com a resposta: uma página troca o
  // conteúdo por um aviso e segue de pé; esta chamada tem um único consumidor,
  // que precisa distinguir "esta conta ainda não tem nota" de "não consegui
  // ler" — e uma lista vazia diria a primeira coisa nos dois casos.
  if (error) throw error;

  return (data ?? []) as NotaDaConta[];
}

/**
 * SEM `revalidatePath` — nem aqui nem em `removerNota`, e é decisão, não
 * esquecimento.
 *
 * Nota não aparece em lugar nenhum fora da gaveta: nem no cartão, nem no
 * cabeçalho, nem em contador. Revalidar `/pipeline` releria os 230 negócios
 * com suas contas e donos para redesenhar exatamente os mesmos pixels — o
 * custo inteiro da rota por anotação escrita. Quem precisa do dado novo é a
 * própria aba, e ela relê a si mesma.
 *
 * O dia em que um cartão passar a mostrar "3 anotações", esta decisão vira
 * dívida e o `revalidatePath` volta.
 */
export async function adicionarNota(contaId: string, texto: string) {
  const supabase = await createClient();

  const limpo = texto.trim();
  // Mesma regra do `check` da migration. Vale aqui também para o erro chegar
  // em português, e não como violação de restrição do Postgres.
  if (limpo === "") throw new Error("A nota não pode ficar vazia.");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("conta_notas").insert({
    conta_id: contaId,
    // `profiles.id` é o próprio `auth.users.id` (ver 0002_auth.sql), então não
    // há consulta a fazer para descobrir o autor.
    autor_id: user?.id ?? null,
    texto: limpo,
  });
  if (error) throw error;
}

export async function removerNota(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("conta_notas").delete().eq("id", id);
  if (error) throw error;
}

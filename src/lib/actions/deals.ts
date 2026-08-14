"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { todayInAppTz } from "@/lib/timezone";
import type { Database } from "@/lib/supabase/database.types";

type Estagio = Database["public"]["Enums"]["negocio_estagio"];

/**
 * As escritas do Pipeline. Todas conferem `error` e lançam — quem chama está do
 * lado do cliente, embrulha em `beginMutation` e mostra o aviso.
 *
 * `mexido_em` aparece em quase todas de propósito: é o relógio do apodrecimento
 * (`saudeDoNegocio`, src/lib/negocios.ts). Interagir com o negócio e não zerar
 * esse relógio faria a tela chamar de "parado" algo em que alguém acabou de
 * mexer — e o alerta que mente uma vez perde o valor para sempre.
 */

export async function criarContaComNegocio(input: {
  nome: string;
  nicho: string | null;
  cidade: string | null;
  uf: string | null;
  decisorNome: string | null;
  softwareAtual: string | null;
  origem: string | null;
  setup: number | null;
  mrr: number | null;
  proximoPasso: string | null;
  proximoPassoEm: string | null;
  donoId: string | null;
}) {
  const supabase = await createClient();

  const { data: conta, error: contaError } = await supabase
    .from("contas")
    .insert({
      nome: input.nome,
      nicho: input.nicho,
      cidade: input.cidade,
      uf: input.uf,
      decisor_nome: input.decisorNome,
      software_atual: input.softwareAtual,
      origem: input.origem,
      fase: "prospect",
      dono_id: input.donoId,
    })
    .select("id")
    .single();
  if (contaError) throw contaError;

  // Duas escritas, sem transação: o projeto não usa transação explícita em
  // lugar nenhum, e o pior caso aqui é uma conta sem negócio — invisível, não
  // destrutiva. Rollback manual custaria mais complexidade do que o defeito
  // que evita numa ferramenta de duas pessoas.
  const { error: negocioError } = await supabase.from("negocios").insert({
    conta_id: conta.id,
    estagio: "lead",
    dono_id: input.donoId,
    setup: input.setup,
    mrr: input.mrr,
    proximo_passo: input.proximoPasso,
    proximo_passo_em: input.proximoPassoEm,
    // Também é o default da coluna; explícito aqui para o relógio do
    // apodrecimento começar a contar no mesmo lugar onde ele é reiniciado.
    mexido_em: new Date().toISOString(),
  });
  if (negocioError) throw negocioError;

  revalidatePath("/pipeline");
}

export async function moverNegocioParaEstagio(negocioId: string, estagio: Estagio) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("negocios")
    .update({ estagio, mexido_em: new Date().toISOString() })
    .eq("id", negocioId);
  if (error) throw error;

  revalidatePath("/pipeline");
}

export async function atualizarNegocio(input: {
  negocioId: string;
  proximoPasso: string | null;
  proximoPassoEm: string | null;
  setup: number | null;
  mrr: number | null;
}) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("negocios")
    .update({
      proximo_passo: input.proximoPasso,
      proximo_passo_em: input.proximoPassoEm,
      setup: input.setup,
      mrr: input.mrr,
      mexido_em: new Date().toISOString(),
    })
    .eq("id", input.negocioId);
  if (error) throw error;

  revalidatePath("/pipeline");
}

/**
 * Ganhar é passagem de bastão, não uma sexta coluna: o negócio sai do funil e a
 * conta entra em implantação.
 *
 * NÃO nasce linha de implantação aqui — a tabela `implantacoes` é da Fase 3B e
 * ainda não existe. Até ela existir, o negócio ganho fica sem tela, o que é
 * esperado e está registrado no ledger da fase.
 */
export async function ganharNegocio(negocioId: string) {
  const supabase = await createClient();
  const hoje = todayInAppTz();

  // A conta vem da linha atualizada, não do cliente: Server Action é endpoint
  // HTTP, e um par (negócio, conta) dessincronizado mudaria a fase da conta
  // errada. É a mesma disciplina de `removeAttachment` com o caminho do anexo.
  const { data: negocio, error } = await supabase
    .from("negocios")
    .update({ resultado: "ganho", fechado_em: hoje, mexido_em: new Date().toISOString() })
    .eq("id", negocioId)
    .select("conta_id")
    .single();
  if (error) throw error;

  const { error: contaError } = await supabase
    .from("contas")
    .update({ fase: "implantacao" })
    .eq("id", negocio.conta_id);
  if (contaError) throw contaError;

  revalidatePath("/pipeline");
}

export async function perderNegocio(negocioId: string, motivo: string) {
  const motivoLimpo = motivo.trim();
  // O motivo é obrigatório no servidor, não só na tela: perda sem motivo é
  // exatamente o dado que ninguém volta para preencher depois.
  if (!motivoLimpo) throw new Error("O motivo da perda é obrigatório.");

  const supabase = await createClient();
  const hoje = todayInAppTz();

  const { data: negocio, error } = await supabase
    .from("negocios")
    .update({
      resultado: "perdido",
      motivo_perda: motivoLimpo,
      fechado_em: hoje,
      mexido_em: new Date().toISOString(),
    })
    .eq("id", negocioId)
    .select("conta_id")
    .single();
  if (error) throw error;

  const { error: contaError } = await supabase
    .from("contas")
    .update({ fase: "perdido" })
    .eq("id", negocio.conta_id);
  if (contaError) throw contaError;

  revalidatePath("/pipeline");
}

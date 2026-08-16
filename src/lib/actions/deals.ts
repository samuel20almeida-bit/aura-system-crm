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
  // Servidor confere o que a tela já valida: Server Action é endpoint HTTP,
  // não confia só no `required` do formulário. Mesma disciplina do motivo de
  // perda em `perderNegocio`.
  const nomeLimpo = input.nome.trim();
  if (!nomeLimpo) throw new Error("O nome da conta é obrigatório.");
  if ((input.setup ?? 0) < 0) throw new Error("O setup não pode ser negativo.");
  if ((input.mrr ?? 0) < 0) throw new Error("A mensalidade não pode ser negativa.");

  const supabase = await createClient();

  const { data: conta, error: contaError } = await supabase
    .from("contas")
    .insert({
      nome: nomeLimpo,
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
  // `/hoje` também lê `negocios` (Task 5) — sem isto, voltar do Pipeline para
  // lá pelo botão Voltar do navegador podia reaparecer com o ponto de saúde
  // antigo: o Router Cache do Next não sabe que este negócio mudou.
  revalidatePath("/hoje");
}

export async function moverNegocioParaEstagio(negocioId: string, estagio: Estagio) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("negocios")
    .update({ estagio, mexido_em: new Date().toISOString() })
    .eq("id", negocioId);
  if (error) throw error;

  revalidatePath("/pipeline");
  // `/hoje` também lê `negocios` (Task 5) — sem isto, voltar do Pipeline para
  // lá pelo botão Voltar do navegador podia reaparecer com o ponto de saúde
  // antigo: o Router Cache do Next não sabe que este negócio mudou.
  revalidatePath("/hoje");
}

export async function atualizarNegocio(input: {
  negocioId: string;
  proximoPasso: string | null;
  proximoPassoEm: string | null;
  setup: number | null;
  mrr: number | null;
}) {
  // Os inputs da gaveta têm `min="0"`, mas os botões não estão dentro de um
  // `<form>` — a restrição nativa do navegador nunca dispara. Confere aqui.
  if ((input.setup ?? 0) < 0) throw new Error("O setup não pode ser negativo.");
  if ((input.mrr ?? 0) < 0) throw new Error("A mensalidade não pode ser negativa.");

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
  // `/hoje` também lê `negocios` (Task 5) — sem isto, voltar do Pipeline para
  // lá pelo botão Voltar do navegador podia reaparecer com o ponto de saúde
  // antigo: o Router Cache do Next não sabe que este negócio mudou.
  revalidatePath("/hoje");
}

/**
 * Ganhar é passagem de bastão, não uma sexta coluna: o negócio sai do funil e a
 * conta entra em implantação.
 *
 * NÃO nasce linha de implantação aqui — a tabela `implantacoes` é da Fase 3B e
 * ainda não existe. Até ela existir, o negócio ganho fica sem tela, o que é
 * esperado e está registrado no ledger da fase.
 *
 * A ORDEM DAS DUAS ESCRITAS IMPORTA. A conta é atualizada PRIMEIRO, e o
 * negócio (que tira ele do quadro, via `resultado is null` na leitura) por
 * último. Se a segunda falhar, o negócio continua visível e o botão continua
 * clicável — o usuário só tenta de novo, e atualizar `contas.fase` outra vez é
 * inofensivo. Na ordem inversa, uma falha na segunda escrita deixaria o
 * negócio marcado como ganho e já invisível no quadro, mas a conta parada em
 * "prospect" — inconsistente e sem nenhuma tela para consertar, porque a 3B
 * não existe ainda.
 */
export async function ganharNegocio(negocioId: string) {
  const supabase = await createClient();
  const hoje = todayInAppTz();

  // Leitura, sem mutação: só para saber qual conta atualizar. Se falhar,
  // nada aconteceu ainda.
  const { data: negocio, error: leituraError } = await supabase
    .from("negocios")
    .select("conta_id")
    .eq("id", negocioId)
    .single();
  if (leituraError) throw leituraError;

  const { error: contaError } = await supabase
    .from("contas")
    .update({ fase: "implantacao" })
    .eq("id", negocio.conta_id);
  if (contaError) throw contaError;

  const { error } = await supabase
    .from("negocios")
    .update({ resultado: "ganho", fechado_em: hoje, mexido_em: new Date().toISOString() })
    .eq("id", negocioId);
  if (error) throw error;

  revalidatePath("/pipeline");
  // `/hoje` também lê `negocios` (Task 5) — sem isto, voltar do Pipeline para
  // lá pelo botão Voltar do navegador podia reaparecer com o ponto de saúde
  // antigo: o Router Cache do Next não sabe que este negócio mudou.
  revalidatePath("/hoje");
}

export async function perderNegocio(negocioId: string, motivo: string) {
  const motivoLimpo = motivo.trim();
  // O motivo é obrigatório no servidor, não só na tela: perda sem motivo é
  // exatamente o dado que ninguém volta para preencher depois.
  if (!motivoLimpo) throw new Error("O motivo da perda é obrigatório.");

  const supabase = await createClient();
  const hoje = todayInAppTz();

  // Mesma ordem e mesmo motivo de `ganharNegocio`: a conta primeiro, o
  // negócio (que sai do quadro) por último.
  const { data: negocio, error: leituraError } = await supabase
    .from("negocios")
    .select("conta_id")
    .eq("id", negocioId)
    .single();
  if (leituraError) throw leituraError;

  const { error: contaError } = await supabase
    .from("contas")
    .update({ fase: "perdido" })
    .eq("id", negocio.conta_id);
  if (contaError) throw contaError;

  const { error } = await supabase
    .from("negocios")
    .update({
      resultado: "perdido",
      motivo_perda: motivoLimpo,
      fechado_em: hoje,
      mexido_em: new Date().toISOString(),
    })
    .eq("id", negocioId);
  if (error) throw error;

  revalidatePath("/pipeline");
  // `/hoje` também lê `negocios` (Task 5) — sem isto, voltar do Pipeline para
  // lá pelo botão Voltar do navegador podia reaparecer com o ponto de saúde
  // antigo: o Router Cache do Next não sabe que este negócio mudou.
  revalidatePath("/hoje");
}

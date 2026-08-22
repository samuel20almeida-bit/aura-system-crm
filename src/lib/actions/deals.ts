"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { todayInAppTz } from "@/lib/timezone";
import { normalizeLinkUrl } from "@/lib/links";
import { derivePrefixoDaConta } from "@/lib/task-codes";
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
  email: string | null;
  telefone: string | null;
  site: string | null;
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

  // Mesma normalização do link de anexo (src/lib/links.ts): sem esquema vira
  // https://, e javascript:/data: são recusados antes de o valor virar um
  // href clicável na gaveta.
  const siteNormalizado = input.site?.trim() ? normalizeLinkUrl(input.site) : null;
  if (siteNormalizado && !siteNormalizado.ok) throw new Error(siteNormalizado.message);

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
      email: input.email,
      telefone: input.telefone,
      site: siteNormalizado ? siteNormalizado.url : null,
      fase: "prospect",
      dono_id: input.donoId,
      code_prefix: derivePrefixoDaConta(nomeLimpo),
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

/**
 * Com autosave (Fase 4B), esta função pode rodar concorrentemente com
 * `ganharNegocio`/`perderNegocio` sobre o MESMO negócio (o usuário edita um
 * campo enquanto clica em Ganhar/Perder). Isso é seguro hoje porque os
 * conjuntos de colunas escritas são disjuntos — `atualizarNegocio` só toca
 * `proximo_passo`/`proximo_passo_em`/`setup`/`mrr`/`mexido_em`;
 * `ganharNegocio`/`perderNegocio` só tocam `resultado`/`fechado_em`/
 * `mexido_em` (+ `contas.fase`/`implantacoes`). Se um dia esta função passar
 * a escrever `resultado` ou `fase`, essa garantia quebra — revisar a
 * concorrência com autosave nesse momento.
 */
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
 * Edita a conta em si (nome, dados de contato, decisor…) — até aqui "A CONTA"
 * na gaveta do Pipeline era só leitura, e não existia onde guardar e-mail,
 * telefone ou site do cliente. Ação separada de `atualizarNegocio` porque são
 * duas entidades diferentes (conta × negócio) — cada uma com seu próprio
 * autosave na gaveta (Fase 4B).
 */
export async function atualizarConta(input: {
  contaId: string;
  nome: string;
  nicho: string | null;
  cidade: string | null;
  uf: string | null;
  decisorNome: string | null;
  softwareAtual: string | null;
  origem: string | null;
  email: string | null;
  telefone: string | null;
  site: string | null;
}) {
  const nomeLimpo = input.nome.trim();
  if (!nomeLimpo) throw new Error("O nome da conta é obrigatório.");

  // Mesma normalização do link de anexo (src/lib/links.ts): sem esquema vira
  // https://, e javascript:/data: são recusados antes de o valor virar um
  // href clicável na gaveta.
  const siteNormalizado = input.site?.trim() ? normalizeLinkUrl(input.site) : null;
  if (siteNormalizado && !siteNormalizado.ok) throw new Error(siteNormalizado.message);

  const supabase = await createClient();

  const { error } = await supabase
    .from("contas")
    .update({
      nome: nomeLimpo,
      nicho: input.nicho,
      cidade: input.cidade,
      uf: input.uf,
      decisor_nome: input.decisorNome,
      software_atual: input.softwareAtual,
      origem: input.origem,
      email: input.email,
      telefone: input.telefone,
      site: siteNormalizado ? siteNormalizado.url : null,
    })
    .eq("id", input.contaId);
  if (error) throw error;

  revalidatePath("/pipeline");
  // `/hoje` também lê `negocios(conta:...)` (Task 5) — sem isto, voltar do
  // Pipeline para lá pelo botão Voltar do navegador podia reaparecer com o
  // dado antigo da conta: o Router Cache do Next não sabe que ela mudou.
  revalidatePath("/hoje");
}

/**
 * Ganhar é passagem de bastão, não uma sexta coluna: o negócio sai do funil, a
 * conta entra em implantação e uma implantação nasce sozinha para conduzir o
 * pós-venda (Fase 3B).
 *
 * A ORDEM DAS TRÊS ESCRITAS IMPORTA. Primeiro a implantação, depois a conta,
 * e o negócio (que tira ele do quadro, via `resultado is null` na leitura)
 * por último. Nenhuma delas tira o negócio de vista antes da última — se
 * qualquer uma falhar no meio, o negócio continua visível e o botão continua
 * clicável, e repetir "Ganhar" é seguro: `implantacoes.negocio_id` é `unique`,
 * então uma segunda tentativa que ache a implantação já criada esbarra na
 * constraint (23505) em vez de duplicar, e o código trata esse código
 * especificamente como "já existe, segue em frente". Atualizar `contas.fase`
 * de novo também é inofensivo. Na ordem inversa, uma falha na última escrita
 * deixaria o negócio marcado como ganho e já invisível no quadro, mas a conta
 * e a implantação incompletas — inconsistente e sem retry possível pela
 * tela.
 */
export async function ganharNegocio(negocioId: string) {
  const supabase = await createClient();
  const hoje = todayInAppTz();

  // Leitura, sem mutação: só para saber qual conta atualizar e quem herda a
  // implantação. Se falhar, nada aconteceu ainda.
  const { data: negocio, error: leituraError } = await supabase
    .from("negocios")
    .select("conta_id, dono_id, resultado")
    .eq("id", negocioId)
    .single();
  if (leituraError) throw leituraError;

  // Achado na revisão final da 3B: repetir "Ganhar" sobre um negócio que já
  // tem resultado (ganho por uma aba desatualizada, ou já perdido) não pode
  // reescrever nada — `negocios` não é publicada em tempo real, então uma
  // aba aberta de véspera continua mostrando o botão clicável. Sem esta
  // guarda, "Ganhar" de novo rebaixava `contas.fase` de volta para
  // 'implantacao' mesmo numa conta que já tinha virado 'cliente', e
  // reescrevia `fechado_em` com a data de hoje — corrompendo a única data
  // que a 3C vai usar para a série histórica do Painel.
  if (negocio.resultado) {
    // A escrita é no-op, mas a TELA não é: quem clicou está vendo um negócio
    // que já saiu do funil. Sem revalidar, o cartão fica lá até um F5 — era o
    // `router.refresh()` removido na Task 2 da 5F que cobria este caminho.
    revalidatePath("/pipeline");
    revalidatePath("/hoje");
    return;
  }

  // Nasce a implantação ANTES de marcar o negócio como ganho — se isto
  // falhar, o negócio continua visível e o botão continua clicável.
  // `dono_id` herda do negócio (quem vendeu); a gaveta da implantação deixa
  // trocar depois.
  const { error: implantacaoError } = await supabase.from("implantacoes").insert({
    conta_id: negocio.conta_id,
    negocio_id: negocioId,
    dono_id: negocio.dono_id,
  });
  // 23505 = unique_violation. Repetir "Ganhar" depois de a implantação já ter
  // nascido (e a escrita seguinte ter falhado da vez anterior) não pode virar
  // um erro assustador — a implantação já existe, é exatamente o que se
  // queria.
  if (implantacaoError && implantacaoError.code !== "23505") throw implantacaoError;

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
  // A tela de Implantação (Task 4 desta fase) ainda não existe fisicamente,
  // mas `revalidatePath` de uma rota inexistente é inofensivo no Next.js —
  // chamar antecipadamente evita esquecer isto quando a rota nascer.
  revalidatePath("/implantacao");
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

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * As escritas da esteira de implantação. Mesma disciplina do Pipeline
 * (`src/lib/actions/deals.ts`): confere `error` e lança — quem chama está do
 * lado do cliente, embrulha em `beginMutation` e mostra o aviso.
 */

export async function moverEtapa(implantacaoId: string, etapa: number) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("implantacoes")
    // `etapa_desde` reinicia: é o relógio do SLA (`vencimentoDaEtapa`,
    // src/lib/implantacoes.ts) — trocar de etapa e não zerá-lo faria a tela
    // continuar contando o prazo da etapa anterior.
    .update({ etapa, etapa_desde: new Date().toISOString() })
    .eq("id", implantacaoId);
  if (error) throw error;

  revalidatePath("/implantacao");
  // `/hoje` também lê implantações abertas (Task 5) — sem isto, voltar para
  // lá pelo botão Voltar do navegador podia reaparecer com a etapa antiga.
  revalidatePath("/hoje");
}

/**
 * Conclui a implantação: a conta vira cliente e a implantação sai da
 * esteira. Mesma disciplina de ordem de `ganharNegocio`/`perderNegocio`
 * (`src/lib/actions/deals.ts`): leitura primeiro, depois a escrita que NÃO
 * tira nada de vista (`contas.fase`), por último a que tira
 * (`implantacoes.concluida_em`, que some da leitura via
 * `concluida_em is null`). Se a última falhar, a implantação continua
 * visível e "Concluir implantação" continua clicável — repetir é seguro,
 * `contas.fase = 'cliente'` de novo é inofensivo.
 */
export async function concluirImplantacao(implantacaoId: string) {
  const supabase = await createClient();

  const { data: implantacao, error: leituraError } = await supabase
    .from("implantacoes")
    .select("conta_id")
    .eq("id", implantacaoId)
    .single();
  if (leituraError) throw leituraError;

  const { error: contaError } = await supabase
    .from("contas")
    .update({ fase: "cliente" })
    .eq("id", implantacao.conta_id);
  if (contaError) throw contaError;

  const { error } = await supabase
    .from("implantacoes")
    .update({ concluida_em: new Date().toISOString() })
    .eq("id", implantacaoId);
  if (error) throw error;

  revalidatePath("/implantacao");
  revalidatePath("/hoje");
}

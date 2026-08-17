import { createClient } from "@/lib/supabase/server";
import type { ContaParaPainel, ImplantacaoParaPainel, NegocioParaPainel } from "@/lib/painel";

/**
 * A leitura do Painel: três consultas em paralelo, sem join — os três arrays
 * crus alimentam `calcularMetricasPainel` (`src/lib/painel.ts`), que faz o
 * cruzamento em memória, mesmo padrão de `data/hoje.ts`.
 *
 * O banco fala `snake_case` (`conta_id`, `proximo_passo`, `mexido_em`,
 * `negocio_id`, `concluida_em`); `calcularMetricasPainel` fala `camelCase`
 * (`contaId`, `proximoPasso`, `mexidoEm`, `negocioId`, `concluidaEm`). O
 * mapeamento acontece AQUI, na leitura — não em `page.tsx` — para que o
 * consumidor (a página) já receba exatamente o formato que a função pura
 * espera, sem repetir esse mapeamento se um segundo consumidor aparecer.
 * Mesmo raciocínio de `data/hoje.ts`, que já cruza implantações com etapas
 * antes de devolver: a adaptação entre o formato do banco e o formato que o
 * domínio usa é trabalho da camada de leitura, não da tela.
 */
export async function listDadosDoPainel() {
  const supabase = await createClient();

  const [negociosRes, contasRes, implantacoesRes] = await Promise.all([
    supabase
      .from("negocios")
      .select("id, conta_id, resultado, mrr, setup, proximo_passo, proximo_passo_em, mexido_em"),
    supabase.from("contas").select("id, fase, origem"),
    supabase.from("implantacoes").select("negocio_id, concluida_em"),
  ]);

  // Mesma sentinela do sino/pipeline/hoje: se qualquer uma das três fontes
  // falhou, a leitura INTEIRA é `unavailable` — um Painel que calcula MRR
  // ativo sobre `contas` completas mas `negocios` pela metade mentiria por
  // omissão, e é exatamente o tipo de mentira que esta tela existe para não
  // contar.
  if (negociosRes.error || contasRes.error || implantacoesRes.error) {
    console.error(
      "[painel] falha ao consultar o Supabase:",
      negociosRes.error,
      contasRes.error,
      implantacoesRes.error
    );
    return { unavailable: true as const };
  }

  const negocios: NegocioParaPainel[] = (negociosRes.data ?? []).map((n) => ({
    id: n.id,
    contaId: n.conta_id,
    resultado: n.resultado,
    // O tipo gerado diz `number`, mas colunas `numeric` do Postgres voltam do
    // PostgREST como STRING (preserva precisão decimal) — o resto do projeto
    // já lida com isso coagindo no ponto de uso (`Number(n.mrr ?? 0)` em
    // `PipelineClient.tsx`/`NegocioCard.tsx`). Aqui a coerção acontece na
    // leitura, uma vez só, para `calcularMetricasPainel` poder somar com `+`
    // sem cada soma virar concatenação de string a partir do segundo negócio.
    mrr: n.mrr === null ? null : Number(n.mrr),
    setup: n.setup === null ? null : Number(n.setup),
    proximoPasso: n.proximo_passo,
    proximoPassoEm: n.proximo_passo_em,
    mexidoEm: n.mexido_em,
  }));

  const contas: ContaParaPainel[] = (contasRes.data ?? []).map((c) => ({
    id: c.id,
    fase: c.fase,
    origem: c.origem,
  }));

  const implantacoes: ImplantacaoParaPainel[] = (implantacoesRes.data ?? []).map((i) => ({
    negocioId: i.negocio_id,
    concluidaEm: i.concluida_em,
  }));

  return { unavailable: false as const, negocios, contas, implantacoes };
}

type LeituraDoPainel = Awaited<ReturnType<typeof listDadosDoPainel>>;
export type DadosDoPainel = Extract<LeituraDoPainel, { unavailable: false }>;

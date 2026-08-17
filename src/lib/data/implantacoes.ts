import { createClient } from "@/lib/supabase/server";

/**
 * A leitura da esteira de implantação. Duas consultas separadas porque as
 * etapas são dado de configuração (6 linhas, `implantacao_etapas`) e as
 * implantações abertas são o trabalho em curso — mesma separação que o
 * Pipeline faz entre `ESTAGIOS` (lá, código) e `negocios` (lá, dado lido).
 *
 * `listEtapas` é pública para a Task 5 reusar: a leitura de `/hoje` também
 * precisa das etapas para calcular `vencimentoDaEtapa`/`saudeDaImplantacao`
 * de cada implantação.
 */
export async function listEtapas() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("implantacao_etapas")
    .select("posicao, nome, sla_dias, espera")
    .order("posicao");

  // Mesma sentinela do sino/pipeline: uma consulta que falhou não pode virar
  // "sem etapas" — a tela inteira depende de saber quais colunas existem.
  if (error) {
    console.error("[implantacao] falha ao consultar etapas:", error);
    return { unavailable: true as const };
  }

  return { unavailable: false as const, etapas: data ?? [] };
}

export async function listImplantacoesAbertas() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("implantacoes")
    .select(
      "id, etapa, etapa_desde, conta:contas(id, nome, nicho, cidade, uf), dono:profiles(id, full_name, initials)"
    )
    // Concluída (conta virou cliente) sai da esteira — mesmo raciocínio de
    // `resultado is null` no Pipeline: uma implantação fechada no meio de uma
    // coluna mentiria sobre quanto trabalho ainda existe ali.
    .is("concluida_em", null)
    .order("etapa_desde", { ascending: true });

  if (error) {
    console.error("[implantacao] falha ao consultar implantações:", error);
    return { unavailable: true as const };
  }

  return { unavailable: false as const, implantacoes: data ?? [] };
}

type LeituraDeEtapas = Awaited<ReturnType<typeof listEtapas>>;
export type Etapa = Extract<LeituraDeEtapas, { unavailable: false }>["etapas"][number];

type LeituraDeImplantacoes = Awaited<ReturnType<typeof listImplantacoesAbertas>>;
export type ImplantacaoAberta = Extract<LeituraDeImplantacoes, { unavailable: false }>["implantacoes"][number];

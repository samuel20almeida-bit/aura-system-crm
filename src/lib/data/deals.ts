import { createClient } from "@/lib/supabase/server";

/**
 * A leitura do Pipeline.
 *
 * O arquivo se chama `deals.ts` (nome do plano) mas a tabela é `negocios`: a
 * `public.deals` do CRM antigo continua no banco até a 3C decidir o que migra,
 * e foi por isso que a Task 2 batizou a tabela nova em português. Dentro daqui
 * "negócio" é sempre o registro novo.
 */
export async function listNegociosAbertos() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("negocios")
    .select(
      "*, conta:contas(id, nome, nicho, cidade, uf, decisor_nome, software_atual, origem, fase), dono:profiles(id, full_name, initials)"
    )
    // O quadro é o funil ABERTO. Ganho e perdido saem de cena: um negócio
    // fechado no meio da coluna de Proposta faria a coluna mentir sobre quanto
    // trabalho ainda existe ali.
    .is("resultado", null)
    // Não há coluna de posição em `negocios` — a ordem é regra, não arrasto: o
    // negócio parado há mais tempo fica no topo da sua coluna, que é onde o
    // olho bate primeiro.
    .order("mexido_em", { ascending: true });

  // A mesma sentinela do sino e do CRM (src/lib/data/notifications.ts,
  // src/lib/data/crm.ts): uma consulta que falhou não pode virar "nenhum
  // negócio no funil" — essa é a frase que o Samuel acreditaria, e ela o
  // faria parar de olhar justamente quando o sistema deixou de enxergar.
  if (error) {
    console.error("[pipeline] falha ao consultar os negócios:", error);
    return { unavailable: true as const };
  }

  return { unavailable: false as const, negocios: data ?? [] };
}

type LeituraDoPipeline = Awaited<ReturnType<typeof listNegociosAbertos>>;
export type NegocioAberto = Extract<LeituraDoPipeline, { unavailable: false }>["negocios"][number];

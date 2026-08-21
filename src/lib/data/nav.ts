import { createClient } from "@/lib/supabase/server";

/**
 * `overdueInvoices` saiu na Task 6 da Fase 3A junto com o item CRM do menu —
 * era o único consumidor do contador. As faturas continuam no banco, só sem
 * tela; o sino (`src/lib/data/notifications.ts`) também parou de consultá-las
 * na Task 1 da Fase 5F — a lógica de atraso derivado da data não tinha mais
 * consumidor e saiu junto.
 */
export async function getNavCounts() {
  const supabase = await createClient();

  // São poucas — é uma ferramenta interna de duas pessoas.
  const tasksRes = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .neq("status", "done");

  // Este contador alimenta o layout: lançar aqui derrubaria todas as páginas.
  // Mas um contador que não pôde ser lido também não pode aparecer como 0 —
  // era assim que o badge exibia um zero confiante enquanto o sino, na mesma
  // tela, admitia não ter conseguido consultar. `null` = "não sei", e a barra
  // lateral desenha "—". Ver src/lib/data/notifications.ts.
  if (tasksRes.error) {
    console.error("[navegação] falha ao consultar o Supabase:", tasksRes.error);
  }

  return {
    openTasks: tasksRes.error ? null : tasksRes.count ?? 0,
  };
}

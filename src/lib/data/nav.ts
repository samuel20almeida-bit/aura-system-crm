import { createClient } from "@/lib/supabase/server";
import { isInvoiceOverdue, UNPAID_INVOICE_STATUSES } from "@/lib/invoices";
import { todayInAppTz } from "@/lib/timezone";

export async function getNavCounts() {
  const supabase = await createClient();
  const today = todayInAppTz();

  // O atraso é derivado da data (ver src/lib/invoices.ts), então não dá para
  // contar no banco com um head count sobre o status: as linhas não pagas vêm
  // e o filtro roda aqui. São poucas — é uma ferramenta interna de duas pessoas.
  const [tasksRes, invoicesRes] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
    supabase.from("invoices").select("status, due_date").in("status", UNPAID_INVOICE_STATUSES),
  ]);

  // Estes contadores alimentam o layout: lançar aqui derrubaria todas as
  // páginas. Mas um contador que não pôde ser lido também não pode aparecer
  // como 0 — era assim que o badge exibia um zero confiante enquanto o sino,
  // na mesma tela, admitia não ter conseguido consultar. `null` = "não sei", e
  // a barra lateral desenha "—". Ver src/lib/data/notifications.ts.
  const failures = [tasksRes, invoicesRes].filter((r) => r.error);
  if (failures.length > 0) {
    console.error(
      "[navegação] falha ao consultar o Supabase:",
      failures.map((f) => f.error)
    );
  }

  return {
    openTasks: tasksRes.error ? null : tasksRes.count ?? 0,
    overdueInvoices: invoicesRes.error
      ? null
      : (invoicesRes.data ?? []).filter((i) => isInvoiceOverdue(i.status, i.due_date, today)).length,
  };
}

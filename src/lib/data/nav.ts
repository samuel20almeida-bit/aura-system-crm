import { createClient } from "@/lib/supabase/server";
import { isInvoiceOverdue, UNPAID_INVOICE_STATUSES } from "@/lib/invoices";
import { todayInAppTz } from "@/lib/timezone";

export async function getNavCounts() {
  const supabase = await createClient();
  const today = todayInAppTz();

  // O atraso é derivado da data (ver src/lib/invoices.ts), então não dá para
  // contar no banco com um head count sobre o status: as linhas não pagas vêm
  // e o filtro roda aqui. São poucas — é uma ferramenta interna de duas pessoas.
  const [{ count: openTasks }, { data: unpaidInvoices }] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
    supabase.from("invoices").select("status, due_date").in("status", UNPAID_INVOICE_STATUSES),
  ]);

  return {
    openTasks: openTasks ?? 0,
    overdueInvoices: (unpaidInvoices ?? []).filter((i) => isInvoiceOverdue(i.status, i.due_date, today)).length,
  };
}

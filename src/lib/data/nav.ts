import { createClient } from "@/lib/supabase/server";

export async function getNavCounts() {
  const supabase = await createClient();

  const [{ count: openTasks }, { count: overdueInvoices }] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "overdue"),
  ]);

  return {
    openTasks: openTasks ?? 0,
    overdueInvoices: overdueInvoices ?? 0,
  };
}

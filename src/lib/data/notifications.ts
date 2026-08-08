import { createClient } from "@/lib/supabase/server";
import { buildNotifications, type AppNotification } from "@/lib/notifications";
import { todayInAppTz } from "@/lib/timezone";

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const supabase = await createClient();
  const today = todayInAppTz();
  const in30Days = new Date(new Date(today + "T00:00:00Z").getTime() + 30 * 86400000).toISOString().slice(0, 10);

  const [{ data: invoices }, { data: tasks }, { data: contracts }, { data: timer }] = await Promise.all([
    supabase.from("invoices").select("id, client_id, amount, due_date, client:clients(name)").eq("status", "overdue"),
    supabase.from("tasks").select("id, title, due_date").eq("assignee_id", userId).neq("status", "done"),
    supabase
      .from("contracts")
      .select("id, client_id, end_date, client:clients(name)")
      .eq("status", "active")
      .not("end_date", "is", null)
      .lte("end_date", in30Days)
      .gte("end_date", today),
    supabase.from("time_entries").select("started_at").eq("user_id", userId).is("ended_at", null).maybeSingle(),
  ]);

  return buildNotifications(
    {
      overdueInvoices: (invoices ?? []).map((i) => ({
        id: i.id,
        clientId: i.client_id,
        clientName: i.client?.name ?? "Cliente",
        amount: Number(i.amount),
        dueDate: i.due_date,
      })),
      myOpenTasks: (tasks ?? []).map((t) => ({ id: t.id, title: t.title, dueDate: t.due_date })),
      endingContracts: (contracts ?? []).map((c) => ({
        id: c.id,
        clientId: c.client_id,
        clientName: c.client?.name ?? "Cliente",
        endDate: c.end_date!,
      })),
      runningTimerStartedAt: timer?.started_at ?? null,
    },
    today
  );
}

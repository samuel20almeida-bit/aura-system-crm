import { createClient } from "@/lib/supabase/server";
import { buildNotifications, type AppNotification } from "@/lib/notifications";
import { UNPAID_INVOICE_STATUSES } from "@/lib/invoices";
import { todayInAppTz } from "@/lib/timezone";

/**
 * Quando o banco não responde, o sino não pode dizer "Tudo em dia por aqui." —
 * ele não olhou. Um contador vazio o usuário desconfia; essa frase ele acredita.
 * Também não dá para lançar: o sino vive no layout, e derrubá-lo derrubaria
 * todas as páginas do app.
 */
const UNAVAILABLE: AppNotification[] = [
  {
    id: "avisos-indisponiveis",
    tone: "amber",
    title: "Não foi possível verificar os avisos agora",
    detail: "A consulta ao banco falhou — recarregue a página em instantes",
    href: null,
  },
];

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const supabase = await createClient();
  const today = todayInAppTz();
  const in30Days = new Date(new Date(today + "T00:00:00Z").getTime() + 30 * 86400000).toISOString().slice(0, 10);

  const [invoicesRes, tasksRes, contractsRes, timerRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, client_id, amount, due_date, status, client:clients(name)")
      .in("status", UNPAID_INVOICE_STATUSES)
      .order("due_date"),
    supabase
      .from("tasks")
      .select("id, title, due_date")
      .eq("assignee_id", userId)
      .neq("status", "done")
      .order("due_date"),
    supabase
      .from("contracts")
      .select("id, client_id, end_date, client:clients(name)")
      .eq("status", "active")
      .not("end_date", "is", null)
      .lte("end_date", in30Days)
      .gte("end_date", today),
    // Ordenar e limitar: se um race no startTimer deixar duas entradas abertas,
    // um maybeSingle() cru devolve erro e o aviso de timer esquecido sumiria
    // justamente quando os dados estão mais quebrados.
    supabase
      .from("time_entries")
      .select("started_at")
      .eq("user_id", userId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const failure = [invoicesRes, tasksRes, contractsRes, timerRes].find((r) => r.error);
  if (failure) {
    console.error("[avisos] falha ao consultar o Supabase:", failure.error);
    return UNAVAILABLE;
  }

  return buildNotifications(
    {
      openInvoices: (invoicesRes.data ?? []).map((i) => ({
        id: i.id,
        clientId: i.client_id,
        clientName: i.client?.name ?? "Cliente",
        amount: Number(i.amount),
        dueDate: i.due_date,
        status: i.status,
      })),
      myOpenTasks: (tasksRes.data ?? []).map((t) => ({ id: t.id, title: t.title, dueDate: t.due_date })),
      endingContracts: (contractsRes.data ?? []).map((c) => ({
        id: c.id,
        clientId: c.client_id,
        clientName: c.client?.name ?? "Cliente",
        endDate: c.end_date!,
      })),
      runningTimerStartedAt: timerRes.data?.started_at ?? null,
    },
    today
  );
}

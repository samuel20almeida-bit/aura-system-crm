import { createClient } from "@/lib/supabase/server";
import { isInvoiceOverdue, UNPAID_INVOICE_STATUSES } from "@/lib/invoices";
import {
  addDaysToDateStr,
  currentQuarterInAppTz,
  startOfMonthInAppTz,
  startOfWeekInAppTz,
  todayInAppTz,
} from "@/lib/timezone";

export async function getDashboardData(userId: string) {
  const supabase = await createClient();
  const todayStr = todayInAppTz();
  const monthStart = startOfMonthInAppTz();
  const monthEnd = startOfMonthInAppTz(new Date(), 1);
  const weekStart = startOfWeekInAppTz();
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
  const todayDow = new Date(todayStr + "T00:00:00Z").getUTCDay(); // 0=Sun..6=Sat, safe: todayStr is a plain calendar date
  const weekStartStr = addDaysToDateStr(todayStr, todayDow === 0 ? -6 : 1 - todayDow);
  const fridayStr = addDaysToDateStr(weekStartStr, 4);
  const quarter = currentQuarterInAppTz();

  const [
    profilesRes,
    myTasksRes,
    weekEntriesRes,
    unpaidInvoicesRes,
    paidInvoicesRes,
    revenueGoalRes,
    activityRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase
      .from("tasks")
      .select("*, client:clients(id, name, color)")
      .eq("assignee_id", userId)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("time_entries").select("user_id, minutes, billable").gte("started_at", weekStart.toISOString()).lt("started_at", weekEnd.toISOString()).not("minutes", "is", null),
    supabase.from("invoices").select("*, client:clients(id, name)").in("status", UNPAID_INVOICE_STATUSES).order("due_date"),
    supabase.from("invoices").select("amount").eq("status", "paid").gte("paid_at", monthStart.toISOString().slice(0, 10)).lt("paid_at", monthEnd.toISOString().slice(0, 10)),
    // "%fatur%" casa com mais de uma meta ("Faturamento", "Faturar mais"...).
    // Sem ordenar e limitar, o maybeSingle() devolvia erro e o percentual da
    // meta sumia da /início sem dizer por quê. A ordem é a mesma da /metas.
    supabase
      .from("goals")
      .select("*")
      .eq("quarter", quarter)
      .eq("area", "Geral")
      .eq("unit", "currency")
      .ilike("title", "%fatur%")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from("activity_log").select("*, user:profiles(id, full_name, initials)").order("created_at", { ascending: false }).limit(6),
  ]);

  const openTasksWeekRes = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .neq("status", "done")
    .not("due_date", "is", null)
    .lte("due_date", fridayStr)
    .gte("due_date", weekStartStr);

  // Um número que não pôde ser lido não pode aparecer como 0 — ver a sentinela
  // de src/lib/data/notifications.ts. Aqui a granularidade é por consulta: o
  // que deu certo continua sendo mostrado, o que falhou vira `null` e a página
  // desenha "—" em vez de um zero confiante.
  const failures = [
    profilesRes,
    myTasksRes,
    weekEntriesRes,
    unpaidInvoicesRes,
    paidInvoicesRes,
    revenueGoalRes,
    activityRes,
    openTasksWeekRes,
  ].filter((r) => r.error);
  if (failures.length > 0) {
    console.error(
      "[início] falha ao consultar o Supabase:",
      failures.map((f) => f.error)
    );
  }

  const profiles = profilesRes.data;
  const myTasks = myTasksRes.data;
  const weekEntries = weekEntriesRes.data;

  const monthRevenue = paidInvoicesRes.error
    ? null
    : (paidInvoicesRes.data ?? []).reduce((s, i) => s + Number(i.amount), 0);

  // Mesma regra derivada da data que o sino usa — ver src/lib/invoices.ts.
  const overdueInvoices = unpaidInvoicesRes.error
    ? null
    : (unpaidInvoicesRes.data ?? []).filter((i) => isInvoiceOverdue(i.status, i.due_date, todayStr));
  const overdueAmount = overdueInvoices === null ? null : overdueInvoices.reduce((s, i) => s + Number(i.amount), 0);

  const capacity =
    profilesRes.error || weekEntriesRes.error
      ? null
      : (profiles ?? []).map((p) => {
          const minutes = (weekEntries ?? []).filter((e) => e.user_id === p.id).reduce((s, e) => s + (e.minutes ?? 0), 0);
          return { profile: p, hours: minutes / 60, target: p.weekly_capacity_hours };
        });

  const myWeekMinutes = (weekEntries ?? []).filter((e) => e.user_id === userId).reduce((s, e) => s + (e.minutes ?? 0), 0);
  const myWeekBillable = (weekEntries ?? []).filter((e) => e.user_id === userId && e.billable).reduce((s, e) => s + (e.minutes ?? 0), 0);

  const myTasksToday = myTasksRes.error ? null : (myTasks ?? []).filter((t) => t.due_date && t.due_date <= todayStr).length;
  const myTasksWeek = myTasksToday === null ? null : (myTasks ?? []).length - myTasksToday;

  return {
    todayStr,
    /** `null` quando a consulta falhou — a lista vazia significaria "nada pendente". */
    myTasks: myTasksRes.error ? null : (myTasks ?? []).slice(0, 5),
    myTasksToday,
    myTasksWeek,
    capacity,
    myWeekHours: weekEntriesRes.error ? null : myWeekMinutes / 60,
    myWeekBillablePct: weekEntriesRes.error ? null : myWeekMinutes > 0 ? (myWeekBillable / myWeekMinutes) * 100 : 0,
    monthRevenue,
    revenueGoal: revenueGoalRes.error ? null : revenueGoalRes.data,
    overdueInvoices,
    overdueAmount,
    activity: activityRes.error ? null : activityRes.data ?? [],
    openTasksThisWeek: openTasksWeekRes.error ? null : openTasksWeekRes.count ?? 0,
    /** Ao menos uma consulta falhou — a página avisa em vez de fingir normalidade. */
    unavailable: failures.length > 0,
  };
}

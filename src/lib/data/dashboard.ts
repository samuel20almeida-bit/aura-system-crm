import { createClient } from "@/lib/supabase/server";

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getDashboardData(userId: string) {
  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
  const friday = new Date(weekStart.getTime() + 4 * 86400000);
  const quarter = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;

  const [
    { data: profiles },
    { data: myTasks },
    { data: weekEntries },
    { data: overdueInvoices },
    { data: paidInvoicesThisMonth },
    { data: endingContracts },
    { data: revenueGoal },
    { data: activity },
  ] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase
      .from("tasks")
      .select("*, client:clients(id, name, color)")
      .eq("assignee_id", userId)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("time_entries").select("user_id, minutes, billable").gte("started_at", weekStart.toISOString()).lt("started_at", weekEnd.toISOString()).not("minutes", "is", null),
    supabase.from("invoices").select("*, client:clients(id, name)").eq("status", "overdue").order("due_date"),
    supabase.from("invoices").select("amount").eq("status", "paid").gte("paid_at", monthStart.toISOString().slice(0, 10)).lt("paid_at", monthEnd.toISOString().slice(0, 10)),
    supabase.from("contracts").select("*, client:clients(id, name)").eq("status", "active").not("end_date", "is", null).lte("end_date", new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10)).gte("end_date", now.toISOString().slice(0, 10)),
    supabase.from("goals").select("*").eq("quarter", quarter).eq("area", "Geral").eq("unit", "currency").ilike("title", "%fatur%").maybeSingle(),
    supabase.from("activity_log").select("*, user:profiles(id, full_name, initials)").order("created_at", { ascending: false }).limit(6),
  ]);

  const { count: openTasksThisWeek } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .neq("status", "done")
    .not("due_date", "is", null)
    .lte("due_date", friday.toISOString().slice(0, 10))
    .gte("due_date", weekStart.toISOString().slice(0, 10));

  const monthRevenue = (paidInvoicesThisMonth ?? []).reduce((s, i) => s + Number(i.amount), 0);
  const overdueAmount = (overdueInvoices ?? []).reduce((s, i) => s + Number(i.amount), 0);

  const capacity = (profiles ?? []).map((p) => {
    const minutes = (weekEntries ?? []).filter((e) => e.user_id === p.id).reduce((s, e) => s + (e.minutes ?? 0), 0);
    return { profile: p, hours: minutes / 60, target: p.weekly_capacity_hours };
  });

  const myWeekMinutes = (weekEntries ?? []).filter((e) => e.user_id === userId).reduce((s, e) => s + (e.minutes ?? 0), 0);
  const myWeekBillable = (weekEntries ?? []).filter((e) => e.user_id === userId && e.billable).reduce((s, e) => s + (e.minutes ?? 0), 0);

  const todayStr = now.toISOString().slice(0, 10);
  const myTasksToday = (myTasks ?? []).filter((t) => t.due_date && t.due_date <= todayStr).length;
  const myTasksWeek = (myTasks ?? []).length - myTasksToday;

  return {
    todayStr,
    weekLabel: friday,
    myTasks: (myTasks ?? []).slice(0, 5),
    myTasksToday,
    myTasksWeek,
    capacity,
    myWeekHours: myWeekMinutes / 60,
    myWeekBillablePct: myWeekMinutes > 0 ? (myWeekBillable / myWeekMinutes) * 100 : 0,
    monthRevenue,
    revenueGoal,
    overdueInvoices: overdueInvoices ?? [],
    overdueAmount,
    endingContracts: endingContracts ?? [],
    activity: activity ?? [],
    openTasksThisWeek: openTasksThisWeek ?? 0,
  };
}

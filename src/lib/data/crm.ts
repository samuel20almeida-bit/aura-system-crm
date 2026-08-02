import { createClient } from "@/lib/supabase/server";

export async function getCrmData() {
  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);

  const [{ data: clients }, { data: deals }, { data: invoices }, { data: contracts }] = await Promise.all([
    supabase.from("clients").select("*, owner:profiles(id, full_name, initials)").order("name"),
    supabase.from("deals").select("*, client:clients(id, name), owner:profiles(id, full_name, initials)").order("created_at", { ascending: false }),
    supabase.from("invoices").select("*, client:clients(id, name, color)").order("due_date", { ascending: false }),
    supabase.from("contracts").select("*, client:clients(id, name)"),
  ]);

  const paidThisMonth = (invoices ?? []).filter(
    (i) => i.status === "paid" && i.paid_at && i.paid_at >= monthStart && i.paid_at < monthEnd
  );
  const monthRevenue = paidThisMonth.reduce((s, i) => s + Number(i.amount), 0);
  const overdue = (invoices ?? []).filter((i) => i.status === "overdue");
  const overdueAmount = overdue.reduce((s, i) => s + Number(i.amount), 0);
  const allActiveAmount = (invoices ?? [])
    .filter((i) => i.due_date >= monthStart.slice(0, 7))
    .reduce((s, i) => s + Number(i.amount), 0);
  const ticketMedio = clients && clients.length > 0 && monthRevenue > 0 ? monthRevenue / paidThisMonth.length : 0;

  return {
    clients: clients ?? [],
    deals: deals ?? [],
    invoices: invoices ?? [],
    contracts: contracts ?? [],
    monthRevenue,
    overdueAmount,
    overdueCount: overdue.length,
    inadimplenciaPct: allActiveAmount > 0 ? (overdueAmount / allActiveAmount) * 100 : 0,
    ticketMedio,
  };
}

export async function getClientDetail(id: string) {
  const supabase = await createClient();
  const [{ data: client }, { data: contracts }, { data: invoices }, { data: tasks }, { data: contacts }, { data: runs }] =
    await Promise.all([
      supabase.from("clients").select("*, owner:profiles(id, full_name, initials)").eq("id", id).single(),
      supabase.from("contracts").select("*").eq("client_id", id).order("start_date", { ascending: false }),
      supabase.from("invoices").select("*").eq("client_id", id).order("due_date", { ascending: false }),
      supabase
        .from("tasks")
        .select("*, assignee:profiles!tasks_assignee_id_fkey(id, full_name, initials)")
        .eq("client_id", id)
        .order("due_date"),
      supabase.from("client_contacts").select("*, author:profiles(id, full_name, initials)").eq("client_id", id).order("created_at", { ascending: false }),
      supabase.from("playbook_runs").select("*, playbook:playbooks(id, name)").eq("client_id", id),
    ]);

  const { data: timeEntries } = await supabase.from("time_entries").select("minutes").eq("client_id", id).not("minutes", "is", null);
  const totalMinutes = (timeEntries ?? []).reduce((s, t) => s + (t.minutes ?? 0), 0);
  const revenueTotal = (invoices ?? []).filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);

  return {
    client,
    contracts: contracts ?? [],
    invoices: invoices ?? [],
    tasks: tasks ?? [],
    contacts: contacts ?? [],
    runs: runs ?? [],
    totalMinutes,
    revenueTotal,
  };
}

import { createClient } from "@/lib/supabase/server";
import { isInvoiceOverdue } from "@/lib/invoices";
import { todayInAppTz, yearMonthInAppTz } from "@/lib/timezone";

function monthBounds() {
  const { year, month0 } = yearMonthInAppTz();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    monthStart: `${year}-${pad(month0 + 1)}-01`,
    monthEnd: month0 === 11 ? `${year + 1}-01-01` : `${year}-${pad(month0 + 2)}-01`,
  };
}

export async function getCrmData() {
  const supabase = await createClient();
  const today = todayInAppTz();
  const { monthStart, monthEnd } = monthBounds();

  const [clientsRes, dealsRes, invoicesRes, contractsRes] = await Promise.all([
    supabase.from("clients").select("*, owner:profiles(id, full_name, initials)").order("name"),
    supabase.from("deals").select("*, client:clients(id, name), owner:profiles(id, full_name, initials)").order("created_at", { ascending: false }),
    supabase.from("invoices").select("*, client:clients(id, name, color)").order("due_date", { ascending: false }),
    supabase.from("contracts").select("*, client:clients(id, name)"),
  ]);

  // Sentinela igual à do sino (src/lib/data/notifications.ts): sem isto, uma
  // falha do banco virava "nenhum cliente, nenhuma fatura, R$ 0 de
  // inadimplência" — as quatro consultas se sustentam mutuamente (o KPI de
  // ticket médio mistura clientes e faturas), então a página inteira ou é
  // confiável ou não é. Aqui não dá para lançar sem trocar a tela por um
  // "Algo deu errado" genérico.
  const failures = [clientsRes, dealsRes, invoicesRes, contractsRes].filter((r) => r.error);
  if (failures.length > 0) {
    console.error(
      "[crm] falha ao consultar o Supabase:",
      failures.map((f) => f.error)
    );
    return { unavailable: true as const };
  }

  const clients = clientsRes.data;
  const deals = dealsRes.data;
  const invoices = invoicesRes.data;
  const contracts = contractsRes.data;

  const paidThisMonth = (invoices ?? []).filter(
    (i) => i.status === "paid" && i.paid_at && i.paid_at >= monthStart && i.paid_at < monthEnd
  );
  const monthRevenue = paidThisMonth.reduce((s, i) => s + Number(i.amount), 0);
  // Mesma regra derivada da data que o sino usa — ver src/lib/invoices.ts.
  // A coluna de status da tabela de faturas continua mostrando o valor guardado.
  const overdue = (invoices ?? []).filter((i) => isInvoiceOverdue(i.status, i.due_date, today));
  const overdueAmount = overdue.reduce((s, i) => s + Number(i.amount), 0);
  // Denominador: a carteira em aberto inteira. As faturas vencidas são um
  // subconjunto dela, então o percentual não passa de 100%. Enquanto o
  // numerador vinha do status marcado à mão isso não aparecia; derivando o
  // atraso da data, um denominador recortado por mês produzia inadimplência
  // de 500% assim que uma fatura de um mês anterior vencesse.
  const openAmount = (invoices ?? [])
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + Number(i.amount), 0);
  const ticketMedio = clients && clients.length > 0 && monthRevenue > 0 ? monthRevenue / paidThisMonth.length : 0;

  return {
    unavailable: false as const,
    clients: clients ?? [],
    deals: deals ?? [],
    invoices: invoices ?? [],
    contracts: contracts ?? [],
    monthRevenue,
    overdueAmount,
    overdueCount: overdue.length,
    inadimplenciaPct: openAmount > 0 ? (overdueAmount / openAmount) * 100 : 0,
    ticketMedio,
  };
}

export async function getClientDetail(id: string) {
  const supabase = await createClient();
  const [clientRes, contractsRes, invoicesRes, tasksRes, contactsRes, runsRes] = await Promise.all([
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

  const timeEntriesRes = await supabase.from("time_entries").select("minutes").eq("client_id", id).not("minutes", "is", null);

  // PGRST116 no .single() é "nenhuma linha" — aí o cliente realmente não
  // existe e a página chama notFound(). Qualquer outro erro é falha de
  // consulta, e dizer "cliente não encontrado" seria mentira; o mesmo vale
  // para as consultas de apoio, cujas listas vazias significariam "esse
  // cliente não tem nada".
  const clientMissing = Boolean(clientRes.error) && clientRes.error?.code === "PGRST116";
  const failures = [clientRes, contractsRes, invoicesRes, tasksRes, contactsRes, runsRes, timeEntriesRes].filter(
    (r) => r.error && !(r === clientRes && clientMissing)
  );
  if (failures.length > 0) {
    console.error(
      "[crm/cliente] falha ao consultar o Supabase:",
      failures.map((f) => f.error)
    );
    return { unavailable: true as const };
  }

  const client = clientRes.data;
  const contracts = contractsRes.data;
  const invoices = invoicesRes.data;
  const tasks = tasksRes.data;
  const contacts = contactsRes.data;
  const runs = runsRes.data;

  const totalMinutes = (timeEntriesRes.data ?? []).reduce((s, t) => s + (t.minutes ?? 0), 0);
  const revenueTotal = (invoices ?? []).filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);

  return {
    unavailable: false as const,
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

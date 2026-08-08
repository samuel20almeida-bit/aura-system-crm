import { createClient } from "@/lib/supabase/server";

export async function getRunningTimer(userId: string) {
  const supabase = await createClient();
  // Mesma ordenação do sino e do stopRunningTimer: a entrada aberta mais
  // recente. Sem .limit(1), duas entradas abertas faziam o maybeSingle()
  // devolver erro, o erro era descartado e o TimerWidget sumia da barra.
  const { data, error } = await supabase
    .from("time_entries")
    .select("*, task:tasks(id, title, code), client:clients(id, name, color)")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Esta função alimenta o layout: lançar aqui derrubaria todas as páginas.
  // O sino é quem avisa o usuário de que o banco não respondeu.
  if (error) {
    console.error("[timer] falha ao consultar o timer em andamento:", error);
    return null;
  }
  return data;
}

export async function getHorasPageData(monthStart: Date, monthEnd: Date) {
  const supabase = await createClient();

  const [{ data: entries }, { data: profiles }, { data: clients }, { data: tasks }, { data: invoices }] =
    await Promise.all([
      supabase
        .from("time_entries")
        .select("*, user:profiles(id, full_name, initials), client:clients(id, name, color), task:tasks(id, title, code)")
        .gte("started_at", monthStart.toISOString())
        .lt("started_at", monthEnd.toISOString())
        .not("minutes", "is", null)
        .order("started_at", { ascending: false }),
      supabase.from("profiles").select("*"),
      supabase.from("clients").select("id, name, color, status").eq("status", "active"),
      supabase.from("tasks").select("id, client_id, estimated_hours"),
      supabase
        .from("invoices")
        .select("client_id, amount")
        .eq("status", "paid")
        .gte("paid_at", monthStart.toISOString().slice(0, 10))
        .lt("paid_at", monthEnd.toISOString().slice(0, 10)),
    ]);

  return {
    entries: entries ?? [],
    profiles: profiles ?? [],
    clients: clients ?? [],
    tasks: tasks ?? [],
    invoices: invoices ?? [],
  };
}

export type HorasPageData = Awaited<ReturnType<typeof getHorasPageData>>;

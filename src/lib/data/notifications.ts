import { createClient } from "@/lib/supabase/server";
import { buildNotifications, type AppNotification } from "@/lib/notifications";
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

  const tasksRes = await supabase
    .from("tasks")
    .select("id, title, due_date")
    .eq("assignee_id", userId)
    .neq("status", "done")
    .order("due_date");

  if (tasksRes.error) {
    console.error("[avisos] falha ao consultar o Supabase:", tasksRes.error);
    return UNAVAILABLE;
  }

  return buildNotifications(
    {
      myOpenTasks: (tasksRes.data ?? []).map((t) => ({ id: t.id, title: t.title, dueDate: t.due_date })),
    },
    today
  );
}

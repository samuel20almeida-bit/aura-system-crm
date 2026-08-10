import { createClient } from "@/lib/supabase/server";
import type { ActivityRow } from "@/lib/activity-feed";

/**
 * `null` diz "a consulta falhou" — nunca uma lista vazia silenciosa, que diria
 * "não aconteceu nada" quando na verdade ninguém perguntou ao banco. Mesmo
 * padrão de `src/lib/data/notifications.ts`.
 */
export async function getRecentActivity(limit = 12): Promise<ActivityRow[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, verb, detail, created_at, user_id, user:profiles(id, full_name, initials)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[atividade] falha ao consultar o Supabase:", error);
    return null;
  }

  return data;
}

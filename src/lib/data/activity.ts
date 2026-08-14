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
    // Desempate. `created_at` vem de `now()`, que é o instante da TRANSAÇÃO:
    // hoje cada `logActivity` roda na sua, então não há empate — mas duas
    // escritas na mesma transação dividiriam o timestamp e a ordem entre elas
    // ficaria indefinida, podendo mudar de um refresh para o outro. Isso não só
    // embaralharia a lista como faria o painel animar linhas antigas como se
    // fossem novas. `id` é uuid: não ordena por nada semântico, só garante que
    // a mesma consulta devolva sempre a mesma ordem.
    .order("id", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[atividade] falha ao consultar o Supabase:", error);
    return null;
  }

  return data;
}

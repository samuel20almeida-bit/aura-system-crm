import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export async function logActivity(
  supabase: SupabaseClient<Database>,
  userId: string | null,
  verb: string,
  detail?: string
) {
  await supabase.from("activity_log").insert({ user_id: userId, verb, detail: detail ?? null });
}

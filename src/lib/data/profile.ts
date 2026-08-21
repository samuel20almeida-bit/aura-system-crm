import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Envolvida em `cache()` porque `/hoje` chama isto duas vezes por
 * renderização — uma no layout, outra na página. Sem a deduplicação são
 * dois `auth.getUser()` (que é rede, não CPU) e duas consultas a
 * `profiles` para responder a mesma pergunta. O `cache()` do React vale
 * só por passada de renderização no servidor: requisições diferentes não
 * compartilham nada entre si.
 */
export const requireProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return { userId: user.id, profile };
});

export async function listProfiles() {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("full_name");
  return data ?? [];
}

import { createClient } from "@/lib/supabase/server";

export async function listCredentials() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("credenciais")
    .select("*, categoria:credencial_categorias(id, nome), cliente:clients(id, name)")
    .order("nome");
  if (error) throw error;
  return data;
}

export type CredentialWithRelations = Awaited<ReturnType<typeof listCredentials>>[number];

export async function listCredentialCategories() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("credencial_categorias")
    .select("id, nome")
    .order("position");
  return data ?? [];
}

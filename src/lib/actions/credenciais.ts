"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type CredentialInput = {
  nome: string;
  categoriaId: string;
  clienteId: string | null;
  usuario: string | null;
  senha: string | null;
  url: string | null;
  notas: string | null;
};

export async function createCredential(input: CredentialInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("credenciais").insert({
    nome: input.nome,
    categoria_id: input.categoriaId,
    cliente_id: input.clienteId,
    usuario: input.usuario,
    senha: input.senha,
    url: input.url,
    notas: input.notas,
  });
  if (error) throw error;
  revalidatePath("/credenciais");
}

export async function updateCredential(id: string, input: CredentialInput) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("credenciais")
    .update({
      nome: input.nome,
      categoria_id: input.categoriaId,
      cliente_id: input.clienteId,
      usuario: input.usuario,
      senha: input.senha,
      url: input.url,
      notas: input.notas,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/credenciais");
}

export async function deleteCredential(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("credenciais").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/credenciais");
}

export async function createCredentialCategory(nome: string) {
  const supabase = await createClient();
  const nomeAparado = nome.trim();

  // Reaproveita uma categoria já existente com o mesmo nome (ignorando
  // maiúsculas/minúsculas e espaço nas pontas) em vez de duplicar — mesmo
  // padrão de createTaskArea em src/lib/actions/tasks.ts.
  const { data: existente } = await supabase
    .from("credencial_categorias")
    .select("id, nome")
    .ilike("nome", nomeAparado)
    .maybeSingle();
  if (existente) return existente;

  const { data: maxPos } = await supabase
    .from("credencial_categorias")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("credencial_categorias")
    .insert({ nome: nomeAparado, position: (maxPos?.position ?? 0) + 1 })
    .select("id, nome")
    .single();
  if (error) throw error;

  revalidatePath("/credenciais");
  return data;
}

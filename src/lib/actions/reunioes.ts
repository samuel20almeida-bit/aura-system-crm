"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ReuniaoInput = {
  titulo: string;
  contaId: string | null;
  /** ISO. A tela monta a partir de `<input type="datetime-local">` no fuso do navegador. */
  aconteceEm: string;
  duracaoMin: number | null;
  pauta: string | null;
};

export async function createReuniao(input: ReuniaoInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("reunioes")
    .insert({
      titulo: input.titulo,
      conta_id: input.contaId,
      acontece_em: input.aconteceEm,
      duracao_min: input.duracaoMin,
      pauta: input.pauta,
      criado_por: user.id,
    })
    .select("id")
    .single();

  if (error) throw error;
  revalidatePath("/reunioes");
  return data;
}

export async function updateReuniao(id: string, input: ReuniaoInput) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reunioes")
    .update({
      titulo: input.titulo,
      conta_id: input.contaId,
      acontece_em: input.aconteceEm,
      duracao_min: input.duracaoMin,
      pauta: input.pauta,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/reunioes");
}

/**
 * A ata salva sozinha, sem passar por `updateReuniao`.
 *
 * Não é economia: as duas escritas acontecem em momentos diferentes e por
 * caminhos diferentes. Os campos de agendamento são salvos por um formulário
 * com botão; a ata é um textarea que salva no `onBlur`, como as gavetas do
 * Pipeline e da Implantação já fazem. Se a ata passasse pela mesma ação,
 * cada salvamento automático reescreveria título, conta, horário e duração
 * com o que estivesse na tela — e um campo de agendamento meio editado seria
 * gravado sem ninguém mandar.
 */
export async function salvarAta(id: string, ata: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reunioes")
    .update({ ata: ata.trim() === "" ? null : ata, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/reunioes");
}

/**
 * Apagar a reunião NÃO apaga as tarefas que saíram dela — `reuniao_id` é
 * `on delete set null`. O trabalho combinado continua no quadro; o que se
 * perde é a origem. Quem chama avisa isso na confirmação.
 */
export async function deleteReuniao(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("reunioes").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/reunioes");
  revalidatePath("/kanban");
}

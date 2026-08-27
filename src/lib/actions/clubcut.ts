"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * O vínculo entre uma conta do CRM e um salão do ClubCut.
 *
 * É a única escrita desta parte do sistema feita por gente: o uso diário
 * chega pelo sincronizador, mas dizer QUAL salão é QUAL cliente é decisão
 * humana — nome de conta e nome de salão divergem o tempo todo ("El
 * Guardians" aqui, "El Guardians Barbearia LTDA" lá), e casar por nome
 * acertaria na maioria e erraria em silêncio no resto.
 */
export async function vincularSalao(contaId: string, salonId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  // Um salão pertence a no máximo uma conta — o `unique` da coluna garante.
  // Soltar o vínculo anterior ANTES de criar o novo transforma "mudei de
  // ideia sobre qual conta é esse salão" numa operação que funciona, em vez
  // de um erro de chave duplicada que o usuário não tem como interpretar.
  if (salonId) {
    const { error: erroSolta } = await supabase
      .from("contas")
      .update({ clubcut_salon_id: null })
      .eq("clubcut_salon_id", salonId)
      .neq("id", contaId);
    if (erroSolta) throw erroSolta;
  }

  const { error } = await supabase
    .from("contas")
    .update({ clubcut_salon_id: salonId })
    .eq("id", contaId);

  if (error) throw error;

  revalidatePath("/operacao");
}

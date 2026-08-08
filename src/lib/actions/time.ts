"use server";

import { createClient } from "@/lib/supabase/server";
import { elapsedMinutes } from "@/lib/time-math";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";
import { formatHours } from "@/lib/format";

export async function startTimer(taskId: string | null, clientId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  await stopRunningTimer();

  const { error } = await supabase.from("time_entries").insert({
    task_id: taskId,
    client_id: clientId,
    user_id: user.id,
    started_at: new Date().toISOString(),
  });
  if (error) throw error;
  revalidatePath("/horas");
  revalidatePath("/kanban");
  revalidatePath("/inicio");
}

export async function stopRunningTimer(note?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Ordenar e limitar pelo mesmo motivo do sino (ver src/lib/data/notifications.ts):
  // se alguma vez sobrarem duas entradas abertas, um maybeSingle() cru devolve
  // erro — e era justamente aí, com os dados já quebrados, que parar o timer
  // ficava impossível. Com a mais recente primeiro, cada clique em "parar"
  // fecha uma entrada e o estado volta ao normal.
  const { data: running, error: readError } = await supabase
    .from("time_entries")
    .select("id, started_at, task_id")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) throw readError;

  if (!running) return;

  const endedAt = new Date();
  const minutes = elapsedMinutes(running.started_at, endedAt);

  // Sem esta verificação o encerramento falhava calado: o startTimer seguinte
  // inseria assim mesmo, sobravam duas linhas com ended_at nulo e as horas
  // paravam de ser registradas sem uma única mensagem.
  const { error: updateError } = await supabase
    .from("time_entries")
    .update({ ended_at: endedAt.toISOString(), minutes, note: note ?? null })
    .eq("id", running.id);
  if (updateError) throw updateError;

  if (running.task_id) {
    await logActivity(supabase, user.id, "lançou", formatHours(minutes), running.task_id);
  }

  revalidatePath("/horas");
  revalidatePath("/kanban");
  revalidatePath("/inicio");
}

export async function logManualTime(input: {
  taskId: string | null;
  clientId: string | null;
  minutes: number;
  note: string | null;
  billable: boolean;
  date: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const startedAt = new Date(`${input.date}T09:00:00`);
  const endedAt = new Date(startedAt.getTime() + input.minutes * 60000);

  const { error } = await supabase.from("time_entries").insert({
    task_id: input.taskId,
    client_id: input.clientId,
    user_id: user.id,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    minutes: input.minutes,
    note: input.note,
    billable: input.billable,
  });
  if (error) throw error;

  if (input.taskId) {
    await logActivity(supabase, user.id, "lançou", formatHours(input.minutes), input.taskId);
  }

  revalidatePath("/horas");
  revalidatePath("/inicio");
}

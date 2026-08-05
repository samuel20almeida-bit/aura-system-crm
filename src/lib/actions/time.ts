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

  const { data: running } = await supabase
    .from("time_entries")
    .select("id, started_at, task_id")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .maybeSingle();

  if (!running) return;

  const endedAt = new Date();
  const minutes = elapsedMinutes(running.started_at, endedAt);

  await supabase
    .from("time_entries")
    .update({ ended_at: endedAt.toISOString(), minutes, note: note ?? null })
    .eq("id", running.id);

  if (running.task_id) {
    await logActivity(supabase, user.id, "lançou horas em", formatHours(minutes), running.task_id);
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
    await logActivity(supabase, user.id, "lançou horas em", formatHours(input.minutes), input.taskId);
  }

  revalidatePath("/horas");
  revalidatePath("/inicio");
}

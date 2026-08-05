"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";
import { nextTaskCode } from "@/lib/data/tasks";

export async function createTask(input: {
  title: string;
  clientId: string | null;
  isInternal: boolean;
  area?: string | null;
  priority: string;
  assigneeId: string | null;
  dueDate: string | null;
  description?: string | null;
  estimatedHours?: number | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const code = await nextTaskCode(input.clientId, input.isInternal);

  const { data: maxPos } = await supabase
    .from("tasks")
    .select("position")
    .eq("status", "todo")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      title: input.title,
      code,
      client_id: input.isInternal ? null : input.clientId,
      is_internal: input.isInternal,
      area: input.area ?? null,
      priority: input.priority,
      assignee_id: input.assigneeId,
      due_date: input.dueDate,
      description: input.description ?? null,
      estimated_hours: input.estimatedHours ?? null,
      status: "todo",
      position: (maxPos?.position ?? 0) + 1,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  await logActivity(supabase, user.id, "criou a tarefa", task.title, task.id);
  revalidatePath("/kanban");
  revalidatePath("/inicio");
  return task;
}

export async function updateTaskPosition(input: {
  taskId: string;
  status: string;
  orderedIdsInColumn: string[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: prevTask } = await supabase.from("tasks").select("status, title").eq("id", input.taskId).single();

  const { error: statusError } = await supabase
    .from("tasks")
    .update({ status: input.status })
    .eq("id", input.taskId);
  if (statusError) throw statusError;

  const positionResults = await Promise.all(
    input.orderedIdsInColumn.map((id, index) =>
      supabase.from("tasks").update({ position: index }).eq("id", id)
    )
  );
  const positionError = positionResults.find((r) => r.error)?.error;
  if (positionError) throw positionError;

  if (prevTask && prevTask.status !== input.status && user) {
    const labels: Record<string, string> = { todo: "A fazer", in_progress: "Em andamento", done: "Finalizadas" };
    await logActivity(
      supabase,
      user.id,
      `moveu ${prevTask.title} para`,
      labels[input.status] ?? input.status,
      input.taskId
    );
  }

  revalidatePath("/kanban");
  revalidatePath("/inicio");
}

export async function updateTask(
  taskId: string,
  patch: Partial<{
    title: string;
    description: string | null;
    priority: string;
    assignee_id: string | null;
    due_date: string | null;
    estimated_hours: number | null;
    status: string;
  }>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: task, error } = await supabase.from("tasks").update(patch).eq("id", taskId).select("title").single();
  if (error) throw error;

  if (user && task) {
    if ("assignee_id" in patch) {
      await logActivity(supabase, user.id, "trocou o responsável de", task.title, taskId);
    }
    if ("due_date" in patch) {
      await logActivity(supabase, user.id, "mudou o prazo de", task.title, taskId);
    }
    if (patch.status === "done") {
      await logActivity(supabase, user.id, "concluiu", task.title, taskId);
    }
  }

  revalidatePath("/kanban");
  revalidatePath("/inicio");
}

export async function deleteTask(taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
  revalidatePath("/kanban");
  revalidatePath("/inicio");
}

export async function addChecklistItem(taskId: string, title: string) {
  const supabase = await createClient();
  const { data: maxPos } = await supabase
    .from("task_checklist_items")
    .select("position")
    .eq("task_id", taskId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("task_checklist_items").insert({
    task_id: taskId,
    title,
    position: (maxPos?.position ?? 0) + 1,
  });
  if (error) throw error;
  revalidatePath("/kanban");
}

export async function toggleChecklistItem(itemId: string, done: boolean) {
  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from("task_checklist_items")
    .update({ done })
    .eq("id", itemId)
    .select("title, task_id")
    .single();
  if (error) throw error;

  if (done && item) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await logActivity(supabase, user?.id ?? null, "concluiu a subtarefa", item.title, item.task_id);
  }

  revalidatePath("/kanban");
}

export async function deleteChecklistItem(itemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("task_checklist_items").delete().eq("id", itemId);
  if (error) throw error;
  revalidatePath("/kanban");
}

export async function addComment(taskId: string, body: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase.from("task_comments").insert({
    task_id: taskId,
    author_id: user.id,
    body,
  });
  if (error) throw error;
  revalidatePath("/kanban");
}

export async function addAttachment(taskId: string, filename: string, url: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.from("task_attachments").insert({ task_id: taskId, filename, url });
  if (error) throw error;
  revalidatePath("/kanban");
}

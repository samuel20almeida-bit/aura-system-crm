"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";
import { nextTaskCode } from "@/lib/data/tasks";
import { normalizeLinkUrl } from "@/lib/links";

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
  revalidatePath("/hoje");
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
  revalidatePath("/hoje");
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
  revalidatePath("/hoje");
}

export async function deleteTask(taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
  revalidatePath("/kanban");
  revalidatePath("/hoje");
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

export async function addLinkAttachment(taskId: string, filename: string, url: string) {
  const supabase = await createClient();
  // A tela também normaliza, mas Server Action é endpoint HTTP: o que fica
  // gravado é o que o servidor validou. Ver src/lib/links.ts.
  const normalized = normalizeLinkUrl(url);
  if (!normalized.ok) throw new Error(normalized.message);

  const { error } = await supabase
    .from("task_attachments")
    .insert({ task_id: taskId, filename, url: normalized.url, storage_path: null });
  if (error) throw error;
  revalidatePath("/kanban");
}

export async function addFileAttachment(taskId: string, filename: string, storagePath: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_attachments")
    .insert({ task_id: taskId, filename, url: null, storage_path: storagePath });
  if (error) throw error;
  revalidatePath("/kanban");
}

export async function removeAttachment(attachmentId: string) {
  const supabase = await createClient();

  // O caminho no storage vem do banco, nunca do cliente: Server Action é
  // endpoint HTTP, e um par (id, caminho) dessincronizado apagaria o arquivo
  // de outro anexo.
  const { data: row, error: readError } = await supabase
    .from("task_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .maybeSingle();
  if (readError) throw readError;
  if (!row) {
    // A escrita é no-op, mas a TELA não é: quem clicou ✕ está vendo um anexo
    // que já sumiu do banco (outra aba removeu primeiro). Sem revalidar, o
    // item fica na lista e o ✕ parece simplesmente não fazer nada — era o
    // `router.refresh()` removido na Task 2 da 5F que cobria este caminho.
    revalidatePath("/kanban");
    return;
  }

  // A linha primeiro, o objeto depois. Na ordem inversa, um delete que falhasse
  // depois de um remove() bem-sucedido deixaria a linha apontando para um
  // objeto morto: o anexo continuaria na lista, clicável, com url nula e
  // href="#" — some ao clicar, some do bucket, e mesmo assim aparece.
  const { error } = await supabase.from("task_attachments").delete().eq("id", attachmentId);
  if (error) throw error;

  if (row.storage_path) {
    const { error: storageError } = await supabase.storage.from("task-attachments").remove([row.storage_path]);
    // Aqui não dá para lançar: a linha já foi apagada e o anexo REALMENTE saiu
    // da lista. Um erro na tela diria que a remoção falhou quando ela deu
    // certo. O que sobra é um objeto órfão invisível, registrado no console
    // para quem for limpar o bucket.
    if (storageError) {
      console.error("[anexos] objeto órfão no bucket:", row.storage_path, storageError);
    }
  }

  revalidatePath("/kanban");
}

export async function createTaskArea(nome: string) {
  const supabase = await createClient();
  const nomeAparado = nome.trim();

  // Reaproveita uma área já existente com o mesmo nome (ignorando
  // maiúsculas/minúsculas e espaço nas pontas) em vez de duplicar —
  // "Financeiro" e "financeiro " não podem virar duas linhas.
  const { data: existente } = await supabase
    .from("task_areas")
    .select("id, nome")
    .ilike("nome", nomeAparado)
    .maybeSingle();
  if (existente) return existente;

  const { data: maxPos } = await supabase
    .from("task_areas")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("task_areas")
    .insert({ nome: nomeAparado, position: (maxPos?.position ?? 0) + 1 })
    .select("id, nome")
    .single();
  if (error) throw error;

  revalidatePath("/kanban");
  return data;
}

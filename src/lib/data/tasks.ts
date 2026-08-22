import { createClient } from "@/lib/supabase/server";
import { buildSequentialCodes, highestCodeNumber } from "@/lib/task-codes";

export async function listTasks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "*, client:clients(id, name, color, code_prefix), assignee:profiles!tasks_assignee_id_fkey(id, full_name, initials)"
    )
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export type TaskWithRelations = Awaited<ReturnType<typeof listTasks>>[number];

export async function listClientsLite() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name, color, code_prefix")
    .eq("status", "active")
    .order("name");
  return data ?? [];
}

export async function listTaskAreas() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_areas")
    .select("id, nome")
    .order("position");
  return data ?? [];
}

export async function getTaskHistory(taskId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_log")
    .select("*, user:profiles(id, full_name, initials)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function getTaskDetail(id: string) {
  const supabase = await createClient();
  const [
    { data: task },
    { data: checklist },
    { data: comments },
    { data: attachments },
    history,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "*, client:clients(id, name, color, code_prefix), assignee:profiles!tasks_assignee_id_fkey(id, full_name, initials)"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("task_checklist_items")
      .select("*, assignee:profiles(id, full_name, initials)")
      .eq("task_id", id)
      .order("position"),
    supabase
      .from("task_comments")
      .select("*, author:profiles(id, full_name, initials)")
      .eq("task_id", id)
      .order("created_at"),
    supabase.from("task_attachments").select("*").eq("task_id", id).order("created_at"),
    getTaskHistory(id),
  ]);

  const attachmentRows = attachments ?? [];
  const storagePaths = attachmentRows
    .map((a) => a.storage_path)
    .filter((p): p is string => Boolean(p));

  const signedByPath = new Map<string, string>();
  if (storagePaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("task-attachments")
      .createSignedUrls(storagePaths, 60 * 60);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
    }
  }

  const resolvedAttachments = attachmentRows.map((a) =>
    a.storage_path ? { ...a, url: signedByPath.get(a.storage_path) ?? null } : a
  );

  return {
    task,
    checklist: checklist ?? [],
    comments: comments ?? [],
    attachments: resolvedAttachments,
    history,
  };
}

async function resolveTaskCodePrefix(supabase: Awaited<ReturnType<typeof createClient>>, clientId: string | null, isInternal: boolean) {
  if (isInternal || !clientId) return "INT";
  const { data: client } = await supabase.from("clients").select("code_prefix").eq("id", clientId).single();
  return client?.code_prefix ?? "INT";
}

async function highestTaskCodeNumber(supabase: Awaited<ReturnType<typeof createClient>>, prefix: string) {
  const { data } = await supabase
    .from("tasks")
    .select("code")
    .ilike("code", `${prefix}-%`)
    .order("code", { ascending: false });
  return highestCodeNumber((data ?? []).map((row) => row.code));
}

export async function nextTaskCode(clientId: string | null, isInternal: boolean) {
  const supabase = await createClient();
  const prefix = await resolveTaskCodePrefix(supabase, clientId, isInternal);
  return buildSequentialCodes(prefix, (await highestTaskCodeNumber(supabase, prefix)) + 1, 1)[0];
}

/** Generates `count` sequential task codes for the same prefix in one shot (e.g. for a playbook run). */
export async function nextTaskCodes(clientId: string | null, isInternal: boolean, count: number) {
  const supabase = await createClient();
  const prefix = await resolveTaskCodePrefix(supabase, clientId, isInternal);
  return buildSequentialCodes(prefix, (await highestTaskCodeNumber(supabase, prefix)) + 1, count);
}

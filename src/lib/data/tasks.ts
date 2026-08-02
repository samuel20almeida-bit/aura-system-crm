import { createClient } from "@/lib/supabase/server";

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

export async function getTaskDetail(id: string) {
  const supabase = await createClient();
  const [{ data: task }, { data: checklist }, { data: comments }, { data: attachments }, { data: timeSpent }] =
    await Promise.all([
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
      supabase.from("time_entries").select("minutes").eq("task_id", id).not("minutes", "is", null),
    ]);

  const totalMinutes = (timeSpent ?? []).reduce((sum, t) => sum + (t.minutes ?? 0), 0);

  return { task, checklist: checklist ?? [], comments: comments ?? [], attachments: attachments ?? [], totalMinutes };
}

export async function nextTaskCode(clientId: string | null, isInternal: boolean) {
  const supabase = await createClient();
  let prefix = "INT";
  if (!isInternal && clientId) {
    const { data: client } = await supabase.from("clients").select("code_prefix").eq("id", clientId).single();
    if (client) prefix = client.code_prefix;
  }
  const { data } = await supabase
    .from("tasks")
    .select("code")
    .ilike("code", `${prefix}-%`)
    .order("code", { ascending: false });

  let max = 0;
  for (const row of data ?? []) {
    const n = parseInt(row.code.split("-")[1] ?? "0", 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return `${prefix}-${String(max + 1).padStart(2, "0")}`;
}

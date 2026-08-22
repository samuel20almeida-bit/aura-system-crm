import { PageBody } from "@/components/layout/PageBody";
import { KanbanClient } from "@/components/kanban/KanbanClient";
import { TaskDetailPanel } from "@/components/kanban/TaskDetailPanel";
import { listClientsLite, listTasks, getTaskDetail, listTaskAreas } from "@/lib/data/tasks";
import { listProfiles } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string }>;
}) {
  const { task: taskId } = await searchParams;
  const supabase = await createClient();

  const [tasks, clients, profiles, areas, { data: checklistRows }] = await Promise.all([
    listTasks(),
    listClientsLite(),
    listProfiles(),
    listTaskAreas(),
    supabase.from("task_checklist_items").select("task_id, done"),
  ]);

  const checklistCounts: Record<string, { done: number; total: number }> = {};
  for (const row of checklistRows ?? []) {
    const c = (checklistCounts[row.task_id] ??= { done: 0, total: 0 });
    c.total += 1;
    if (row.done) c.done += 1;
  }

  const detail = taskId ? await getTaskDetail(taskId) : null;

  return (
    <PageBody>
      <KanbanClient
        tasks={tasks}
        clients={clients}
        profiles={profiles}
        areas={areas}
        checklistCounts={checklistCounts}
      />
      {detail?.task && <TaskDetailPanel detail={detail} profiles={profiles} />}
    </PageBody>
  );
}

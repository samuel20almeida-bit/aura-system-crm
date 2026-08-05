import { PageBody } from "@/components/layout/PageBody";
import { KanbanClient } from "@/components/kanban/KanbanClient";
import { TaskDetailPanel } from "@/components/kanban/TaskDetailPanel";
import { listClientsLite, listTasks, getTaskDetail } from "@/lib/data/tasks";
import { listProfiles, requireProfile } from "@/lib/data/profile";
import { getRunningTimer } from "@/lib/data/time";
import { createClient } from "@/lib/supabase/server";

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string }>;
}) {
  const { task: taskId } = await searchParams;
  const supabase = await createClient();
  const { profile } = await requireProfile();

  const [tasks, clients, profiles, { data: checklistRows }, runningTimer] = await Promise.all([
    listTasks(),
    listClientsLite(),
    listProfiles(),
    supabase.from("task_checklist_items").select("task_id, done"),
    getRunningTimer(profile.id),
  ]);

  const checklistCounts: Record<string, { done: number; total: number }> = {};
  for (const row of checklistRows ?? []) {
    const c = (checklistCounts[row.task_id] ??= { done: 0, total: 0 });
    c.total += 1;
    if (row.done) c.done += 1;
  }

  const runningTaskId = runningTimer?.task_id ?? null;

  const detail = taskId ? await getTaskDetail(taskId) : null;

  return (
    <PageBody>
      <KanbanClient
        tasks={tasks}
        clients={clients}
        profiles={profiles}
        checklistCounts={checklistCounts}
        runningTaskId={runningTaskId}
      />
      {detail?.task && <TaskDetailPanel detail={detail} profiles={profiles} />}
    </PageBody>
  );
}

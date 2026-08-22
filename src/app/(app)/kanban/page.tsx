import { PageBody } from "@/components/layout/PageBody";
import { KanbanClient } from "@/components/kanban/KanbanClient";
import { TaskDetailPanel } from "@/components/kanban/TaskDetailPanel";
import { listContasLite, listTasks, getTaskDetail, listTaskAreas } from "@/lib/data/tasks";
import { listProfiles } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string }>;
}) {
  const { task: taskId } = await searchParams;
  const supabase = await createClient();

  const [tasks, contasResult, profiles, areas, { data: checklistRows }] = await Promise.all([
    listTasks(),
    listContasLite(),
    listProfiles(),
    listTaskAreas(),
    supabase.from("task_checklist_items").select("task_id, done"),
  ]);

  // `contasResult.ok === false` é a leitura de contas ter falhado, não "zero
  // contas". O Kanban não pode cair inteiro por isso — a tarefa interna não
  // depende de conta — então aqui vira lista vazia + uma flag para o
  // seletor mostrar o estado de indisponível em vez de mentir "sem contas".
  const contas = contasResult.ok ? contasResult.contas : [];
  const contasIndisponiveis = !contasResult.ok;

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
        contas={contas}
        contasIndisponiveis={contasIndisponiveis}
        profiles={profiles}
        areas={areas}
        checklistCounts={checklistCounts}
      />
      {detail?.task && <TaskDetailPanel detail={detail} profiles={profiles} />}
    </PageBody>
  );
}

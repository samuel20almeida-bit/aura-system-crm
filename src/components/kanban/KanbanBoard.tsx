"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { TaskCard } from "./TaskCard";
import { updateTaskPosition } from "@/lib/actions/tasks";
import type { TaskWithRelations } from "@/lib/data/tasks";
import { moveItem, reorderWithin, findColumnIn, type Columns, type ColumnId as OptimisticColumnId } from "@/lib/optimistic";
import { useToast } from "@/components/ui/Toast";

const COLUMNS = [
  { id: "todo", label: "A FAZER" },
  { id: "in_progress", label: "EM ANDAMENTO" },
  { id: "done", label: "FINALIZADAS" },
] as const satisfies { id: OptimisticColumnId; label: string }[];

type ColumnId = OptimisticColumnId;
type ColumnsState = Columns<TaskWithRelations>;

function groupTasks(tasks: TaskWithRelations[]): ColumnsState {
  return {
    todo: tasks.filter((t) => t.status === "todo"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    done: tasks.filter((t) => t.status === "done"),
  };
}

function checklistSummaryFor(taskId: string, checklistCounts: Record<string, { done: number; total: number }>) {
  return checklistCounts[taskId] ?? null;
}

function Column({
  id,
  label,
  tasks,
  checklistCounts,
  onOpen,
  runningTaskId,
}: {
  id: ColumnId;
  label: string;
  tasks: TaskWithRelations[];
  checklistCounts: Record<string, { done: number; total: number }>;
  onOpen: (id: string) => void;
  runningTaskId?: string | null;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="col flex min-h-[120px] w-full flex-1 flex-col gap-2.25 rounded-xl border border-neutral-tint-border bg-neutral-tint p-2.75">
      <div className="flex items-center gap-2 px-0.5">
        <span className="label">{label}</span>
        <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              checklistSummary={checklistSummaryFor(task.id, checklistCounts)}
              onOpen={() => onOpen(task.id)}
              isRunning={task.id === runningTaskId}
            />
          ))}
          {tasks.length === 0 && (
            <div className="rounded-[10px] border border-dashed border-[#CFCABD] p-3.5 text-center text-xs text-faint">
              Solte aqui
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function KanbanBoard({
  tasks,
  checklistCounts,
  onOpenTask,
  runningTaskId,
}: {
  tasks: TaskWithRelations[];
  checklistCounts: Record<string, { done: number; total: number }>;
  onOpenTask: (id: string) => void;
  runningTaskId?: string | null;
}) {
  const [prevTasks, setPrevTasks] = useState(tasks);
  const [columns, setColumns] = useState<ColumnsState>(() => groupTasks(tasks));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragStartColumns, setDragStartColumns] = useState<ColumnsState | null>(null);
  const router = useRouter();
  const { notify } = useToast();

  if (tasks !== prevTasks) {
    setPrevTasks(tasks);
    setColumns(groupTasks(tasks));
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    for (const col of COLUMNS) {
      const found = columns[col.id].find((t) => t.id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, columns]);

  function findColumnOf(id: string): ColumnId | null {
    for (const col of COLUMNS) {
      if (columns[col.id].some((t) => t.id === id)) return col.id;
    }
    if ((COLUMNS as readonly { id: string }[]).some((c) => c.id === id)) return id as ColumnId;
    return null;
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setDragStartColumns(columns);
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeCol = findColumnOf(String(active.id));
    const overCol = findColumnOf(String(over.id));
    if (!activeCol || !overCol || activeCol === overCol) return;

    setColumns((prev) => moveItem(prev, String(active.id), overCol, String(over.id)));
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    const startColumns = dragStartColumns;
    setActiveId(null);
    setDragStartColumns(null);

    if (!over) {
      // Solto fora de qualquer coluna: desfaz o que handleDragOver já aplicou.
      if (startColumns) setColumns(startColumns);
      return;
    }

    const overCol = findColumnOf(String(over.id));
    if (!overCol) return;

    // A coluna de origem vem do estado do início do arraste, não do atual:
    // handleDragOver já pode ter movido o card, e ler o estado corrente faria
    // reorderWithin rodar uma segunda vez sobre o mesmo par, invertendo a posição.
    const originCol = startColumns ? findColumnIn(startColumns, String(active.id)) : null;

    let finalColumns = columns;
    if (originCol === overCol && active.id !== over.id) {
      finalColumns = { ...columns, [overCol]: reorderWithin(columns[overCol], String(active.id), String(over.id)) };
      setColumns(finalColumns);
    }

    const orderedIds = finalColumns[overCol].map((t) => t.id);
    updateTaskPosition({ taskId: String(active.id), status: overCol, orderedIdsInColumn: orderedIds }).catch(() => {
      if (startColumns) setColumns(startColumns);
      notify("error", "Não foi possível mover a tarefa. Ela voltou para a posição anterior.");
      router.refresh();
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid flex-1 grid-cols-3 gap-3.5 overflow-hidden">
        {COLUMNS.map((col) => (
          <div key={col.id} className="flex min-h-0 flex-col overflow-y-auto scrollbar-thin">
            <Column
              id={col.id}
              label={col.label}
              tasks={columns[col.id]}
              checklistCounts={checklistCounts}
              onOpen={onOpenTask}
              runningTaskId={runningTaskId}
            />
          </div>
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <TaskCard
            task={activeTask}
            checklistSummary={checklistSummaryFor(activeTask.id, checklistCounts)}
            onOpen={() => {}}
            isRunning={activeTask.id === runningTaskId}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

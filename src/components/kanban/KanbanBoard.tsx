"use client";

import { useEffect, useMemo, useState } from "react";
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

const COLUMNS = [
  { id: "todo", label: "A FAZER" },
  { id: "in_progress", label: "EM ANDAMENTO" },
  { id: "done", label: "FINALIZADAS" },
] as const;

type ColumnId = (typeof COLUMNS)[number]["id"];
type ColumnsState = Record<ColumnId, TaskWithRelations[]>;

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
}: {
  id: ColumnId;
  label: string;
  tasks: TaskWithRelations[];
  checklistCounts: Record<string, { done: number; total: number }>;
  onOpen: (id: string) => void;
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
}: {
  tasks: TaskWithRelations[];
  checklistCounts: Record<string, { done: number; total: number }>;
  onOpenTask: (id: string) => void;
}) {
  const [prevTasks, setPrevTasks] = useState(tasks);
  const [columns, setColumns] = useState<ColumnsState>(() => groupTasks(tasks));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const [dragStartColumns, setDragStartColumns] = useState<ColumnsState | null>(null);
  const router = useRouter();

  if (tasks !== prevTasks) {
    setPrevTasks(tasks);
    setColumns(groupTasks(tasks));
  }

  useEffect(() => {
    if (!dragError) return;
    const timeout = setTimeout(() => setDragError(null), 4000);
    return () => clearTimeout(timeout);
  }, [dragError]);

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
    setDragError(null);
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeCol = findColumnOf(String(active.id));
    const overCol = findColumnOf(String(over.id));
    if (!activeCol || !overCol || activeCol === overCol) return;

    setColumns((prev) => {
      const activeItems = prev[activeCol];
      const activeIndex = activeItems.findIndex((t) => t.id === active.id);
      if (activeIndex === -1) return prev;
      const [moved] = activeItems.slice(activeIndex, activeIndex + 1);
      const newActiveItems = activeItems.filter((t) => t.id !== active.id);
      const overItems = prev[overCol];
      const overIndex = overItems.findIndex((t) => t.id === over.id);
      const insertAt = overIndex === -1 ? overItems.length : overIndex;
      const newOverItems = [...overItems.slice(0, insertAt), moved, ...overItems.slice(insertAt)];
      return { ...prev, [activeCol]: newActiveItems, [overCol]: newOverItems };
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const activeCol = findColumnOf(String(active.id));
    const overCol = findColumnOf(String(over.id));
    if (!activeCol || !overCol) return;

    let finalColumns = columns;
    if (activeCol === overCol && active.id !== over.id) {
      const items = columns[activeCol];
      const oldIndex = items.findIndex((t) => t.id === active.id);
      const newIndex = items.findIndex((t) => t.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = [...items];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);
        finalColumns = { ...columns, [activeCol]: reordered };
        setColumns(finalColumns);
      }
    }

    const destCol = overCol;
    const orderedIds = finalColumns[destCol].map((t) => t.id);
    const revertTo = dragStartColumns;
    updateTaskPosition({ taskId: String(active.id), status: destCol, orderedIdsInColumn: orderedIds }).catch(() => {
      if (revertTo) setColumns(revertTo);
      setDragError("Não foi possível mover a tarefa. Tente novamente.");
      router.refresh();
    });
  }

  return (
    <>
      {dragError && (
        <div
          role="alert"
          className="fixed right-5 top-16 z-50 rounded-lg border border-red-tint-border bg-red-tint px-3.5 py-2.5 text-[13px] text-red shadow-lg"
        >
          {dragError}
        </div>
      )}
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
            />
          </div>
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} checklistSummary={checklistSummaryFor(activeTask.id, checklistCounts)} onOpen={() => {}} />
        ) : null}
      </DragOverlay>
    </DndContext>
    </>
  );
}

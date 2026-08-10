"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
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
import { beginInteraction, beginMutation } from "@/lib/realtime/mutation-gate";
import type { TaskWithRelations } from "@/lib/data/tasks";
import { moveItem, reorderWithin, findColumnIn, type Columns, type ColumnId as OptimisticColumnId } from "@/lib/optimistic";
import { useToast } from "@/components/ui/Toast";
import { useMediaQuery } from "@/lib/use-media-query";

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
  dragDisabled,
}: {
  id: ColumnId;
  label: string;
  tasks: TaskWithRelations[];
  checklistCounts: Record<string, { done: number; total: number }>;
  onOpen: (id: string) => void;
  runningTaskId?: string | null;
  dragDisabled?: boolean;
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
              dragDisabled={dragDisabled}
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
  mobileColumn,
}: {
  tasks: TaskWithRelations[];
  checklistCounts: Record<string, { done: number; total: number }>;
  onOpenTask: (id: string) => void;
  runningTaskId?: string | null;
  mobileColumn: ColumnId;
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

  // A lista de sensores NUNCA muda de tamanho entre renderizações — o
  // useSensors do dnd-kit usa os sensores como array de dependências de um
  // useMemo (node_modules/@dnd-kit/core/dist/core.cjs.development.js:205-212).
  // Trocar a lista condicionalmente por isMobile quebraria o Kanban em todo
  // celular assim que a hidratação corrigisse o valor do servidor. Quem é
  // desabilitado no celular é o item arrastável (useSortable/disabled),
  // propagado abaixo por dragDisabled — não os sensores.
  const isMobile = useMediaQuery("(max-width: 767px)");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Segura a atualização por tempo real enquanto o card está na mão. É setado no
  // manipulador de evento, não em render: um efeito que sincronizasse um estado
  // rodaria como macrotask e poderia perder a corrida para o timer do debounce
  // já vencido — e aí o `columns` seria reconstruído com o card no ar.
  const endInteraction = useRef<(() => void) | null>(null);

  function releaseInteraction() {
    endInteraction.current?.();
    endInteraction.current = null;
  }

  // Desmontar no meio de um arraste (navegar com o card na mão) não dispara nem
  // dragEnd nem dragCancel. Sem isto, o contador ficaria preso e o tempo real de
  // todas as telas passaria a depender do cão de guarda para se recuperar.
  useEffect(() => {
    return () => {
      endInteraction.current?.();
      endInteraction.current = null;
    };
  }, []);

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
    releaseInteraction();
    endInteraction.current = beginInteraction();
    setActiveId(String(e.active.id));
    setDragStartColumns(columns);
  }

  // O dnd-kit dispara dragCancel — e NÃO dragEnd — quando o arraste é abortado
  // (Escape, por exemplo): core.cjs.development.js escolhe o nome do evento por
  // `type === Action.DragEnd ? 'onDragEnd' : 'onDragCancel'`. Sem tratar isto, o
  // contador ficaria preso e o card continuaria pendurado no DragOverlay.
  function handleDragCancel() {
    releaseInteraction();
    const startColumns = dragStartColumns;
    setActiveId(null);
    setDragStartColumns(null);
    if (startColumns) setColumns(startColumns);
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
    // O try/finally existe só para o contador de interação: qualquer saída
    // antecipada abaixo precisa devolvê-lo, senão o tempo real de todas as telas
    // fica represado. A escrita já começou quando o finally roda, então não há
    // brecha entre um portão e o outro.
    try {
      handleDragEndInner(e);
    } finally {
      releaseInteraction();
    }
  }

  function handleDragEndInner(e: DragEndEvent) {
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
    // O portão segura a atualização por tempo real até a escrita terminar: sem
    // ele, o eco do próprio arraste chegaria por cima do otimismo e devolveria
    // o card. Não dá para usar try/finally aqui porque a promessa não é
    // aguardada — quem fecha o portão é o .finally() dela.
    const end = beginMutation();
    updateTaskPosition({ taskId: String(active.id), status: overCol, orderedIdsInColumn: orderedIds })
      .catch(() => {
        if (startColumns) setColumns(startColumns);
        notify("error", "Não foi possível mover a tarefa. Ela voltou para a posição anterior.");
        router.refresh();
      })
      .finally(end);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid flex-1 grid-cols-1 gap-3.5 overflow-hidden md:grid-cols-3">
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            className={clsx(
              "min-h-0 flex-col overflow-y-auto scrollbar-thin md:flex",
              col.id === mobileColumn ? "flex" : "hidden"
            )}
          >
            <Column
              id={col.id}
              label={col.label}
              tasks={columns[col.id]}
              checklistCounts={checklistCounts}
              onOpen={onOpenTask}
              runningTaskId={runningTaskId}
              dragDisabled={isMobile}
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

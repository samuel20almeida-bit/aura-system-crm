"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { Tag } from "@/components/ui/Tag";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/Card";
import { formatDate } from "@/lib/format";
import { todayInAppTz } from "@/lib/timezone";
import type { TaskWithRelations } from "@/lib/data/tasks";

const priorityTone: Record<string, "red" | "neutral"> = {
  high: "red",
  medium: "neutral",
  low: "neutral",
};
const priorityLabel: Record<string, string> = { high: "Alta", medium: "Média", low: "Baixa" };

export function TaskCard({
  task,
  checklistSummary,
  onOpen,
  dragDisabled,
}: {
  task: TaskWithRelations;
  checklistSummary?: { done: number; total: number } | null;
  onOpen: () => void;
  dragDisabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isDone = task.status === "done";
  // Mesma comparação que o sino faz: "hoje" é o dia em São Paulo, não o dia
  // local da máquina de quem abre o Kanban.
  const overdue = task.due_date && task.due_date < todayInAppTz() && !isDone;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={clsx(
        // O terceiro e último cartão de arraste a largar raio e sombra escritos
        // à mão. Pipeline (#12) e Implantação (#13) já usam os tokens.
        "flex cursor-pointer flex-col gap-2 rounded-card border border-border bg-surface p-3 shadow-raised transition-shadow duration-fast hover:shadow-layer",
        isDragging && "opacity-40 shadow-overlay",
        isDone && "opacity-70"
      )}
    >
      <div className="flex items-center justify-between">
        <Tag tone={priorityTone[task.priority]} dot>
          {priorityLabel[task.priority]}
        </Tag>
        <span className="font-mono text-label text-faint">{task.code}</span>
      </div>
      {/* Mesma correção do NegocioCard e do ImplantacaoCard: código 11,
         título 13, conta 11,5, área 11,5, checklist 11, prazo 11 — tudo
         dentro de 2px, então nada saltava. O título é o que se procura ao
         varrer o quadro. */}
      <div className={clsx("text-title font-medium", isDone && "line-through")}>{task.title}</div>
      {/* Sem quadradinho: `contas` não tem cor, e inventar uma por conta seria
          decoração sem fonte de verdade — o nome já é a informação que o
          quadradinho tentava resumir. */}
      {task.conta && (
        <div className="truncate text-small text-muted">{task.conta.nome}</div>
      )}
      {task.is_internal && task.area && (
        <div className="flex items-center gap-1.5 text-small text-muted">
          <span className="h-2 w-2 rounded-sm bg-ink" />
          {task.area}
        </div>
      )}
      {checklistSummary && checklistSummary.total > 0 && (
        <div className="flex items-center gap-2">
          <ProgressBar percent={(checklistSummary.done / checklistSummary.total) * 100} className="flex-1" />
          <span className="font-mono text-label tabular-nums text-muted">
            {checklistSummary.done}/{checklistSummary.total}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-border-soft pt-2">
        <Avatar initials={task.assignee?.initials} size="sm" ghost={!task.assignee} />
        {task.due_date ? (
          <span className={clsx("font-mono text-label tabular-nums", overdue ? "text-red" : "text-muted")}>
            {formatDate(task.due_date)}
          </span>
        ) : (
          <span className="font-mono text-label text-faint">sem prazo</span>
        )}
      </div>
    </div>
  );
}

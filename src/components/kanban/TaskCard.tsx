"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { Tag } from "@/components/ui/Tag";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/Card";
import { formatDate } from "@/lib/format";
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
  isRunning,
}: {
  task: TaskWithRelations;
  checklistSummary?: { done: number; total: number } | null;
  onOpen: () => void;
  isRunning?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isDone = task.status === "done";
  const overdue = task.due_date && new Date(task.due_date) < new Date(new Date().toDateString()) && !isDone;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={clsx(
        "flex cursor-pointer flex-col gap-2 rounded-[10px] border border-border bg-surface p-2.75 shadow-[0_1px_2px_rgba(30,30,28,.05)] transition-shadow duration-150 hover:shadow-[0_2px_8px_rgba(30,30,28,.10)]",
        isDragging && "opacity-40 shadow-[0_8px_24px_rgba(30,30,28,.18)]",
        isDone && "opacity-70"
      )}
    >
      <div className="flex items-center justify-between">
        <Tag tone={priorityTone[task.priority]} dot>
          {priorityLabel[task.priority]}
        </Tag>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
          {task.code}
          {isRunning && (
            <span className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-pulse-soft" title="Timer rodando" />
          )}
        </span>
      </div>
      <div className={clsx("text-[13px] font-medium", isDone && "line-through")}>{task.title}</div>
      {task.client && (
        <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
          <span className="h-2 w-2 rounded-sm" style={{ background: task.client.color }} />
          {task.client.name}
        </div>
      )}
      {task.is_internal && task.area && (
        <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
          <span className="h-2 w-2 rounded-sm bg-ink" />
          {task.area}
        </div>
      )}
      {checklistSummary && checklistSummary.total > 0 && (
        <div className="flex items-center gap-2">
          <ProgressBar percent={(checklistSummary.done / checklistSummary.total) * 100} className="flex-1" />
          <span className="font-mono text-[11px] text-muted">
            {checklistSummary.done}/{checklistSummary.total}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-border-soft pt-2">
        <Avatar initials={task.assignee?.initials} size="sm" ghost={!task.assignee} />
        {task.due_date ? (
          <span className={clsx("font-mono text-[11px]", overdue ? "text-red" : "text-muted")}>
            {formatDate(task.due_date)}
          </span>
        ) : (
          <span className="font-mono text-[11px] text-faint">sem prazo</span>
        )}
      </div>
    </div>
  );
}

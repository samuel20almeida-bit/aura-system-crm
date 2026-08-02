"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { Tag } from "@/components/ui/Tag";
import { formatDate } from "@/lib/format";
import { updateTask } from "@/lib/actions/tasks";

export function TaskQuickItem({
  task,
}: {
  task: { id: string; title: string; due_date: string | null; client: { name: string } | null };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const overdue = task.due_date && task.due_date < new Date().toISOString().slice(0, 10);

  return (
    <div className="grid grid-cols-[20px_1fr_96px] items-center gap-2 border-b border-border-soft py-2.5 text-[13px] last:border-b-0">
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await updateTask(task.id, { status: "done" });
            router.refresh();
          })
        }
        className="h-3.5 w-3.5 flex-none rounded [border:1.5px_solid_#C7C3B8] hover:border-accent"
      />
      <Link href={`/kanban?task=${task.id}`} className="truncate hover:text-accent">
        {task.title}
        <span className="ml-2 text-muted">{task.client?.name ?? "Interno"}</span>
      </Link>
      {task.due_date ? (
        <Tag tone={overdue ? "red" : "neutral"} dot>{formatDate(task.due_date)}</Tag>
      ) : (
        <span className="font-mono text-[11px] text-faint">sem prazo</span>
      )}
    </div>
  );
}

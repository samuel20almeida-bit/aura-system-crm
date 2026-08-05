"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KanbanBoard } from "./KanbanBoard";
import { NewTaskModal } from "./NewTaskModal";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";
import { formatDate } from "@/lib/format";
import type { TaskWithRelations } from "@/lib/data/tasks";
import type { Tables } from "@/lib/supabase/database.types";

type ClientLite = { id: string; name: string; color: string; code_prefix: string };

const statusLabel: Record<string, string> = { todo: "A fazer", in_progress: "Em andamento", done: "Finalizada" };

export function KanbanClient({
  tasks,
  clients,
  profiles,
  checklistCounts,
  runningTaskId,
}: {
  tasks: TaskWithRelations[];
  clients: ClientLite[];
  profiles: Tables<"profiles">[];
  checklistCounts: Record<string, { done: number; total: number }>;
  runningTaskId?: string | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<"board" | "list">("board");
  const [scope, setScope] = useState<"clientes" | "interno">("clientes");
  const [clientFilter, setClientFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [showNewTask, setShowNewTask] = useState(false);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (scope === "interno" && !t.is_internal) return false;
      if (scope === "clientes" && t.is_internal) return false;
      if (clientFilter && t.client_id !== clientFilter) return false;
      if (assigneeFilter && t.assignee_id !== assigneeFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [tasks, scope, clientFilter, assigneeFilter, priorityFilter]);

  const activeCount = filtered.filter((t) => t.status !== "done").length;
  // eslint-disable-next-line react-hooks/purity -- snapshot "now" once for the due-this-week filter
  const todayMs = useMemo(() => Date.now(), []);
  const dueThisWeek = filtered.filter((t) => {
    if (!t.due_date || t.status === "done") return false;
    const days = (new Date(t.due_date).getTime() - todayMs) / 86400000;
    return days >= 0 && days <= 7;
  }).length;

  function openTask(id: string) {
    router.push(`/kanban?task=${id}`, { scroll: false });
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[21px] font-medium">Kanban</h1>
          <div className="mt-0.5 text-[12.5px] text-muted">
            {activeCount} tarefas ativas · {dueThisWeek} vencendo esta semana
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-border bg-surface text-[12px] font-medium">
            {(["board", "list"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`border-r border-border px-3.25 py-1.75 last:border-r-0 ${
                  view === v ? "bg-ink text-bone" : "text-muted"
                }`}
              >
                {v === "board" ? "Board" : "Lista"}
              </button>
            ))}
          </div>
          <Button onClick={() => setShowNewTask(true)}>+ Nova tarefa</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-full border border-border bg-surface text-xs font-medium">
          {(["clientes", "interno"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-3 py-1.5 ${scope === s ? "bg-ink text-bone" : "text-muted"}`}
            >
              {s === "clientes" ? "Clientes" : "Interno"}
            </button>
          ))}
        </div>
        {scope === "clientes" && (
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted"
          >
            <option value="">Todos os clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted"
        >
          <option value="">Responsável</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted"
        >
          <option value="">Prioridade</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
          <option value="low">Baixa</option>
        </select>
      </div>

      {view === "board" ? (
        <KanbanBoard tasks={filtered} checklistCounts={checklistCounts} onOpenTask={openTask} runningTaskId={runningTaskId} />
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin rounded-xl border border-border bg-surface">
          <div className="grid grid-cols-[1.6fr_1fr_1fr_.8fr_80px] gap-2 border-b border-border px-3 py-2 font-mono text-[9.5px] font-semibold tracking-wide text-faint">
            <div>TAREFA</div>
            <div>CLIENTE</div>
            <div>STATUS</div>
            <div>PRAZO</div>
            <div>RESP.</div>
          </div>
          {filtered.map((t) => (
            <div
              key={t.id}
              onClick={() => openTask(t.id)}
              className="grid cursor-pointer grid-cols-[1.6fr_1fr_1fr_.8fr_80px] items-center gap-2 border-b border-border-soft px-3 py-2.5 text-[13px] hover:bg-neutral-tint"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="font-mono text-[11px] text-faint">{t.code}</span>
                {t.title}
              </div>
              <div className="truncate text-muted">{t.client?.name ?? "Interno"}</div>
              <div>
                <Tag tone={t.status === "done" ? "accent" : "neutral"}>{statusLabel[t.status]}</Tag>
              </div>
              <div className="font-mono text-[11px] text-muted">{t.due_date ? formatDate(t.due_date) : "—"}</div>
              <Avatar initials={t.assignee?.initials} size="sm" ghost={!t.assignee} />
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-[13px] text-faint">Nenhuma tarefa encontrada.</div>
          )}
        </div>
      )}

      {showNewTask && (
        <NewTaskModal clients={clients} profiles={profiles} onClose={() => setShowNewTask(false)} />
      )}
    </>
  );
}

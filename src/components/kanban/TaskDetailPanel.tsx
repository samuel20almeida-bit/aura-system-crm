"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Slideover } from "@/components/ui/Overlay";
import { Attachments } from "@/components/kanban/Attachments";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/Card";
import { formatDate, daysUntil } from "@/lib/format";
// Mesmas linhas de `activity_log` que o painel da /início mostra: mesmo
// formatador, mesmo texto, mesmo fuso.
import { formatActivityWhen } from "@/lib/activity-feed";
import {
  addChecklistItem,
  addComment,
  deleteChecklistItem,
  deleteTask,
  toggleChecklistItem,
  updateTask,
} from "@/lib/actions/tasks";
import { beginMutation } from "@/lib/realtime/mutation-gate";
import type { Tables } from "@/lib/supabase/database.types";
import { useToast } from "@/components/ui/Toast";

type Profile = Tables<"profiles">;

type TaskDetail = {
  task: (Tables<"tasks"> & {
    client: { id: string; name: string; color: string; code_prefix: string } | null;
    assignee: { id: string; full_name: string; initials: string } | null;
  }) | null;
  checklist: (Tables<"task_checklist_items"> & { assignee: { id: string; full_name: string; initials: string } | null })[];
  comments: (Tables<"task_comments"> & { author: { id: string; full_name: string; initials: string } | null })[];
  attachments: Tables<"task_attachments">[];
  history: (Tables<"activity_log"> & { user: { id: string; full_name: string; initials: string } | null })[];
};


export function TaskDetailPanel({ detail, profiles }: { detail: TaskDetail; profiles: Profile[] }) {
  const router = useRouter();
  const { notify } = useToast();
  const [tab, setTab] = useState<"detalhes" | "comentarios" | "historico">("detalhes");
  const [newItem, setNewItem] = useState("");
  const [newComment, setNewComment] = useState("");
  const [pending, startTransition] = useTransition();

  function close() {
    router.push("/kanban");
  }

  const [optimisticChecklist, toggleOptimistic] = useOptimistic(
    detail.checklist,
    (list, { id, done }: { id: string; done: boolean }) =>
      list.map((item) => (item.id === id ? { ...item, done } : item))
  );

  if (!detail.task) return null;
  const t = detail.task;
  const doneCount = optimisticChecklist.filter((i) => i.done).length;
  const overdue = t.due_date && daysUntil(t.due_date) < 0 && t.status !== "done";
  const days = t.due_date ? daysUntil(t.due_date) : null;

  return (
    <Slideover onClose={close}>
      <div className="flex items-center gap-2.5 border-b border-border px-5.5 py-4">
        <span className="font-mono text-xs text-muted">{t.code}</span>
        <select
          value={t.status}
          onChange={(e) =>
            startTransition(async () => {
              const end = beginMutation();
              try {
                await updateTask(t.id, { status: e.target.value });
                router.refresh();
              } finally {
                end();
              }
            })
          }
          className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium"
        >
          <option value="todo">A fazer</option>
          <option value="in_progress">Em andamento</option>
          <option value="done">Finalizada</option>
        </select>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() =>
              startTransition(async () => {
                if (!confirm("Excluir esta tarefa?")) return;
                const end = beginMutation();
                try {
                  await deleteTask(t.id);
                  close();
                } finally {
                  end();
                }
              })
            }
            className="text-[13px] text-muted hover:text-red"
          >
            Excluir
          </button>
          <button onClick={close} className="text-[15px] text-muted hover:text-ink">
            ✕
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 px-5.5 pt-4.5">
        <input
          defaultValue={t.title}
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== t.title) {
              startTransition(async () => {
                const end = beginMutation();
                try {
                  await updateTask(t.id, { title: e.target.value.trim() });
                  router.refresh();
                } finally {
                  end();
                }
              });
            }
          }}
          className="rounded -mx-1 px-1 text-[19px] font-medium outline-none focus:bg-neutral-tint"
        />
        <div className="text-[12.5px] text-muted">
          {t.client ? t.client.name : "Interno"} {t.area ? `· ${t.area}` : ""}
        </div>
      </div>

      <div className="flex gap-4.5 border-b border-border px-5.5 pt-3.5">
        {(["detalhes", "comentarios", "historico"] as const).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={
              "pb-2.25 text-[12.5px] " +
              (tab === tb ? "border-b-2 border-accent font-medium text-accent" : "text-muted")
            }
          >
            {tb === "detalhes" ? "Detalhes" : tb === "comentarios" ? `Comentários · ${detail.comments.length}` : "Histórico"}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto scrollbar-thin px-5.5 py-4">
        {tab === "detalhes" && (
          <>
            <div className="grid grid-cols-[96px_1fr] items-center gap-y-2.5 gap-x-3 text-[13px]">
              <span className="text-muted">Responsável</span>
              <select
                value={t.assignee_id ?? ""}
                onChange={(e) =>
                  startTransition(async () => {
                    const end = beginMutation();
                    try {
                      await updateTask(t.id, { assignee_id: e.target.value || null });
                      router.refresh();
                    } finally {
                      end();
                    }
                  })
                }
                className="rounded-lg border border-border bg-bone px-2 py-1.5 text-[13px]"
              >
                <option value="">Sem responsável</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>

              <span className="text-muted">Prazo</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  defaultValue={t.due_date ?? ""}
                  onChange={(e) =>
                    startTransition(async () => {
                      const end = beginMutation();
                      try {
                        await updateTask(t.id, { due_date: e.target.value || null });
                        router.refresh();
                      } finally {
                        end();
                      }
                    })
                  }
                  className="rounded-lg border border-border bg-bone px-2 py-1.5 text-[13px]"
                />
                {t.due_date && (
                  <Tag tone={overdue ? "red" : "neutral"} dot>
                    {days !== null && days >= 0 ? `em ${days}d` : days !== null ? `${Math.abs(days)}d atrás` : ""}
                  </Tag>
                )}
              </div>

              <span className="text-muted">Prioridade</span>
              <select
                value={t.priority}
                onChange={(e) =>
                  startTransition(async () => {
                    const end = beginMutation();
                    try {
                      await updateTask(t.id, { priority: e.target.value });
                      router.refresh();
                    } finally {
                      end();
                    }
                  })
                }
                className="rounded-lg border border-border bg-bone px-2 py-1.5 text-[13px]"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>

            <div>
              <div className="label mb-1.5">DESCRIÇÃO</div>
              <textarea
                defaultValue={t.description ?? ""}
                placeholder="Sem descrição"
                onBlur={(e) =>
                  startTransition(async () => {
                    const end = beginMutation();
                    try {
                      await updateTask(t.id, { description: e.target.value || null });
                    } finally {
                      end();
                    }
                  })
                }
                rows={3}
                className="w-full resize-none rounded-lg border border-transparent bg-transparent p-1.5 text-[13px] leading-relaxed text-muted outline-none hover:border-border focus:border-accent focus:bg-bone"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="label">SUBTAREFAS</span>
                <span className="font-mono text-[11px] text-muted">
                  {doneCount}/{optimisticChecklist.length}
                </span>
                {optimisticChecklist.length > 0 && (
                  <ProgressBar
                    percent={(doneCount / optimisticChecklist.length) * 100}
                    className="max-w-[110px] flex-1"
                  />
                )}
              </div>
              <div className="flex flex-col gap-2">
                {optimisticChecklist.map((item) => (
                  <div key={item.id} className="group flex items-center gap-2.5 text-[13px]">
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          toggleOptimistic({ id: item.id, done: !item.done });
                          const end = beginMutation();
                          try {
                            await toggleChecklistItem(item.id, !item.done);
                            router.refresh();
                          } catch {
                            notify("error", "Não foi possível atualizar a subtarefa. Tente novamente.");
                          } finally {
                            end();
                          }
                        })
                      }
                      className={
                        "flex h-[15px] w-[15px] flex-none items-center justify-center rounded [border:1.5px_solid_#C7C3B8] text-[9px] " +
                        (item.done ? "border-accent! bg-accent text-bone" : "")
                      }
                    >
                      {item.done && "✓"}
                    </button>
                    <span className={item.done ? "text-faint line-through" : ""}>{item.title}</span>
                    <Avatar initials={item.assignee?.initials} size="sm" ghost className="ml-auto" />
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          const end = beginMutation();
                          try {
                            await deleteChecklistItem(item.id);
                            router.refresh();
                          } catch {
                            notify("error", "Não foi possível remover a subtarefa. Tente novamente.");
                          } finally {
                            end();
                          }
                        })
                      }
                      className="hidden text-faint hover:text-red group-hover:block"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newItem.trim()) return;
                    startTransition(async () => {
                      const end = beginMutation();
                      try {
                        await addChecklistItem(t.id, newItem.trim());
                        setNewItem("");
                        router.refresh();
                      } finally {
                        end();
                      }
                    });
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="+ adicionar subtarefa"
                    className="flex-1 bg-transparent text-[13px] text-muted outline-none placeholder:text-faint"
                  />
                </form>
              </div>
            </div>

            <Attachments taskId={t.id} attachments={detail.attachments} />
          </>
        )}

        {tab === "comentarios" && (
          <div className="flex flex-col gap-3">
            {detail.comments.length === 0 && (
              <p className="text-[12.5px] text-faint">Nenhum comentário ainda.</p>
            )}
            {detail.comments.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <Avatar initials={c.author?.initials} size="sm" ghost />
                <div>
                  <div className="text-[12.5px]">
                    <b className="font-medium">{c.author?.full_name ?? "Alguém"}</b>
                  </div>
                  <div className="text-[12.5px] text-muted">{c.body}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-faint">{formatDate(c.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "historico" && (
          <div className="flex flex-col gap-3">
            {detail.history.length === 0 && (
              <p className="text-[12.5px] text-faint">Nenhum evento registrado ainda.</p>
            )}
            {detail.history.map((event) => (
              <div key={event.id} className="flex gap-2.5">
                <Avatar initials={event.user?.initials} size="sm" ghost />
                <div>
                  <span className="text-[12.5px]">
                    <b className="font-medium">{event.user?.full_name ?? "Alguém"}</b> {event.verb}
                    {event.detail ? ` ${event.detail}` : ""}
                  </span>
                  <div className="mt-0.5 font-mono text-[11px] text-faint">{formatActivityWhen(event.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newComment.trim()) return;
          startTransition(async () => {
            const end = beginMutation();
            try {
              await addComment(t.id, newComment.trim());
              setNewComment("");
              router.refresh();
            } finally {
              end();
            }
          });
        }}
        className="flex items-center gap-2.5 border-t border-border px-5.5 py-3"
      >
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Comentar…"
          className="flex-1 rounded-lg border border-border bg-bone px-2.5 py-2 text-[12.5px] outline-none focus:border-accent"
        />
        <Button type="submit" disabled={pending}>
          Enviar
        </Button>
      </form>
    </Slideover>
  );
}

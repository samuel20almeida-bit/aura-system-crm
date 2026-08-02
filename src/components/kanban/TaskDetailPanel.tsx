"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Slideover } from "@/components/ui/Overlay";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/Card";
import { formatDate, daysUntil } from "@/lib/format";
import {
  addChecklistItem,
  addComment,
  deleteChecklistItem,
  deleteTask,
  toggleChecklistItem,
  updateTask,
} from "@/lib/actions/tasks";
import { startTimer } from "@/lib/actions/time";
import type { Tables } from "@/lib/supabase/database.types";

type Profile = Tables<"profiles">;

type TaskDetail = {
  task: (Tables<"tasks"> & {
    client: { id: string; name: string; color: string; code_prefix: string } | null;
    assignee: { id: string; full_name: string; initials: string } | null;
  }) | null;
  checklist: (Tables<"task_checklist_items"> & { assignee: { id: string; full_name: string; initials: string } | null })[];
  comments: (Tables<"task_comments"> & { author: { id: string; full_name: string; initials: string } | null })[];
  attachments: Tables<"task_attachments">[];
  totalMinutes: number;
};


export function TaskDetailPanel({ detail, profiles }: { detail: TaskDetail; profiles: Profile[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"detalhes" | "comentarios" | "historico">("detalhes");
  const [newItem, setNewItem] = useState("");
  const [newComment, setNewComment] = useState("");
  const [pending, startTransition] = useTransition();

  function close() {
    router.push("/kanban");
  }

  if (!detail.task) return null;
  const t = detail.task;
  const doneCount = detail.checklist.filter((i) => i.done).length;
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
              await updateTask(t.id, { status: e.target.value });
              router.refresh();
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
                if (confirm("Excluir esta tarefa?")) {
                  await deleteTask(t.id);
                  close();
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
                await updateTask(t.id, { title: e.target.value.trim() });
                router.refresh();
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
                    await updateTask(t.id, { assignee_id: e.target.value || null });
                    router.refresh();
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
                      await updateTask(t.id, { due_date: e.target.value || null });
                      router.refresh();
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
                    await updateTask(t.id, { priority: e.target.value });
                    router.refresh();
                  })
                }
                className="rounded-lg border border-border bg-bone px-2 py-1.5 text-[13px]"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>

            <div className="flex items-center gap-3.5 rounded-[10px] border border-border bg-bone p-3">
              <div className="flex-1">
                <div className="label">TEMPO REGISTRADO</div>
                <div className="text-base font-semibold">
                  {(detail.totalMinutes / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h
                  {t.estimated_hours ? (
                    <span className="text-xs font-normal text-muted"> de {t.estimated_hours}h estimadas</span>
                  ) : null}
                </div>
                {t.estimated_hours ? (
                  <ProgressBar percent={(detail.totalMinutes / 60 / t.estimated_hours) * 100} className="mt-1.5" />
                ) : null}
              </div>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await startTimer(t.id, t.client_id);
                    router.push("/horas");
                  })
                }
              >
                ▶ Iniciar
              </Button>
            </div>

            <div>
              <div className="label mb-1.5">DESCRIÇÃO</div>
              <textarea
                defaultValue={t.description ?? ""}
                placeholder="Sem descrição"
                onBlur={(e) =>
                  startTransition(async () => {
                    await updateTask(t.id, { description: e.target.value || null });
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
                  {doneCount}/{detail.checklist.length}
                </span>
                {detail.checklist.length > 0 && (
                  <ProgressBar
                    percent={(doneCount / detail.checklist.length) * 100}
                    className="max-w-[110px] flex-1"
                  />
                )}
              </div>
              <div className="flex flex-col gap-2">
                {detail.checklist.map((item) => (
                  <div key={item.id} className="group flex items-center gap-2.5 text-[13px]">
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          await toggleChecklistItem(item.id, !item.done);
                          router.refresh();
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
                          await deleteChecklistItem(item.id);
                          router.refresh();
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
                      await addChecklistItem(t.id, newItem.trim());
                      setNewItem("");
                      router.refresh();
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

        {tab === "historico" && <p className="text-[12.5px] text-faint">Sem histórico registrado ainda.</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newComment.trim()) return;
          startTransition(async () => {
            await addComment(t.id, newComment.trim());
            setNewComment("");
            router.refresh();
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

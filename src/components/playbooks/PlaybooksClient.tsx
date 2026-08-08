"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { createCategory, createPlaybook, runPlaybook, toggleRunStep } from "@/lib/actions/playbooks";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";

type Category = { id: string; name: string; count: number };
type PlaybookListItem = {
  id: string;
  name: string;
  type: string;
  estimated_days: number | null;
  updated_at: string;
  updated_by_profile: { initials: string } | null;
};
type Step = { id: string; title: string; position: number };
type Run = { id: string; status: string; client: { id: string; name: string } | null; run_steps: { id: string; done: boolean }[] };

const typeLabel: Record<string, string> = { executable: "Executável", document: "Documento", draft: "Rascunho" };
const typeTone: Record<string, "accent" | "neutral"> = { executable: "accent", document: "neutral", draft: "neutral" };

export function PlaybooksBody({
  categories,
  activeCategoryId,
  playbooks,
  activePlaybookId,
  detail,
  clients,
}: {
  categories: Category[];
  activeCategoryId: string | null;
  playbooks: PlaybookListItem[];
  activePlaybookId: string | null;
  detail: { playbook: { id: string; name: string } | null; steps: Step[]; runs: Run[] } | null;
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewPlaybook, setShowNewPlaybook] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const activeCategory = categories.find((c) => c.id === activeCategoryId);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex w-[200px] flex-none flex-col gap-0.5 border-r border-border bg-surface p-3">
        <span className="label px-2 pb-2">CATEGORIAS</span>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/playbooks?category=${c.id}`}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium ${
              c.id === activeCategoryId ? "bg-accent-tint text-accent" : "text-muted hover:bg-neutral-tint"
            }`}
          >
            {c.name}
            <span className="ml-auto font-mono text-[10px] text-faint">{c.count}</span>
          </Link>
        ))}
        <button onClick={() => setShowNewCategory(true)} className="mt-1.5 px-2.5 text-left text-[13px] text-faint hover:text-ink">
          + Nova categoria
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-5.5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[21px] font-medium">{activeCategory?.name ?? "Playbooks"}</h1>
            <div className="mt-0.5 text-[12.5px] text-muted">{playbooks.length} processos</div>
          </div>
          {activeCategoryId && <Button onClick={() => setShowNewPlaybook(true)}>+ Novo playbook</Button>}
        </div>

        <div className="grid flex-1 grid-cols-[1.7fr_1fr] gap-3.5 overflow-hidden">
          <Card className="flex flex-col gap-1 overflow-hidden p-4">
            <div className="grid grid-cols-[1.9fr_.8fr_.9fr_34px] gap-2 border-b border-border pb-2 font-mono text-[9.5px] font-semibold tracking-wide text-faint">
              <div>PROCESSO</div>
              <div>TIPO</div>
              <div>ATUALIZADO</div>
              <div></div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {playbooks.map((p) => (
                <Link
                  key={p.id}
                  href={`/playbooks?category=${activeCategoryId}&playbook=${p.id}`}
                  className={`grid grid-cols-[1.9fr_.8fr_.9fr_34px] items-center gap-2 border-b border-border-soft py-2.5 text-[13px] hover:bg-neutral-tint ${
                    p.id === activePlaybookId ? "bg-neutral-tint" : ""
                  }`}
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    {p.estimated_days ? <div className="font-mono text-[11px] text-muted">~{p.estimated_days} dias</div> : null}
                  </div>
                  <Tag tone={typeTone[p.type]}>{typeLabel[p.type]}</Tag>
                  <div className="font-mono text-[11px] text-muted">{formatDate(p.updated_at)}</div>
                  <Avatar initials={p.updated_by_profile?.initials} size="sm" ghost />
                </Link>
              ))}
              {playbooks.length === 0 && (
                <div className="py-8 text-center text-[13px] text-faint">
                  {activeCategoryId ? "Nenhum playbook nesta categoria ainda." : "Selecione uma categoria."}
                </div>
              )}
            </div>
          </Card>

          <div className="flex min-h-0 flex-col gap-3.5">
            {detail?.playbook ? (
              <>
                <Card className="flex flex-col gap-2.5 p-4">
                  <span className="label">{detail.playbook.name.toUpperCase()}</span>
                  <div className="flex flex-col gap-1.5 text-[12.5px]">
                    {detail.steps.map((s, i) => (
                      <div key={s.id} className="flex gap-2.5">
                        <span className="font-mono text-faint">{String(i + 1).padStart(2, "0")}</span>
                        <span>{s.title}</span>
                      </div>
                    ))}
                    {detail.steps.length === 0 && <span className="text-faint">Nenhuma etapa cadastrada.</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-2 border-t border-border pt-2.5">
                    <Button
                      className="ml-auto"
                      disabled={detail.steps.length === 0}
                      onClick={() => setShowRun(true)}
                    >
                      Criar {detail.steps.length} tarefas
                    </Button>
                  </div>
                </Card>
                <Card className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden p-4">
                  <span className="label">EM EXECUÇÃO</span>
                  <div className="flex-1 overflow-y-auto scrollbar-thin">
                    {detail.runs.map((r) => {
                      const done = r.run_steps.filter((s) => s.done).length;
                      const total = r.run_steps.length;
                      return (
                        <div key={r.id} className="mb-2.5 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-[13px]">
                            <span>{r.client?.name ?? "Interno"}</span>
                            <span className={`font-mono text-[12px] ${done === total && total > 0 ? "text-accent" : "text-muted"}`}>
                              {done}/{total}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded bg-[#EDEAE2]">
                            <div className="h-full rounded bg-accent" style={{ width: total > 0 ? `${(done / total) * 100}%` : "0%" }} />
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {r.run_steps.map((rs, i) => (
                              <button
                                key={rs.id}
                                disabled={pending}
                                onClick={() =>
                                  startTransition(async () => {
                                    try {
                                      await toggleRunStep(rs.id, !rs.done);
                                      router.refresh();
                                    } catch {
                                      notify("error", "Não foi possível atualizar a etapa. Tente novamente.");
                                    }
                                  })
                                }
                                className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${rs.done ? "bg-accent-tint text-accent" : "bg-neutral-tint text-muted"}`}
                                title={detail.steps[i]?.title}
                              >
                                {i + 1}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {detail.runs.length === 0 && <div className="text-[12.5px] text-faint">Nenhuma execução ainda.</div>}
                  </div>
                </Card>
              </>
            ) : (
              <Card className="flex flex-1 items-center justify-center p-4 text-center text-[12.5px] text-faint">
                Selecione um playbook para ver os detalhes.
              </Card>
            )}
          </div>
        </div>
      </div>

      {showNewCategory && (
        <Modal onClose={() => setShowNewCategory(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newCategoryName.trim()) return;
              startTransition(async () => {
                const cat = await createCategory(newCategoryName.trim());
                setNewCategoryName("");
                setShowNewCategory(false);
                router.push(`/playbooks?category=${cat.id}`);
              });
            }}
            className="flex flex-col gap-3.5 p-5.5"
          >
            <h2 className="text-base font-medium">Nova categoria</h2>
            <Field label="NOME">
              <Input autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} required />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowNewCategory(false)}>Cancelar</Button>
              <Button type="submit" disabled={pending}>Criar</Button>
            </div>
          </form>
        </Modal>
      )}

      {showNewPlaybook && activeCategoryId && (
        <NewPlaybookModal categoryId={activeCategoryId} onClose={() => setShowNewPlaybook(false)} />
      )}

      {showRun && detail?.playbook && (
        <RunPlaybookModal
          playbookId={detail.playbook.id}
          clients={clients}
          onClose={() => setShowRun(false)}
        />
      )}
    </div>
  );
}

function NewPlaybookModal({ categoryId, onClose }: { categoryId: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [type, setType] = useState("executable");
  const [estimatedDays, setEstimatedDays] = useState("");
  const [stepsText, setStepsText] = useState("");

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const steps = stepsText.split("\n").map((s) => s.trim()).filter(Boolean);
          startTransition(async () => {
            await createPlaybook({
              categoryId,
              name: name.trim(),
              type,
              estimatedDays: estimatedDays ? Number(estimatedDays) : null,
              steps,
            });
            router.refresh();
            onClose();
          });
        }}
        className="flex flex-col gap-3.5 p-5.5"
      >
        <h2 className="text-base font-medium">Novo playbook</h2>
        <Field label="NOME">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="TIPO">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="executable">Executável (gera tarefas)</option>
              <option value="document">Documento</option>
              <option value="draft">Rascunho</option>
            </Select>
          </Field>
          <Field label="DURAÇÃO ESTIMADA (DIAS)">
            <Input type="number" value={estimatedDays} onChange={(e) => setEstimatedDays(e.target.value)} />
          </Field>
        </div>
        <Field label="ETAPAS (UMA POR LINHA)">
          <Textarea rows={6} value={stepsText} onChange={(e) => setStepsText(e.target.value)} placeholder={"Assinar contrato\nCriar pasta do cliente\nReunião de kickoff"} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar playbook"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function RunPlaybookModal({
  playbookId,
  clients,
  onClose,
}: {
  playbookId: string;
  clients: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            try {
              await runPlaybook(playbookId, clientId || null);
              router.refresh();
              onClose();
            } catch {
              setError("Não foi possível rodar o playbook. Tente novamente.");
            }
          });
        }}
        className="flex flex-col gap-3.5 p-5.5"
      >
        <h2 className="text-base font-medium">Rodar playbook</h2>
        <Field label="CLIENTE (OU INTERNO)">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Interno / sem cliente</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <p className="text-[12.5px] text-muted">Isso vai criar uma tarefa no Kanban para cada etapa do playbook.</p>
        {error && <p className="rounded-lg bg-red-tint px-3 py-2 text-[12.5px] text-red">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Criando…" : "Confirmar"}</Button>
        </div>
      </form>
    </Modal>
  );
}

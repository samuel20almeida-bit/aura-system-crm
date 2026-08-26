"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, ProgressBar } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageBody";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { createCategory, createPlaybook, runPlaybook, toggleRunStep, getPlaybookDetailAction } from "@/lib/actions/playbooks";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";

type Category = { id: string; name: string; count: number };
type PlaybookListItem = {
  id: string;
  category_id: string;
  name: string;
  type: string;
  estimated_days: number | null;
  updated_at: string;
  updated_by_profile: { initials: string } | null;
};
type Step = { id: string; title: string; position: number };
type Run = { id: string; status: string; conta: { id: string; nome: string } | null; run_steps: { id: string; done: boolean }[] };

const typeLabel: Record<string, string> = { executable: "Executável", document: "Documento", draft: "Rascunho" };
const typeTone: Record<string, "accent" | "neutral"> = { executable: "accent", document: "neutral", draft: "neutral" };

export function PlaybooksBody({
  categories,
  activeCategoryId: initialActiveCategoryId,
  allPlaybooks,
  activePlaybookId: initialActivePlaybookId,
  detail: initialDetail,
  contas,
  contasIndisponiveis,
}: {
  categories: Category[];
  activeCategoryId: string | null;
  allPlaybooks: PlaybookListItem[];
  activePlaybookId: string | null;
  detail: { playbook: { id: string; name: string } | null; steps: Step[]; runs: Run[] } | null;
  contas: { id: string; nome: string }[];
  contasIndisponiveis: boolean;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewPlaybook, setShowNewPlaybook] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Estado local: seedado pelos props do primeiro render (link direto pra um
  // playbook específico continua funcionando via SSR), depois só muda por
  // clique — sem depender de navegação de página pra atualizar a tela.
  const [activeCategoryId, setActiveCategoryId] = useState(initialActiveCategoryId);
  const [activePlaybookId, setActivePlaybookId] = useState(initialActivePlaybookId);
  const [detail, setDetail] = useState(initialDetail);
  const [detailPending, startDetailTransition] = useTransition();
  // Guarda contra resposta obsoleta: se o usuário clicar em outro playbook ou
  // trocar de categoria antes de getPlaybookDetailAction responder, a resposta
  // atrasada não pode sobrescrever o estado já atualizado por um clique mais
  // recente.
  const ultimoPlaybookSolicitadoRef = useRef<string | null>(null);

  const activeCategory = categories.find((c) => c.id === activeCategoryId);
  // Filtro em memória — mesmo padrão de calcularMetricasPainel/filtro de
  // tarefas do Kanban. Trocar de categoria não faz nenhuma chamada de rede.
  const playbooks = useMemo(
    () => allPlaybooks.filter((p) => p.category_id === activeCategoryId),
    [allPlaybooks, activeCategoryId]
  );

  function selecionarCategoria(categoryId: string) {
    setActiveCategoryId(categoryId);
    setActivePlaybookId(null);
    setDetail(null);
    ultimoPlaybookSolicitadoRef.current = null;
    router.replace(`/playbooks?category=${categoryId}`, { scroll: false });
  }

  function selecionarPlaybook(playbookId: string) {
    const playbookAnterior = activePlaybookId;
    const detailAnterior = detail;
    setActivePlaybookId(playbookId);
    setDetail(null);
    ultimoPlaybookSolicitadoRef.current = playbookId;
    startDetailTransition(async () => {
      try {
        const d = await getPlaybookDetailAction(playbookId);
        if (ultimoPlaybookSolicitadoRef.current !== playbookId) return;
        setDetail(d);
        router.replace(`/playbooks?category=${activeCategoryId}&playbook=${playbookId}`, { scroll: false });
      } catch {
        if (ultimoPlaybookSolicitadoRef.current !== playbookId) return;
        setActivePlaybookId(playbookAnterior);
        setDetail(detailAnterior);
        notify("error", "Não foi possível carregar o playbook. Tente de novo.");
      }
    });
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex w-[200px] flex-none flex-col gap-0.5 border-r border-border bg-surface p-3">
        {/* `.label` não aplica caixa alta, e nenhum outro rótulo do app força
            o texto a maiúsculas. Era o terceiro caso — os outros dois caíram
            em #10 (ATIVIDADE RECENTE) e #14 (area.toUpperCase). */}
        <span className="label px-2 pb-2">Categorias</span>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => selecionarCategoria(c.id)}
            aria-current={c.id === activeCategoryId ? "true" : undefined}
            className={`flex w-full items-center gap-2 rounded-control px-2.5 py-2 text-left text-body font-medium transition-colors duration-fast ${
              c.id === activeCategoryId
                ? "bg-accent-tint text-accent"
                : "text-muted hover:bg-neutral-tint hover:text-ink"
            }`}
          >
            {c.name}
            <span className="ml-auto font-mono text-label tabular-nums text-faint">{c.count}</span>
          </button>
        ))}
        <button onClick={() => setShowNewCategory(true)} className="mt-1.5 px-2.5 text-left text-body text-faint transition-colors duration-fast hover:text-ink">
          + Nova categoria
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-5.5">
        {/* A TERCEIRA tela a desenhar o próprio cabeçalho, com o mesmo
            `text-[21px]` cru. As outras duas eram Metas (#14) e Kanban (#17)
            — e no #14 eu afirmei que aquela era a única, sem ter conferido. */}
        <PageHeader
          title={activeCategory?.name ?? "Playbooks"}
          sub={`${playbooks.length} ${playbooks.length === 1 ? "processo" : "processos"}`}
          actions={
            activeCategoryId ? (
              <Button onClick={() => setShowNewPlaybook(true)}>+ Novo playbook</Button>
            ) : undefined
          }
        />

        <div className="grid flex-1 grid-cols-[1.7fr_1fr] gap-3.5 overflow-hidden">
          <Card className="flex flex-col gap-1 overflow-hidden p-4">
            <div className="grid grid-cols-[1.9fr_.8fr_.9fr_34px] gap-2 border-b border-border pb-2">
              {["Processo", "Tipo", "Atualizado", ""].map((coluna, i) => (
                // A última coluna é o avatar de quem mexeu por último e não
                // tem rótulo; a chave leva o índice porque ela é string vazia.
                <div key={`${coluna}-${i}`} className="label">
                  {coluna}
                </div>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {playbooks.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selecionarPlaybook(p.id)}
                  className={`grid w-full grid-cols-[1.9fr_.8fr_.9fr_34px] items-center gap-2 border-b border-border-soft py-2.5 text-left text-body hover:bg-neutral-tint ${
                    p.id === activePlaybookId ? "bg-neutral-tint" : ""
                  }`}
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    {p.estimated_days ? <div className="font-mono text-label text-muted">~{p.estimated_days} dias</div> : null}
                  </div>
                  <Tag tone={typeTone[p.type]}>{typeLabel[p.type]}</Tag>
                  <div className="font-mono text-label text-muted">{formatDate(p.updated_at)}</div>
                  <Avatar initials={p.updated_by_profile?.initials} size="sm" ghost />
                </button>
              ))}
              {playbooks.length === 0 && (
                <EmptyState
                  plain
                  title={
                    activeCategoryId
                      ? "Nenhum playbook nesta categoria ainda."
                      : "Selecione uma categoria."
                  }
                />
              )}
            </div>
          </Card>

          <div className="flex min-h-0 flex-col gap-3.5">
            {detailPending ? (
              <Card className="flex flex-1 items-center justify-center p-4 text-center text-small text-faint">
                Carregando…
              </Card>
            ) : detail?.playbook ? (
              <>
                <Card className="flex flex-col gap-2.5 p-4">
                  <span className="label">{detail.playbook.name.toUpperCase()}</span>
                  <div className="flex flex-col gap-1.5 text-small">
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
                          <div className="flex items-center justify-between text-body">
                            <span>{r.conta?.nome ?? "Interno"}</span>
                            <span className={`font-mono text-small ${done === total && total > 0 ? "text-accent" : "text-muted"}`}>
                              {done}/{total}
                            </span>
                          </div>
                          {/* Era uma barra reimplementada aqui dentro, com
                              `bg-[#EDEAE2]` cru — o valor de
                              `--color-border-soft`. A `ProgressBar` do kit faz
                              o mesmo, já usa o token, e trata o divisor por
                              zero que esta versão tratava à mão. */}
                          <ProgressBar percent={total > 0 ? (done / total) * 100 : 0} />
                          <div className="flex flex-wrap gap-1.5">
                            {r.run_steps.map((rs, i) => (
                              <button
                                key={rs.id}
                                disabled={pending}
                                onClick={() =>
                                  startTransition(async () => {
                                    try {
                                      await toggleRunStep(rs.id, !rs.done);
                                      setDetail((atual) =>
                                        atual
                                          ? {
                                              ...atual,
                                              runs: atual.runs.map((run) =>
                                                run.id !== r.id
                                                  ? run
                                                  : {
                                                      ...run,
                                                      run_steps: run.run_steps.map((s) =>
                                                        s.id === rs.id ? { ...s, done: !s.done } : s
                                                      ),
                                                    }
                                              ),
                                            }
                                          : atual
                                      );
                                    } catch {
                                      notify("error", "Não foi possível atualizar a etapa. Tente novamente.");
                                    }
                                  })
                                }
                                className={`rounded px-1.5 py-0.5 font-mono text-label ${rs.done ? "bg-accent-tint text-accent" : "bg-neutral-tint text-muted"}`}
                                title={detail.steps[i]?.title}
                              >
                                {i + 1}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {detail.runs.length === 0 && <EmptyState plain title="Nenhuma execução ainda." />}
                  </div>
                </Card>
              </>
            ) : (
              <Card className="flex flex-1 items-center justify-center p-4 text-center text-small text-faint">
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
                setActiveCategoryId(cat.id);
                setActivePlaybookId(null);
                setDetail(null);
                ultimoPlaybookSolicitadoRef.current = null;
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
          contas={contas}
          contasIndisponiveis={contasIndisponiveis}
          onClose={() => setShowRun(false)}
          onRun={async () => {
            const fresh = await getPlaybookDetailAction(detail.playbook!.id);
            setDetail(fresh);
          }}
        />
      )}
    </div>
  );
}

function NewPlaybookModal({ categoryId, onClose }: { categoryId: string; onClose: () => void }) {
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
            onClose();
          });
        }}
        className="flex flex-col gap-3.5 p-5.5"
      >
        <h2 className="text-base font-medium">Novo playbook</h2>
        <Field label="NOME">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
  contas,
  contasIndisponiveis,
  onClose,
  onRun,
}: {
  playbookId: string;
  contas: { id: string; nome: string }[];
  contasIndisponiveis: boolean;
  onClose: () => void;
  onRun: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [contaId, setContaId] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            // `runPlaybook` e a atualização da tela (`onRun`) são separados
            // de propósito: se o playbook já rodou (execução + tarefas do
            // Kanban criadas) mas só o refetch seguinte falhar, o modal não
            // pode continuar mostrando "não foi possível rodar" — isso
            // convidaria a um reenvio que duplicaria a execução inteira.
            try {
              await runPlaybook(playbookId, contaId || null);
            } catch {
              setError("Não foi possível rodar o playbook. Tente novamente.");
              return;
            }
            onClose();
            try {
              await onRun();
            } catch {
              notify("error", "O playbook rodou, mas não foi possível atualizar a tela. Recarregue a página.");
            }
          });
        }}
        className="flex flex-col gap-3.5 p-5.5"
      >
        <h2 className="text-base font-medium">Rodar playbook</h2>
        <Field label="CONTA (OU INTERNO)">
          {contasIndisponiveis ? (
            // A leitura de contas falhou (mesmo caso do Kanban, Task 4): listar
            // um `<select>` vazio aqui mentiria "sem contas cadastradas". O
            // aviso ocupa o lugar do seletor; `contaId` some vazio, então
            // confirmar continua funcionando como execução interna.
            <Tag tone="amber">Contas indisponíveis</Tag>
          ) : (
            <Select value={contaId} onChange={(e) => setContaId(e.target.value)}>
              <option value="">Interno / sem conta</option>
              {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          )}
        </Field>
        <p className="text-small text-muted">Isso vai criar uma tarefa no Kanban para cada etapa do playbook.</p>
        {error && <p className="rounded-control bg-red-tint px-3 py-2 text-small text-red">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Criando…" : "Confirmar"}</Button>
        </div>
      </form>
    </Modal>
  );
}

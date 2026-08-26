"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KanbanBoard } from "./KanbanBoard";
import { NewTaskModal } from "./NewTaskModal";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PageHeader } from "@/components/layout/PageBody";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";
import { formatDate } from "@/lib/format";
import { addDaysToDateStr, todayInAppTz } from "@/lib/timezone";
import type { TaskWithRelations } from "@/lib/data/tasks";
import type { Tables } from "@/lib/supabase/database.types";
import type { ColumnId } from "./KanbanBoard";
import { EmptyState } from "@/components/ui/EmptyState";

type ContaLite = { id: string; nome: string };
type AreaLite = { id: string; nome: string };

const statusLabel: Record<string, string> = { todo: "A fazer", in_progress: "Em andamento", done: "Finalizada" };
const mobileColumns: ColumnId[] = ["todo", "in_progress", "done"];

export function KanbanClient({
  tasks,
  contas,
  contasIndisponiveis,
  profiles,
  areas,
  checklistCounts,
}: {
  tasks: TaskWithRelations[];
  contas: ContaLite[];
  contasIndisponiveis: boolean;
  profiles: Tables<"profiles">[];
  areas: AreaLite[];
  checklistCounts: Record<string, { done: number; total: number }>;
}) {
  const router = useRouter();
  const [view, setView] = useState<"board" | "list">("board");
  const [scope, setScope] = useState<"clientes" | "interno">("clientes");
  const [contaFilter, setContaFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [showNewTask, setShowNewTask] = useState(false);
  const [mobileColumn, setMobileColumn] = useState<ColumnId>("todo");

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (scope === "interno" && !t.is_internal) return false;
      if (scope === "clientes" && t.is_internal) return false;
      if (contaFilter && t.conta_id !== contaFilter) return false;
      if (assigneeFilter && t.assignee_id !== assigneeFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [tasks, scope, contaFilter, assigneeFilter, priorityFilter]);

  const activeCount = filtered.filter((t) => t.status !== "done").length;
  // "Hoje" é o dia em São Paulo e a comparação fica no calendário. Com
  // new Date(t.due_date).getTime() a data crua virava meia-noite UTC — 21h do
  // dia anterior aqui — e este contador contradizia o sino e os próprios
  // cartões, que a Task 9 já havia corrigido.
  // useMemo fotografa "hoje" uma vez: sem isso o valor poderia mudar na virada
  // da meia-noite entre dois renders da mesma sessão.
  const today = useMemo(() => todayInAppTz(), []);
  const weekLimit = addDaysToDateStr(today, 7);
  const dueThisWeek = filtered.filter((t) => {
    if (!t.due_date || t.status === "done") return false;
    return t.due_date >= today && t.due_date <= weekLimit;
  }).length;

  function openTask(id: string) {
    router.push(`/kanban?task=${id}`, { scroll: false });
  }

  return (
    <>
      {/* Esta tela também desenhava o próprio cabeçalho, com `text-[21px]` cru
          — o valor do `text-display` — e a linha de apoio a 12,5px contra os
          12px das outras. Eu tinha escrito no PR de Metas que aquela era a
          única assim; era engano, são três. Playbooks é a terceira. */}
      <PageHeader
        title="Kanban"
        sub={`${activeCount} tarefas ativas · ${dueThisWeek} vencendo esta semana`}
        actions={
          <>
            <SegmentedControl
              rotuloAcessivel="Modo de visualização"
              valor={view}
              onChange={(v) => setView(v as "board" | "list")}
              opcoes={[
                { valor: "board", rotulo: "Board" },
                { valor: "list", rotulo: "Lista" },
              ]}
            />
            <Button onClick={() => setShowNewTask(true)}>+ Nova tarefa</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {/* `pilula` porque este controle vive na faixa de filtros, onde tudo é
            arredondado; os outros dois usam o raio de controle. */}
        <SegmentedControl
          formato="pilula"
          rotuloAcessivel="Escopo das tarefas"
          valor={scope}
          onChange={(v) => setScope(v as "clientes" | "interno")}
          opcoes={[
            { valor: "clientes", rotulo: "Clientes" },
            { valor: "interno", rotulo: "Interno" },
          ]}
        />
        {scope === "clientes" &&
          (contasIndisponiveis ? (
            // A leitura de contas falhou — mostrar "Todas as contas" aqui
            // mentiria que dá para filtrar. O aviso ocupa o mesmo lugar do
            // seletor sem bloquear o resto da tela (board/lista continuam
            // navegáveis, e a nova tarefa interna não depende disto).
            <Tag tone="amber">Contas indisponíveis</Tag>
          ) : (
            <select
              value={contaFilter}
              onChange={(e) => setContaFilter(e.target.value)}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-small text-muted transition-colors duration-fast hover:border-faint"
            >
              <option value="">Todas as contas</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          ))}
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-small text-muted transition-colors duration-fast hover:border-faint"
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
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-small text-muted transition-colors duration-fast hover:border-faint"
        >
          <option value="">Prioridade</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
          <option value="low">Baixa</option>
        </select>
      </div>

      {view === "board" ? (
        <>
          <SegmentedControl
            className="md:hidden"
            preencher
            rotuloAcessivel="Coluna visível"
            valor={mobileColumn}
            onChange={(v) => setMobileColumn(v as ColumnId)}
            opcoes={mobileColumns.map((c) => ({ valor: c, rotulo: statusLabel[c] }))}
          />
          <KanbanBoard
            tasks={filtered}
            checklistCounts={checklistCounts}
            onOpenTask={openTask}
            mobileColumn={mobileColumn}
          />
        </>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin rounded-card border border-border bg-surface">
          {/* Grudado, com sombra interna no lugar de `border-b`: numa lista
              longa o cabeçalho subia junto e as colunas ficavam sem nome.
              Mesmo tratamento da tabela do Painel e dos grupos de /hoje.
              "CONTA", não "CLIENTE": a célula abaixo mostra `conta.nome` desde
              a unificação, e o rótulo tinha ficado para trás. */}
          <div className="sticky top-0 z-10 grid grid-cols-[1.6fr_1fr_1fr_.8fr_80px] gap-2 bg-bone px-3 py-2 shadow-[inset_0_-1px_0_var(--color-border)]">
            {["Tarefa", "Conta", "Status", "Prazo", "Resp."].map((coluna) => (
              <div key={coluna} className="label">
                {coluna}
              </div>
            ))}
          </div>
          {filtered.map((t) => (
            <div
              key={t.id}
              onClick={() => openTask(t.id)}
              className="grid cursor-pointer grid-cols-[1.6fr_1fr_1fr_.8fr_80px] items-center gap-2 border-b border-border-soft px-3 py-2.5 text-body transition-colors duration-fast hover:bg-neutral-tint"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="font-mono text-label text-faint">{t.code}</span>
                {t.title}
              </div>
              <div className="truncate text-muted">{t.conta?.nome ?? "Interno"}</div>
              <div>
                <Tag tone={t.status === "done" ? "accent" : "neutral"}>{statusLabel[t.status]}</Tag>
              </div>
              <div className="font-mono text-label tabular-nums text-muted">
                {t.due_date ? formatDate(t.due_date) : "—"}
              </div>
              <Avatar initials={t.assignee?.initials} size="sm" ghost={!t.assignee} />
            </div>
          ))}
          {filtered.length === 0 && (
            <EmptyState plain title="Nenhuma tarefa encontrada." />
          )}
        </div>
      )}

      {showNewTask && (
        <NewTaskModal
          contas={contas}
          contasIndisponiveis={contasIndisponiveis}
          profiles={profiles}
          areas={areas}
          onClose={() => setShowNewTask(false)}
        />
      )}
    </>
  );
}

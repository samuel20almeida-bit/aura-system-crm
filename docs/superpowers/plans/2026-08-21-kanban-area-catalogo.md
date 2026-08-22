# Kanban — Catálogo de Áreas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O campo "ÁREA" do modal "Nova tarefa" deixa de ser texto livre e vira uma lista pré-cadastrada (Estúdio, Financeiro, Marketing, Comercial, OPS), com uma opção de cadastrar novas direto no modal, sem abrir um segundo modal.

**Architecture:** Nova tabela `task_areas` (mesmo formato de `playbook_categories`), lida por uma função de dados nova e escrita por uma Server Action nova, ambas seguindo o padrão já estabelecido em `src/lib/data/tasks.ts`/`src/lib/actions/tasks.ts`. `NewTaskModal.tsx` troca o `<Input>` de Área por um `<Select>` alimentado por essa lista, com uma opção "+ Nova área…" que revela um campo de texto inline.

**Tech Stack:** Next.js App Router (Server Component + Client Component + Server Action), Supabase (Postgres + PostgREST + RLS), TypeScript.

## Global Constraints

- **pt-BR** em toda string visível ao usuário.
- **Sem `motion-safe:`** em nenhuma classe Tailwind.
- **Nenhum dado fictício.**
- **Banco único**, sem separação dev/prod.
- **Toda escrita passa por `beginMutation()`/`end()`** de `src/lib/realtime/mutation-gate.ts` — a criação de área não é exceção.
- **Migração precisa existir como arquivo em `supabase/migrations/` E ser aplicada via a ferramenta MCP do Supabase** — a aplicação real no banco é feita pelo controlador da sessão (não pelo subagente da Task 1), depois da revisão da Task 1 e antes de começar a Task 2.
- Área continua existindo só em tarefas Internas — tarefa de cliente não ganha esse campo.
- Spec de referência: `docs/superpowers/specs/2026-08-21-kanban-area-catalogo-design.md`.

---

### Task 1: Migração, leitura e escrita do catálogo de Áreas

**Files:**
- Create: `supabase/migrations/0018_task_areas.sql`
- Modify: `src/lib/data/tasks.ts`
- Modify: `src/lib/actions/tasks.ts`

**Interfaces:**
- Consumes: nada novo.
- Produces (para a Task 2 consumir): `listTaskAreas(): Promise<Array<{ id: string; nome: string }>>` de `src/lib/data/tasks.ts`; `createTaskArea(nome: string): Promise<{ id: string; nome: string }>` de `src/lib/actions/tasks.ts` (lança erro em caso de falha, mesmo padrão de `createCategory` em `src/lib/actions/playbooks.ts`).

- [ ] **Step 1: Criar a migração**

Crie `supabase/migrations/0018_task_areas.sql`:

```sql
-- Catálogo de áreas para tarefas Internas do Kanban. Hoje `tasks.area` é
-- texto livre (0001_schema.sql:142) — sem uma lista real por trás, a mesma
-- área vira "Financeiro", "financeiro", "Financ." em tarefas diferentes.
-- Esta tabela não substitui `tasks.area`: continua sendo a coluna de texto
-- que já existia, só o que a preenche passa a vir de um catálogo real.
create table public.task_areas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  position integer not null default 0,
  criado_em timestamptz not null default now()
);

alter table public.task_areas enable row level security;
create policy "authenticated_full_access" on public.task_areas
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

insert into public.task_areas (nome, position) values
  ('Estúdio', 0),
  ('Financeiro', 1),
  ('Marketing', 2),
  ('Comercial', 3),
  ('OPS', 4)
on conflict do nothing;
```

- [ ] **Step 2: Adicionar `listTaskAreas` em `src/lib/data/tasks.ts`**

Ache `listClientsLite` neste arquivo e acrescente logo depois:

```ts
export async function listTaskAreas() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_areas")
    .select("id, nome")
    .order("position");
  return data ?? [];
}
```

- [ ] **Step 3: Adicionar `createTaskArea` em `src/lib/actions/tasks.ts`**

Acrescente no fim do arquivo:

```ts
export async function createTaskArea(nome: string) {
  const supabase = await createClient();
  const nomeAparado = nome.trim();

  // Reaproveita uma área já existente com o mesmo nome (ignorando
  // maiúsculas/minúsculas e espaço nas pontas) em vez de duplicar —
  // "Financeiro" e "financeiro " não podem virar duas linhas.
  const { data: existente } = await supabase
    .from("task_areas")
    .select("id, nome")
    .ilike("nome", nomeAparado)
    .maybeSingle();
  if (existente) return existente;

  const { data: maxPos } = await supabase
    .from("task_areas")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("task_areas")
    .insert({ nome: nomeAparado, position: (maxPos?.position ?? 0) + 1 })
    .select("id, nome")
    .single();
  if (error) throw error;

  revalidatePath("/kanban");
  return data;
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: limpo. **A migração ainda não foi aplicada ao banco neste ponto** — `tsc` valida contra o schema gerado em `src/lib/supabase/database.types.ts`, que ainda não conhece `task_areas`. Se `tsc` reclamar de `.from("task_areas")` não ser uma tabela reconhecida, isso é esperado até a migração ser aplicada e os tipos regenerados — **não** regenere os tipos nem aplique a migração nesta task; isso é feito pelo controlador da sessão entre esta task e a próxima. Se o erro for outro (não relacionado a `task_areas` não existir no tipo `Database`), corrija normalmente.

- [ ] **Step 5: Rodar lint e build**

Run: `npm run lint && npm run build`
Expected: ambos limpos (mesmo warning pré-existente e não relacionado em `src/app/layout.tsx`, se aparecer).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0018_task_areas.sql src/lib/data/tasks.ts src/lib/actions/tasks.ts
git commit -m "feat: catálogo de Áreas — migração, leitura e Server Action"
```

---

### Task 2: Campo Área vira lista com opção de cadastrar

**Files:**
- Modify: `src/app/(app)/kanban/page.tsx`
- Modify: `src/components/kanban/KanbanClient.tsx`
- Modify: `src/components/kanban/NewTaskModal.tsx`

**Interfaces:**
- Consumes: `listTaskAreas`, `createTaskArea` da Task 1.
- Produces: nada — última task do plano.

**Nota para quem for executar esta task:** a migração da Task 1 já deve ter sido aplicada ao banco pelo controlador da sessão antes desta task começar (é um passo do processo, não desta task) — `npx tsc --noEmit` deve compilar limpo contra `task_areas` normalmente aqui. Se `.from("task_areas")` ainda aparecer como erro de tipo, pare e avise — a migração não foi aplicada ainda, e não é papel desta task aplicá-la.

- [ ] **Step 1: `page.tsx` busca as áreas e repassa**

Em `src/app/(app)/kanban/page.tsx`, troque:

```tsx
import { listClientsLite, listTasks, getTaskDetail } from "@/lib/data/tasks";
```

por:

```tsx
import { listClientsLite, listTasks, getTaskDetail, listTaskAreas } from "@/lib/data/tasks";
```

Troque:

```tsx
  const [tasks, clients, profiles, { data: checklistRows }] = await Promise.all([
    listTasks(),
    listClientsLite(),
    listProfiles(),
    supabase.from("task_checklist_items").select("task_id, done"),
  ]);
```

por:

```tsx
  const [tasks, clients, profiles, areas, { data: checklistRows }] = await Promise.all([
    listTasks(),
    listClientsLite(),
    listProfiles(),
    listTaskAreas(),
    supabase.from("task_checklist_items").select("task_id, done"),
  ]);
```

Troque:

```tsx
      <KanbanClient
        tasks={tasks}
        clients={clients}
        profiles={profiles}
        checklistCounts={checklistCounts}
      />
```

por:

```tsx
      <KanbanClient
        tasks={tasks}
        clients={clients}
        profiles={profiles}
        areas={areas}
        checklistCounts={checklistCounts}
      />
```

- [ ] **Step 2: `KanbanClient` recebe e repassa `areas`**

Em `src/components/kanban/KanbanClient.tsx`, troque a assinatura de `KanbanClient`:

```tsx
export function KanbanClient({
  tasks,
  clients,
  profiles,
  checklistCounts,
}: {
  tasks: TaskWithRelations[];
  clients: ClientLite[];
  profiles: Tables<"profiles">[];
  checklistCounts: Record<string, { done: number; total: number }>;
}) {
```

por:

```tsx
type AreaLite = { id: string; nome: string };

export function KanbanClient({
  tasks,
  clients,
  profiles,
  areas,
  checklistCounts,
}: {
  tasks: TaskWithRelations[];
  clients: ClientLite[];
  profiles: Tables<"profiles">[];
  areas: AreaLite[];
  checklistCounts: Record<string, { done: number; total: number }>;
}) {
```

Troque:

```tsx
        <NewTaskModal clients={clients} profiles={profiles} onClose={() => setShowNewTask(false)} />
```

por:

```tsx
        <NewTaskModal clients={clients} profiles={profiles} areas={areas} onClose={() => setShowNewTask(false)} />
```

- [ ] **Step 3: `NewTaskModal` troca o Input de Área por um Select com cadastro inline**

Em `src/components/kanban/NewTaskModal.tsx`, troque o import:

```tsx
import { createTask } from "@/lib/actions/tasks";
```

por:

```tsx
import { createTask, createTaskArea } from "@/lib/actions/tasks";
```

Troque a assinatura de `NewTaskModal` e os `useState` do topo:

```tsx
export function NewTaskModal({
  clients,
  profiles,
  onClose,
}: {
  clients: ClientLite[];
  profiles: Tables<"profiles">[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [isInternal, setIsInternal] = useState(clients.length === 0);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [area, setArea] = useState("Estúdio");
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
```

por:

```tsx
type AreaLite = { id: string; nome: string };

export function NewTaskModal({
  clients,
  profiles,
  areas,
  onClose,
}: {
  clients: ClientLite[];
  profiles: Tables<"profiles">[];
  areas: AreaLite[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [isInternal, setIsInternal] = useState(clients.length === 0);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [areasDisponiveis, setAreasDisponiveis] = useState(areas);
  const [area, setArea] = useState(areasDisponiveis[0]?.nome ?? "");
  const [mostrandoNovaArea, setMostrandoNovaArea] = useState(false);
  const [novaAreaNome, setNovaAreaNome] = useState("");
  const [criandoArea, startAreaTransition] = useTransition();
  const [erroArea, setErroArea] = useState<string | null>(null);
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
```

Troque o bloco do campo Área:

```tsx
        {isInternal ? (
          <Field label="ÁREA">
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Estúdio, Financeiro, Marketing…" />
          </Field>
        ) : (
```

por:

```tsx
        {isInternal ? (
          <Field label="ÁREA">
            {mostrandoNovaArea ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    value={novaAreaNome}
                    onChange={(e) => setNovaAreaNome(e.target.value)}
                    placeholder="Nome da nova área"
                  />
                  <Button
                    type="button"
                    disabled={criandoArea || !novaAreaNome.trim()}
                    onClick={() => {
                      setErroArea(null);
                      startAreaTransition(async () => {
                        const end = beginMutation();
                        try {
                          const nova = await createTaskArea(novaAreaNome.trim());
                          setAreasDisponiveis((atual) =>
                            atual.some((a) => a.id === nova.id) ? atual : [...atual, nova]
                          );
                          setArea(nova.nome);
                          setNovaAreaNome("");
                          setMostrandoNovaArea(false);
                        } catch {
                          setErroArea("Não foi possível criar a área. Tente de novo.");
                        } finally {
                          end();
                        }
                      });
                    }}
                  >
                    {criandoArea ? "Adicionando…" : "Adicionar"}
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMostrandoNovaArea(false);
                    setNovaAreaNome("");
                    setErroArea(null);
                  }}
                  className="self-start text-[12px] text-faint hover:text-ink"
                >
                  Cancelar e voltar à lista
                </button>
                {erroArea && <p className="text-[12px] text-red">{erroArea}</p>}
              </div>
            ) : (
              <Select
                value={area}
                onChange={(e) => {
                  if (e.target.value === "__nova__") {
                    setMostrandoNovaArea(true);
                  } else {
                    setArea(e.target.value);
                  }
                }}
              >
                {areasDisponiveis.map((a) => (
                  <option key={a.id} value={a.nome}>
                    {a.nome}
                  </option>
                ))}
                <option value="__nova__">+ Nova área…</option>
              </Select>
            )}
          </Field>
        ) : (
```

- [ ] **Step 4: Verificação completa**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: os quatro comandos limpos (177 testes — esta task não adiciona nem remove teste, é mudança de UI sem infraestrutura de teste de componente neste projeto). Confirme que a migração da Task 1 já foi aplicada (o controlador da sessão faz isso entre as tasks) — se `tsc` falhar por `task_areas` não existir no tipo `Database`, é sinal de que esse passo ainda não aconteceu.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/kanban/page.tsx" src/components/kanban/KanbanClient.tsx src/components/kanban/NewTaskModal.tsx
git commit -m "feat: campo Área vira lista pré-cadastrada com opção de cadastrar novas"
```

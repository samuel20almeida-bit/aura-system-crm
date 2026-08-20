# Playbooks — Trocar de Categoria/Playbook Sem Travar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar de categoria em `/playbooks` fica instantâneo (zero rede); selecionar um playbook destaca a linha na hora e só o painel de detalhe espera o servidor, sem travar o resto da tela.

**Architecture:** A página passa a buscar todos os playbooks de uma vez (não mais filtrados por categoria no servidor a cada clique); o componente client filtra por categoria em memória (`useMemo`) e busca o detalhe de um playbook sob demanda via uma Server Action de leitura nova, com estado local que atualiza a UI antes da resposta do servidor chegar.

**Tech Stack:** Next.js App Router (Server Component + Client Component), React `useState`/`useMemo`/`useTransition`, Supabase (PostgREST).

## Global Constraints

- **pt-BR** em toda string visível ao usuário.
- **Sem `motion-safe:`** em nenhuma classe Tailwind (transições simples sem esse prefixo são permitidas — já usadas em `ProgressBar`/`Button` deste projeto).
- **Nenhuma migração, nenhuma mudança de schema.**
- **Sem infraestrutura de teste de componente React** neste projeto (sem `@testing-library/react`) — verificação por `npm test` (suíte existente não pode quebrar), `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Spec de referência: `docs/superpowers/specs/2026-08-20-playbooks-fluidez-design.md`.

---

### Task 1: Buscar todos os playbooks de uma vez (refatoração segura, sem mudança de comportamento)

**Files:**
- Modify: `src/lib/data/playbooks.ts`
- Modify: `src/lib/actions/playbooks.ts`
- Modify: `src/app/(app)/playbooks/page.tsx`

**Interfaces:**
- Consumes: nada novo.
- Produces (para a Task 2 consumir): `listAllPlaybooks(): Promise<Array<{ id: string; category_id: string; name: string; type: string; estimated_days: number | null; updated_at: string; updated_by_profile: { id: string; full_name: string; initials: string } | null }>>` de `src/lib/data/playbooks.ts`; `getPlaybookDetailAction(id: string): Promise<{ playbook: {...} | null; steps: Step[]; runs: Run[] }>` de `src/lib/actions/playbooks.ts` (mesmo formato de retorno de `getPlaybookDetail`, já existente).

Esta task NÃO muda nenhum comportamento visível — `page.tsx` continua passando pra `PlaybooksBody` exatamente o mesmo `playbooks` (já filtrado pela categoria ativa), só que a consulta ao Supabase agora busca tudo e filtra em memória no servidor. É uma preparação segura e independentemente verificável para a Task 2, que é quem move o filtro pro cliente.

- [ ] **Step 1: Trocar `listPlaybooksInCategory` por `listAllPlaybooks`**

Em `src/lib/data/playbooks.ts`, troque:

```ts
export async function listPlaybooksInCategory(categoryId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("playbooks")
    .select("*, updated_by_profile:profiles!playbooks_updated_by_fkey(id, full_name, initials)")
    .eq("category_id", categoryId)
    .order("updated_at", { ascending: false });
  return data ?? [];
}
```

por:

```ts
export async function listAllPlaybooks() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("playbooks")
    .select("*, updated_by_profile:profiles!playbooks_updated_by_fkey(id, full_name, initials)")
    .order("updated_at", { ascending: false });
  return data ?? [];
}
```

(remove o `.eq("category_id", categoryId)` e o parâmetro — o resto é idêntico.)

- [ ] **Step 2: Adicionar a Server Action de leitura**

Em `src/lib/actions/playbooks.ts`, adicione o import de `getPlaybookDetail` e a nova action, no fim do arquivo:

```ts
import { getPlaybookDetail } from "@/lib/data/playbooks";
```

(acrescente essa linha junto dos imports já existentes, no topo do arquivo)

```ts
export async function getPlaybookDetailAction(id: string) {
  return getPlaybookDetail(id);
}
```

(acrescente esta função no final do arquivo, depois de `toggleRunStep`)

- [ ] **Step 3: Atualizar `page.tsx` pra usar `listAllPlaybooks`, filtrando em memória**

Em `src/app/(app)/playbooks/page.tsx`, troque o corpo da função por:

```tsx
import { listCategoriesWithCounts, listAllPlaybooks, getPlaybookDetail } from "@/lib/data/playbooks";
import { listClientsLite } from "@/lib/data/tasks";
import { PlaybooksBody } from "@/components/playbooks/PlaybooksClient";

export default async function PlaybooksPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; playbook?: string }>;
}) {
  const { category, playbook } = await searchParams;
  const [categories, allPlaybooks, clients] = await Promise.all([
    listCategoriesWithCounts(),
    listAllPlaybooks(),
    listClientsLite(),
  ]);
  const activeCategoryId = category ?? categories[0]?.id ?? null;
  const playbooks = activeCategoryId ? allPlaybooks.filter((p) => p.category_id === activeCategoryId) : [];
  const detail = playbook ? await getPlaybookDetail(playbook) : null;

  return (
    <PlaybooksBody
      categories={categories}
      activeCategoryId={activeCategoryId}
      playbooks={playbooks}
      activePlaybookId={playbook ?? null}
      detail={detail}
      clients={clients}
    />
  );
}
```

- [ ] **Step 4: Verificar que nada quebrou**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: os quatro comandos limpos. O comportamento de `/playbooks` continua idêntico ao de antes desta task (troca de categoria/playbook ainda navega a página inteira — isso só muda na Task 2).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/playbooks.ts src/lib/actions/playbooks.ts "src/app/(app)/playbooks/page.tsx"
git commit -m "refactor: busca todos os playbooks de uma vez, prepara Server Action de leitura de detalhe"
```

---

### Task 2: Selecionar categoria/playbook fica instantâneo (estado local + Server Action)

**Files:**
- Modify: `src/app/(app)/playbooks/page.tsx`
- Modify: `src/components/playbooks/PlaybooksClient.tsx`

**Interfaces:**
- Consumes: `listAllPlaybooks` e `getPlaybookDetailAction` da Task 1.
- Produces: nada — esta é a última task do plano.

- [ ] **Step 1: `page.tsx` para de filtrar no servidor, passa a lista inteira**

Em `src/app/(app)/playbooks/page.tsx`, troque:

```tsx
  const activeCategoryId = category ?? categories[0]?.id ?? null;
  const playbooks = activeCategoryId ? allPlaybooks.filter((p) => p.category_id === activeCategoryId) : [];
  const detail = playbook ? await getPlaybookDetail(playbook) : null;

  return (
    <PlaybooksBody
      categories={categories}
      activeCategoryId={activeCategoryId}
      playbooks={playbooks}
      activePlaybookId={playbook ?? null}
      detail={detail}
      clients={clients}
    />
  );
```

por:

```tsx
  const activeCategoryId = category ?? categories[0]?.id ?? null;
  const detail = playbook ? await getPlaybookDetail(playbook) : null;

  return (
    <PlaybooksBody
      categories={categories}
      activeCategoryId={activeCategoryId}
      allPlaybooks={allPlaybooks}
      activePlaybookId={playbook ?? null}
      detail={detail}
      clients={clients}
    />
  );
```

- [ ] **Step 2: `PlaybooksBody` ganha estado local e filtro em memória**

Em `src/components/playbooks/PlaybooksClient.tsx`, troque os imports do topo:

```ts
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
```

por:

```ts
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { createCategory, createPlaybook, runPlaybook, toggleRunStep, getPlaybookDetailAction } from "@/lib/actions/playbooks";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
```

(`Link` sai — categoria e playbook não navegam mais por `<Link>`; `getPlaybookDetailAction` entra.)

Troque o tipo `PlaybookListItem`:

```ts
type PlaybookListItem = {
  id: string;
  name: string;
  type: string;
  estimated_days: number | null;
  updated_at: string;
  updated_by_profile: { initials: string } | null;
};
```

por:

```ts
type PlaybookListItem = {
  id: string;
  category_id: string;
  name: string;
  type: string;
  estimated_days: number | null;
  updated_at: string;
  updated_by_profile: { initials: string } | null;
};
```

Troque a assinatura de `PlaybooksBody` e o início do corpo da função:

```tsx
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
```

por:

```tsx
export function PlaybooksBody({
  categories,
  activeCategoryId: initialActiveCategoryId,
  allPlaybooks,
  activePlaybookId: initialActivePlaybookId,
  detail: initialDetail,
  clients,
}: {
  categories: Category[];
  activeCategoryId: string | null;
  allPlaybooks: PlaybookListItem[];
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

  // Estado local: seedado pelos props do primeiro render (link direto pra um
  // playbook específico continua funcionando via SSR), depois só muda por
  // clique — sem depender de navegação de página pra atualizar a tela.
  const [activeCategoryId, setActiveCategoryId] = useState(initialActiveCategoryId);
  const [activePlaybookId, setActivePlaybookId] = useState(initialActivePlaybookId);
  const [detail, setDetail] = useState(initialDetail);
  const [detailPending, startDetailTransition] = useTransition();

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
    router.replace(`/playbooks?category=${categoryId}`, { scroll: false });
  }

  function selecionarPlaybook(playbookId: string) {
    const playbookAnterior = activePlaybookId;
    const detailAnterior = detail;
    setActivePlaybookId(playbookId);
    setDetail(null);
    startDetailTransition(async () => {
      try {
        const d = await getPlaybookDetailAction(playbookId);
        setDetail(d);
        router.replace(`/playbooks?category=${activeCategoryId}&playbook=${playbookId}`, { scroll: false });
      } catch {
        setActivePlaybookId(playbookAnterior);
        setDetail(detailAnterior);
        notify("error", "Não foi possível carregar o playbook. Tente de novo.");
      }
    });
  }
```

- [ ] **Step 3: Categoria vira botão com estado local, não `<Link>`**

Troque:

```tsx
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
```

por:

```tsx
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => selecionarCategoria(c.id)}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium ${
              c.id === activeCategoryId ? "bg-accent-tint text-accent" : "text-muted hover:bg-neutral-tint"
            }`}
          >
            {c.name}
            <span className="ml-auto font-mono text-[10px] text-faint">{c.count}</span>
          </button>
        ))}
```

- [ ] **Step 4: Playbook vira botão com estado local, não `<Link>`**

Troque:

```tsx
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
```

por:

```tsx
              {playbooks.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selecionarPlaybook(p.id)}
                  className={`grid w-full grid-cols-[1.9fr_.8fr_.9fr_34px] items-center gap-2 border-b border-border-soft py-2.5 text-left text-[13px] hover:bg-neutral-tint ${
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
                </button>
              ))}
```

- [ ] **Step 5: Painel de detalhe mostra um estado de carregamento discreto**

Troque:

```tsx
          <div className="flex min-h-0 flex-col gap-3.5">
            {detail?.playbook ? (
```

por:

```tsx
          <div className="flex min-h-0 flex-col gap-3.5">
            {detailPending ? (
              <Card className="flex flex-1 items-center justify-center p-4 text-center text-[12.5px] text-faint">
                Carregando…
              </Card>
            ) : detail?.playbook ? (
```

(o `) : (` que já fecha esse ternário antes do `<Card>` "Selecione um playbook para ver os detalhes." não muda — só ganha esse novo ramo `detailPending` na frente.)

- [ ] **Step 6: Verificação completa**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: os quatro comandos limpos. Nenhum teste existente muda (não há teste de componente React neste projeto para `PlaybooksClient.tsx`).

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/playbooks/page.tsx" src/components/playbooks/PlaybooksClient.tsx
git commit -m "feat: categoria e playbook em /playbooks selecionam sem navegação de página inteira"
```

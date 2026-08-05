# Fase 1 — Fundação de UX do Aura Studio

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o Aura responder na hora, nunca mostrar tela branca, avisar com clareza quando falha, e entregar as quatro funcionalidades que hoje aparecem na interface sem funcionar.

**Architecture:** As peças compartilhadas (avisos, esqueletos, mecânica otimista) nascem primeiro e cada módulo passa a consumi-las. Toda lógica que dá para testar sem navegador — fila de avisos, reordenação otimista, derivação de alertas — vive em funções puras em `src/lib/`, e os componentes React ficam finos. Isso mantém a suíte de testes rápida e sem `jsdom`.

**Tech Stack:** Next.js 16.2.12 (App Router, Server Actions), React 19.2.4 (`useOptimistic`), TypeScript 5, Tailwind v4, Supabase (Postgres + Auth + Storage), Vitest 4.

## Global Constraints

- **Idioma da interface:** português do Brasil. Toda string visível ao usuário em pt-BR.
- **Paleta (já definida em `src/app/globals.css`):** fundo `--color-bone` `#F7F5F0`, tinta `--color-ink` `#1E1E1C`, acento `--color-accent` `#0B6B54`, erro `--color-red` `#C4574A`, apoio `--color-muted` `#5C5A52`, tênue `--color-faint` `#9A9890`.
- **Tipografia:** Archivo (corpo), IBM Plex Mono (rótulos e códigos), Fraunces itálico (destaque raro).
- **Fuso horário:** toda data passa por `src/lib/timezone.ts`. Nunca usar `new Date()` cru para decidir "hoje", início de semana, mês ou trimestre.
- **Erros de Supabase:** toda Server Action confere `error` e lança. Nenhuma ação engole falha.
- **Duração de animação:** entre 120ms e 240ms. Todo movimento respeita `prefers-reduced-motion`.
- **Sem dados fictícios:** nenhuma migration insere cliente, tarefa, fatura ou meta de exemplo.
- **Verificação por tarefa:** `npm test`, `npx tsc --noEmit` e `npm run lint` limpos antes de cada commit.
- **Migrations:** arquivo em `supabase/migrations/` **e** aplicada via ferramenta Supabase. As duas coisas, sempre.

---

### Task 1: Blindar a lógica de maior risco com testes

A revisão de código apontou a ausência de testes como risco real — e foi exatamente assim que o bug do `runPlaybook` passou (ele contava linhas em vez de pegar o maior número, colidindo com códigos já usados sempre que alguma tarefa tinha sido excluída). Esta tarefa extrai a lógica pura de dentro das Server Actions e a cobre com testes, começando pelo caso que quebrou.

**Files:**
- Create: `src/lib/task-codes.ts`
- Create: `src/lib/task-codes.test.ts`
- Create: `src/lib/time-math.ts`
- Create: `src/lib/time-math.test.ts`
- Modify: `src/lib/data/tasks.ts`
- Modify: `src/lib/actions/time.ts`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces:
  - `highestCodeNumber(codes: string[]): number`
  - `buildSequentialCodes(prefix: string, start: number, count: number): string[]`
  - `elapsedMinutes(startedAt: string | Date, endedAt: string | Date): number`

- [ ] **Step 1: Escrever os testes dos códigos de tarefa**

Criar `src/lib/task-codes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildSequentialCodes, highestCodeNumber } from "./task-codes";

describe("highestCodeNumber", () => {
  it("devolve 0 para lista vazia", () => {
    expect(highestCodeNumber([])).toBe(0);
  });

  it("pega o maior número, não a quantidade de itens", () => {
    // O bug original: com uma tarefa excluída, a contagem (2) ficava
    // menor que o maior sufixo (5), gerando código repetido.
    expect(highestCodeNumber(["NIM-01", "NIM-05"])).toBe(5);
  });

  it("ignora sufixos não numéricos", () => {
    expect(highestCodeNumber(["NIM-01", "NIM-abc", "NIM-03"])).toBe(3);
  });

  it("lida com números de dois ou mais dígitos", () => {
    expect(highestCodeNumber(["INT-09", "INT-10", "INT-100"])).toBe(100);
  });
});

describe("buildSequentialCodes", () => {
  it("gera a quantidade pedida em sequência", () => {
    expect(buildSequentialCodes("NIM", 3, 3)).toEqual(["NIM-03", "NIM-04", "NIM-05"]);
  });

  it("preenche com zero à esquerda até dois dígitos", () => {
    expect(buildSequentialCodes("INT", 1, 1)).toEqual(["INT-01"]);
  });

  it("não trunca acima de 99", () => {
    expect(buildSequentialCodes("INT", 100, 1)).toEqual(["INT-100"]);
  });

  it("devolve lista vazia quando count é 0", () => {
    expect(buildSequentialCodes("NIM", 1, 0)).toEqual([]);
  });

  it("nunca repete um código já existente", () => {
    const existentes = ["NIM-01", "NIM-05"];
    const novos = buildSequentialCodes("NIM", highestCodeNumber(existentes) + 1, 3);
    expect(novos).toEqual(["NIM-06", "NIM-07", "NIM-08"]);
    expect(novos.some((c) => existentes.includes(c))).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./task-codes"`

- [ ] **Step 3: Implementar**

Criar `src/lib/task-codes.ts`:

```ts
/** Maior sufixo numérico entre códigos no formato PREFIXO-NN. */
export function highestCodeNumber(codes: string[]): number {
  let max = 0;
  for (const code of codes) {
    const n = parseInt(code.split("-")[1] ?? "", 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max;
}

/** `count` códigos sequenciais a partir de `start`, com dois dígitos no mínimo. */
export function buildSequentialCodes(prefix: string, start: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(start + i).padStart(2, "0")}`);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS — 9 testes novos.

- [ ] **Step 5: Fazer o código existente usar as funções testadas**

Em `src/lib/data/tasks.ts`, importar `{ buildSequentialCodes, highestCodeNumber }` de `@/lib/task-codes` e substituir os corpos:

```ts
async function highestTaskCodeNumber(supabase: Awaited<ReturnType<typeof createClient>>, prefix: string) {
  const { data } = await supabase
    .from("tasks")
    .select("code")
    .ilike("code", `${prefix}-%`)
    .order("code", { ascending: false });
  return highestCodeNumber((data ?? []).map((row) => row.code));
}

export async function nextTaskCode(clientId: string | null, isInternal: boolean) {
  const supabase = await createClient();
  const prefix = await resolveTaskCodePrefix(supabase, clientId, isInternal);
  return buildSequentialCodes(prefix, (await highestTaskCodeNumber(supabase, prefix)) + 1, 1)[0];
}

export async function nextTaskCodes(clientId: string | null, isInternal: boolean, count: number) {
  const supabase = await createClient();
  const prefix = await resolveTaskCodePrefix(supabase, clientId, isInternal);
  return buildSequentialCodes(prefix, (await highestTaskCodeNumber(supabase, prefix)) + 1, count);
}
```

- [ ] **Step 6: Escrever os testes do cálculo de horas**

Criar `src/lib/time-math.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { elapsedMinutes } from "./time-math";

describe("elapsedMinutes", () => {
  it("converte duas horas em 120 minutos", () => {
    expect(elapsedMinutes("2026-08-03T09:00:00Z", "2026-08-03T11:00:00Z")).toBe(120);
  });

  it("arredonda para o minuto mais próximo", () => {
    expect(elapsedMinutes("2026-08-03T09:00:00Z", "2026-08-03T09:01:40Z")).toBe(2);
  });

  it("nunca devolve menos de 1 minuto", () => {
    expect(elapsedMinutes("2026-08-03T09:00:00Z", "2026-08-03T09:00:05Z")).toBe(1);
  });

  it("nunca devolve valor negativo quando o fim antecede o início", () => {
    expect(elapsedMinutes("2026-08-03T11:00:00Z", "2026-08-03T09:00:00Z")).toBe(1);
  });

  it("aceita objetos Date", () => {
    expect(elapsedMinutes(new Date("2026-08-03T09:00:00Z"), new Date("2026-08-03T10:30:00Z"))).toBe(90);
  });
});
```

- [ ] **Step 7: Rodar e confirmar a falha**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./time-math"`

- [ ] **Step 8: Implementar**

Criar `src/lib/time-math.ts`:

```ts
/** Minutos entre dois instantes, arredondados, com piso de 1 minuto. */
export function elapsedMinutes(startedAt: string | Date, endedAt: string | Date): number {
  const start = typeof startedAt === "string" ? new Date(startedAt) : startedAt;
  const end = typeof endedAt === "string" ? new Date(endedAt) : endedAt;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
}
```

- [ ] **Step 9: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS — 5 testes novos.

- [ ] **Step 10: Fazer o timer usar a função testada**

Em `src/lib/actions/time.ts`, importar `{ elapsedMinutes }` de `@/lib/time-math` e, em `stopRunningTimer`, substituir o cálculo inline por:

```ts
const endedAt = new Date();
const minutes = elapsedMinutes(running.started_at, endedAt);
```

- [ ] **Step 11: Verificar**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: **16 testes passando** — 2 de timezone (já existentes) + 9 de códigos + 5 de horas. Sem erro de tipo; lint só com o aviso conhecido de fonte em `layout.tsx`.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "Extrai e testa a lógica de códigos de tarefa e cálculo de horas"
```

---

### Task 2: Sistema de avisos (toasts)

Substitui os três `alert()` nativos e o aviso improvisado do Kanban por avisos no visual da Aura, com "Desfazer" nas ações destrutivas.

**Files:**
- Create: `src/lib/toast-store.ts`
- Create: `src/lib/toast-store.test.ts`
- Create: `src/components/ui/Toast.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/components/metas/MetasClient.tsx` (remove `alert`)
- Modify: `src/components/playbooks/PlaybooksClient.tsx` (remove `alert`)
- Modify: `src/components/kanban/TaskDetailPanel.tsx` (remove `alert`)

**Interfaces:**
- Produces:
  - `type Toast = { id: string; tone: "success" | "error" | "info"; message: string; undo?: () => void }`
  - `addToast(list: Toast[], toast: Omit<Toast, "id">, id: string): Toast[]` — máximo 3, mais novo primeiro
  - `removeToast(list: Toast[], id: string): Toast[]`
  - Componente `<ToastProvider>` e hook `useToast(): { notify(tone, message, undo?): void }`

- [ ] **Step 1: Escrever o teste da fila de avisos**

Criar `src/lib/toast-store.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { addToast, removeToast, type Toast } from "./toast-store";

describe("toast-store", () => {
  it("coloca o aviso mais novo no topo", () => {
    const a = addToast([], { tone: "success", message: "primeiro" }, "1");
    const b = addToast(a, { tone: "error", message: "segundo" }, "2");
    expect(b.map((t) => t.message)).toEqual(["segundo", "primeiro"]);
  });

  it("mantém no máximo 3 avisos, descartando o mais antigo", () => {
    let list: Toast[] = [];
    for (const n of ["1", "2", "3", "4"]) {
      list = addToast(list, { tone: "info", message: n }, n);
    }
    expect(list.map((t) => t.message)).toEqual(["4", "3", "2"]);
  });

  it("remove pelo id", () => {
    const list = addToast(addToast([], { tone: "info", message: "a" }, "1"), { tone: "info", message: "b" }, "2");
    expect(removeToast(list, "1").map((t) => t.id)).toEqual(["2"]);
  });

  it("preserva a função de desfazer", () => {
    const undo = () => {};
    const list = addToast([], { tone: "success", message: "excluída", undo }, "1");
    expect(list[0].undo).toBe(undo);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./toast-store"`

- [ ] **Step 3: Implementar a fila**

Criar `src/lib/toast-store.ts`:

```ts
export type ToastTone = "success" | "error" | "info";

export type Toast = {
  id: string;
  tone: ToastTone;
  message: string;
  undo?: () => void;
};

const MAX_VISIBLE = 3;

export function addToast(list: Toast[], toast: Omit<Toast, "id">, id: string): Toast[] {
  return [{ ...toast, id }, ...list].slice(0, MAX_VISIBLE);
}

export function removeToast(list: Toast[], id: string): Toast[] {
  return list.filter((t) => t.id !== id);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test`
Expected: PASS — 4 testes de toast-store, mais os 2 de timezone.

- [ ] **Step 5: Implementar o componente**

Criar `src/components/ui/Toast.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import clsx from "clsx";
import { addToast, removeToast, type Toast, type ToastTone } from "@/lib/toast-store";

const DISMISS_MS = 5000;

type ToastContextValue = {
  notify: (tone: ToastTone, message: string, undo?: () => void) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((tone: ToastTone, message: string, undo?: () => void) => {
    setToasts((list) => addToast(list, { tone, message, undo }, crypto.randomUUID()));
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((list) => removeToast(list, id));
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// `onDismiss` recebe o id em vez de já vir amarrado a ele: uma função inline
// (`() => dismiss(t.id)`) teria identidade nova a cada render do provider, e o
// efeito abaixo reiniciaria o cronômetro de todos os avisos na tela sempre que
// um novo aviso entrasse. Com `dismiss` memoizado, cada aviso some no seu tempo.
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const id = toast.id;
  useEffect(() => {
    const timeout = setTimeout(() => onDismiss(id), DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [onDismiss, id]);

  return (
    <div
      role="status"
      className={clsx(
        "pointer-events-auto flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-[13px] shadow-lg motion-safe:animate-toast-in",
        toast.tone === "success" && "border-accent-tint-border bg-accent-tint text-accent",
        toast.tone === "error" && "border-red-tint-border bg-red-tint text-red",
        toast.tone === "info" && "border-border bg-surface text-ink"
      )}
    >
      <span>{toast.message}</span>
      {toast.undo && (
        <button
          onClick={() => {
            toast.undo?.();
            onDismiss(id);
          }}
          className="font-mono text-[11px] underline underline-offset-2 hover:opacity-70"
        >
          Desfazer
        </button>
      )}
      <button onClick={() => onDismiss(id)} className="ml-1 text-[13px] opacity-50 hover:opacity-100" aria-label="Fechar aviso">
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Adicionar a animação de entrada**

Em `src/app/globals.css`, após o bloco `.scrollbar-thin`:

```css
@keyframes toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.animate-toast-in {
  animation: toast-in 180ms ease-out;
}
```

- [ ] **Step 7: Montar o provider no layout**

Em `src/app/(app)/layout.tsx`, importar `ToastProvider` de `@/components/ui/Toast` e envolver o conteúdo do `<div className="flex h-screen w-full bg-bone">`, mantendo `Sidebar` e `Topbar` dentro dele.

- [ ] **Step 8: Trocar os três `alert()` por avisos**

Em cada arquivo, substituir a chamada e adicionar `const { notify } = useToast();` no topo do componente:

- `src/components/metas/MetasClient.tsx`: `alert("Não foi possível excluir a meta. Tente novamente.")` → `notify("error", "Não foi possível excluir a meta. Tente novamente.")`
- `src/components/playbooks/PlaybooksClient.tsx`: `alert("Não foi possível atualizar a etapa. Tente novamente.")` → `notify("error", "Não foi possível atualizar a etapa. Tente novamente.")`
- `src/components/kanban/TaskDetailPanel.tsx`: `alert("Não foi possível remover a subtarefa. Tente novamente.")` → `notify("error", "Não foi possível remover a subtarefa. Tente novamente.")`

- [ ] **Step 9: Verificar**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: testes passam, sem erro de tipo, lint só com o aviso conhecido de fonte em `layout.tsx`.

Confirmar que `grep -rn "alert(" src/` não retorna nada.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Adiciona sistema de avisos e remove alert() nativos"
```

---

### Task 3: Esqueletos de carregamento

Elimina a tela branca entre módulos. A estrutura permanece montada e só a área de conteúdo troca.

**Files:**
- Create: `src/components/ui/Skeleton.tsx`
- Create: `src/app/(app)/inicio/loading.tsx`
- Create: `src/app/(app)/kanban/loading.tsx`
- Create: `src/app/(app)/horas/loading.tsx`
- Create: `src/app/(app)/metas/loading.tsx`
- Create: `src/app/(app)/crm/loading.tsx`
- Create: `src/app/(app)/crm/[clientId]/loading.tsx`
- Create: `src/app/(app)/playbooks/loading.tsx`
- Modify: `src/app/globals.css` (animação de pulso)

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces: `<Skeleton className>`, `<SkeletonKpiRow count>`, `<SkeletonTable rows cols>`, `<SkeletonCards count>`

- [ ] **Step 1: Criar as primitivas**

Criar `src/components/ui/Skeleton.tsx`:

```tsx
import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("rounded bg-[#EDEAE2] motion-safe:animate-pulse-soft", className)} />;
}

export function SkeletonKpiRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-1.5 w-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex-1 rounded-xl border border-border bg-surface p-4">
      <div className="flex gap-3 border-b border-border pb-2">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-2 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 border-b border-border-soft py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid flex-1 grid-cols-3 gap-3.5">
      {Array.from({ length: count }).map((_, col) => (
        <div key={col} className="flex flex-col gap-2.25 rounded-xl border border-neutral-tint-border bg-neutral-tint p-2.75">
          <Skeleton className="h-2.5 w-20" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-[10px] border border-border bg-surface p-2.75">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Adicionar a animação de pulso**

Em `src/app/globals.css`:

```css
@keyframes pulse-soft {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}

.animate-pulse-soft {
  animation: pulse-soft 1.6s ease-in-out infinite;
}
```

- [ ] **Step 3: Criar os sete arquivos de carregamento**

`src/app/(app)/inicio/loading.tsx`:

```tsx
import { PageBody } from "@/components/layout/PageBody";
import { Skeleton, SkeletonKpiRow } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageBody>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3 w-72" />
      </div>
      <SkeletonKpiRow />
      <div className="grid flex-1 grid-cols-[1.55fr_1fr] gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <Skeleton className="h-2.5 w-40" />
          <div className="mt-4 flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <Skeleton className="h-2.5 w-32" />
            <Skeleton className="mt-3 h-12 w-full" />
          </div>
          <div className="flex-1 rounded-xl border border-border bg-surface p-4">
            <Skeleton className="h-2.5 w-32" />
            <Skeleton className="mt-3 h-24 w-full" />
          </div>
        </div>
      </div>
    </PageBody>
  );
}
```

`src/app/(app)/kanban/loading.tsx`:

```tsx
import { PageBody } from "@/components/layout/PageBody";
import { Skeleton, SkeletonCards } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageBody>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-28 rounded-full" />
        ))}
      </div>
      <SkeletonCards />
    </PageBody>
  );
}
```

`src/app/(app)/horas/loading.tsx`:

```tsx
import { PageBody } from "@/components/layout/PageBody";
import { Skeleton, SkeletonKpiRow, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageBody>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-3 w-72" />
        </div>
        <Skeleton className="h-9 w-72" />
      </div>
      <SkeletonKpiRow />
      <div className="grid flex-1 grid-cols-[1.75fr_1fr] gap-3.5">
        <SkeletonTable rows={5} cols={5} />
        <div className="flex flex-col gap-3.5">
          <div className="rounded-xl border border-border bg-surface p-4">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="mt-3 h-20 w-full" />
          </div>
          <div className="flex-1 rounded-xl border border-border bg-surface p-4">
            <Skeleton className="h-2.5 w-32" />
            <Skeleton className="mt-3 h-16 w-full" />
          </div>
        </div>
      </div>
    </PageBody>
  );
}
```

`src/app/(app)/metas/loading.tsx`:

```tsx
import { PageBody } from "@/components/layout/PageBody";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageBody>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-9 w-56" />
      </div>
      <div className="grid flex-1 grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-1.5 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-1.5 w-full" />
          </div>
        ))}
      </div>
    </PageBody>
  );
}
```

`src/app/(app)/crm/loading.tsx`:

```tsx
import { PageBody } from "@/components/layout/PageBody";
import { Skeleton, SkeletonKpiRow, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageBody>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-3 w-72" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="flex gap-4.5 border-b border-border pb-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-24" />
        ))}
      </div>
      <SkeletonKpiRow />
      <SkeletonTable rows={6} cols={3} />
    </PageBody>
  );
}
```

`src/app/(app)/crm/[clientId]/loading.tsx`:

```tsx
import { PageBody } from "@/components/layout/PageBody";
import { Skeleton, SkeletonKpiRow } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageBody>
      <div className="flex items-center gap-3.5">
        <Skeleton className="h-10 w-10 rounded-[10px]" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      <SkeletonKpiRow />
      <div className="grid flex-1 grid-cols-[1.6fr_1fr] gap-3.5">
        <div className="flex flex-col gap-3.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-4">
              <Skeleton className="h-2.5 w-32" />
              <Skeleton className="mt-3 h-16 w-full" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-4">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="mt-3 h-20 w-full" />
            </div>
          ))}
        </div>
      </div>
    </PageBody>
  );
}
```

`src/app/(app)/playbooks/loading.tsx`:

```tsx
import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex w-[200px] flex-none flex-col gap-2 border-r border-border bg-surface p-3">
        <Skeleton className="h-2.5 w-20" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="grid flex-1 grid-cols-[1.7fr_1fr] gap-3.5">
          <SkeletonTable rows={4} cols={4} />
          <div className="rounded-xl border border-border bg-surface p-4">
            <Skeleton className="h-2.5 w-32" />
            <Skeleton className="mt-3 h-40 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Ligar o prefetch completo no menu**

Todas as rotas do Aura são dinâmicas (`ƒ` na saída do build). No Next 16, o prefetch padrão de uma rota dinâmica vai só *até o segmento mais próximo que tenha um `loading.js`* — ou seja, os arquivos do Step 3 são o que torna o prefetch possível. Para carregar também os dados, e não apenas a casca, marcar os links do menu com `prefetch`:

Em `src/components/layout/Sidebar.tsx`, no `<Link>` dentro de `renderItem`, acrescentar a prop:

```tsx
prefetch
```

São seis links num app de duas pessoas — o custo é irrelevante e a navegação passa a parecer imediata.

- [ ] **Step 5: Verificar no navegador**

Run: `npm run dev`, abrir `http://localhost:3000/login`, e alternar entre módulos após entrar. Confirmar que a barra lateral nunca pisca e que o esqueleto aparece no lugar do conteúdo.

Se ainda não houver conta, criar uma pelo `/login` com o e-mail autorizado.

- [ ] **Step 6: Verificar build**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: tudo limpo; o build lista as rotas normalmente.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Adiciona esqueletos de carregamento em todas as rotas"
```

---

### Task 4: Vocabulário de movimento

Dá vida à interface sem atrasar ninguém, e respeita quem prefere menos animação.

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/ui/Overlay.tsx`
- Modify: `src/components/ui/Card.tsx`
- Modify: `src/components/kanban/TaskCard.tsx`

**Interfaces:**
- Consumes: as animações `toast-in` (Task 2) e `pulse-soft` (Task 3) já existentes em `globals.css`.
- Produces: classes utilitárias `.animate-slide-in`, `.animate-fade-in`, e o bloco global de `prefers-reduced-motion`.

- [ ] **Step 1: Adicionar as animações e a proteção de acessibilidade**

Em `src/app/globals.css`, ao final:

```css
@keyframes slide-in {
  from { transform: translateX(16px); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.animate-slide-in { animation: slide-in 200ms ease-out; }
.animate-fade-in  { animation: fade-in 140ms ease-out; }

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Animar painel e modal**

Em `src/components/ui/Overlay.tsx`:

- No `Slideover`, adicionar `motion-safe:animate-slide-in` à `className` do painel (o `div` com `border-l border-border bg-surface`).
- No `Modal`, adicionar `motion-safe:animate-fade-in` à `className` do container (o `div` com `rounded-xl border border-border bg-surface`).

- [ ] **Step 3: Suavizar a barra de progresso**

Em `src/components/ui/Card.tsx`, no `ProgressBar`, adicionar `transition-[width] duration-200 ease-out` à `className` da barra interna (o `div` com `style={{ width }}`).

- [ ] **Step 4: Dar realce ao card arrastado**

Em `src/components/kanban/TaskCard.tsx`, na `className` do card, trocar o realce estático por transição — acrescentar `transition-shadow duration-150 hover:shadow-[0_2px_8px_rgba(30,30,28,.10)]` e, quando `isDragging`, aplicar também `shadow-[0_8px_24px_rgba(30,30,28,.18)]`.

- [ ] **Step 5: Indicadores contam até o valor**

O spec pede que os números dos indicadores contem até o valor. Isso exige um componente cliente, então o alcance fica contido a um único arquivo pequeno, usado só no valor do KPI.

Criar `src/components/ui/CountUp.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 240;

/** Anima de 0 até `value` uma única vez. `format` controla a exibição. */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  // Começa em 0, não em `value`: iniciar com o valor final faria o primeiro
  // paint mostrar o número certo e o efeito o jogaria de volta para perto de
  // zero no primeiro quadro — o KPI piscaria correto, zeraria e recontaria.
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      setShown(value * progress);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{format(shown)}</>;
}
```

Usar em `src/app/(app)/inicio/page.tsx` apenas no KPI de faturamento e no de "a cobrar", que são os dois números que mudam com significado:

```tsx
value={<CountUp value={data.monthRevenue} format={formatCurrency} />}
```

Deixar os demais indicadores estáticos — animar contadores que raramente mudam vira ruído.

- [ ] **Step 6: Verificar**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: tudo limpo.

Abrir o app e confirmar: o painel da tarefa desliza, o modal aparece com fade, a barra de progresso anima ao mudar valor, e o faturamento conta até o número ao carregar o Início.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Adiciona vocabulário de movimento com respeito a prefers-reduced-motion"
```

---

### Task 5: Mecânica otimista no Kanban

O card muda de coluna no instante em que você solta. O servidor confirma depois; se recusar, o card volta e um aviso explica.

**Files:**
- Create: `src/lib/optimistic.ts`
- Create: `src/lib/optimistic.test.ts`
- Modify: `src/components/kanban/KanbanBoard.tsx`

**Interfaces:**
- Consumes: `useToast()` de `@/components/ui/Toast` (Task 2).
- Produces:
  - `type ColumnId = "todo" | "in_progress" | "done"`
  - `type Columns<T> = Record<ColumnId, T[]>`
  - `moveItem<T extends { id: string }>(columns: Columns<T>, itemId: string, toColumn: ColumnId, beforeItemId: string | null): Columns<T>`
  - `reorderWithin<T extends { id: string }>(items: T[], activeId: string, overId: string): T[]`

- [ ] **Step 1: Escrever os testes de movimentação**

Criar `src/lib/optimistic.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { moveItem, reorderWithin, type Columns } from "./optimistic";

type Item = { id: string };

function makeColumns(): Columns<Item> {
  return {
    todo: [{ id: "a" }, { id: "b" }],
    in_progress: [{ id: "c" }],
    done: [],
  };
}

describe("reorderWithin", () => {
  it("move um item para a posição de outro", () => {
    const result = reorderWithin([{ id: "a" }, { id: "b" }, { id: "c" }], "c", "a");
    expect(result.map((i) => i.id)).toEqual(["c", "a", "b"]);
  });

  it("devolve a lista intacta quando o id não existe", () => {
    const items = [{ id: "a" }, { id: "b" }];
    expect(reorderWithin(items, "z", "a").map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("moveItem", () => {
  it("move entre colunas inserindo antes do item indicado", () => {
    const result = moveItem(makeColumns(), "a", "in_progress", "c");
    expect(result.todo.map((i) => i.id)).toEqual(["b"]);
    expect(result.in_progress.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("acrescenta ao fim quando não há item de referência", () => {
    const result = moveItem(makeColumns(), "a", "done", null);
    expect(result.done.map((i) => i.id)).toEqual(["a"]);
    expect(result.todo.map((i) => i.id)).toEqual(["b"]);
  });

  it("reordena dentro da mesma coluna", () => {
    const result = moveItem(makeColumns(), "b", "todo", "a");
    expect(result.todo.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("devolve o estado intacto quando o item não existe", () => {
    const before = makeColumns();
    const result = moveItem(before, "inexistente", "done", null);
    expect(result).toEqual(before);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./optimistic"`

- [ ] **Step 3: Implementar**

Criar `src/lib/optimistic.ts`:

```ts
export type ColumnId = "todo" | "in_progress" | "done";
export type Columns<T> = Record<ColumnId, T[]>;

const COLUMN_IDS: ColumnId[] = ["todo", "in_progress", "done"];

export function reorderWithin<T extends { id: string }>(items: T[], activeId: string, overId: string): T[] {
  const from = items.findIndex((i) => i.id === activeId);
  const to = items.findIndex((i) => i.id === overId);
  if (from === -1 || to === -1) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function moveItem<T extends { id: string }>(
  columns: Columns<T>,
  itemId: string,
  toColumn: ColumnId,
  beforeItemId: string | null
): Columns<T> {
  const fromColumn = COLUMN_IDS.find((id) => columns[id].some((i) => i.id === itemId));
  if (!fromColumn) return columns;

  if (fromColumn === toColumn && beforeItemId) {
    return { ...columns, [toColumn]: reorderWithin(columns[toColumn], itemId, beforeItemId) };
  }

  const item = columns[fromColumn].find((i) => i.id === itemId)!;
  const stripped = columns[fromColumn].filter((i) => i.id !== itemId);
  const target = fromColumn === toColumn ? stripped : [...columns[toColumn]];
  const insertAt = beforeItemId ? target.findIndex((i) => i.id === beforeItemId) : -1;
  const next = [...target];
  next.splice(insertAt === -1 ? next.length : insertAt, 0, item);

  return { ...columns, [fromColumn]: stripped, [toColumn]: next };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS — 6 testes novos.

- [ ] **Step 5: Ligar o Kanban à mecânica**

Em `src/components/kanban/KanbanBoard.tsx`:

- Importar `moveItem`, `reorderWithin` e o tipo `Columns` de `@/lib/optimistic`, e `useToast` de `@/components/ui/Toast`.
- Remover o estado `dragError` e o `useEffect` que o limpa, além do `div` de aviso flutuante e do fragmento `<>...</>` que o envolvia — o aviso agora vem do toast.
- Substituir o corpo de `handleDragOver` e `handleDragEnd` pelas funções puras: em `handleDragOver`, `setColumns((prev) => moveItem(prev, String(active.id), overCol, String(over.id)))`; em `handleDragEnd`, calcular o estado final com `moveItem`/`reorderWithin` e enviar ao servidor.
- No `catch` da chamada a `updateTaskPosition`, reverter para `dragStartColumns` e chamar `notify("error", "Não foi possível mover a tarefa. Ela voltou para a posição anterior.")`.

- [ ] **Step 6: Verificar**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: tudo limpo.

No navegador: arrastar um card entre colunas e confirmar que ele se fixa instantaneamente, sem esperar o servidor.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Extrai movimentação otimista para funções puras testadas e liga ao Kanban"
```

---

### Task 6: Resposta imediata nas demais ações

Estende a sensação de instantâneo às ações de alta frequência fora do quadro.

**Files:**
- Modify: `src/components/inicio/TaskQuickItem.tsx`
- Modify: `src/components/kanban/TaskDetailPanel.tsx`
- Modify: `src/components/metas/MetasClient.tsx`
- Modify: `src/components/crm/CrmClient.tsx`

**Interfaces:**
- Consumes: `useToast()` (Task 2).
- Produces: nenhuma interface nova; muda comportamento dos componentes existentes.

- [ ] **Step 1: Concluir tarefa no Início responde na hora**

Em `src/components/inicio/TaskQuickItem.tsx`, envolver o componente com `useOptimistic`:

```tsx
const [optimisticDone, setOptimisticDone] = useOptimistic(false);
```

No `onClick` do botão, dentro do `startTransition`, chamar `setOptimisticDone(true)` **antes** do `await updateTask(...)`. Quando `optimisticDone` for verdadeiro, aplicar `line-through` e `opacity-50` ao título. No `catch`, notificar `notify("error", "Não foi possível concluir a tarefa.")`.

Importar `useOptimistic` de `react`.

- [ ] **Step 2: Subtarefas respondem na hora**

Em `src/components/kanban/TaskDetailPanel.tsx`, criar um estado otimista da lista de subtarefas:

```tsx
const [optimisticChecklist, toggleOptimistic] = useOptimistic(
  detail.checklist,
  (list, { id, done }: { id: string; done: boolean }) =>
    list.map((item) => (item.id === id ? { ...item, done } : item))
);
```

Renderizar a partir de `optimisticChecklist`, e no `onClick` chamar `toggleOptimistic({ id: item.id, done: !item.done })` antes do `await toggleChecklistItem(...)`. Ajustar `doneCount` para contar sobre `optimisticChecklist`.

- [ ] **Step 3: Progresso de meta responde na hora**

Em `src/components/metas/MetasClient.tsx`, no `GoalRowItem`, adicionar:

```tsx
const [optimisticCurrent, setOptimisticCurrent] = useOptimistic(goal.current);
```

Usar `optimisticCurrent` no cálculo de `pct` e na exibição. No envio do formulário, chamar `setOptimisticCurrent(parsed)` antes do `await updateGoalProgress(...)`, e notificar erro no `catch`.

- [ ] **Step 4: Status de fatura e etapa de negócio respondem na hora**

Em `src/components/crm/CrmClient.tsx`:

- Faturas: `const [optimisticInvoices, setInvoiceStatus] = useOptimistic(invoices, (list, { id, status }: { id: string; status: string }) => list.map((i) => (i.id === id ? { ...i, status } : i)));` — renderizar a tabela a partir de `optimisticInvoices` e aplicar antes do `await markInvoiceStatus(...)`.
- Pipeline: mesmo padrão sobre `deals` com a chave `stage`, aplicado antes do `await updateDealStage(...)`.
- Nos dois casos, `catch` chama `notify("error", …)` com mensagem específica.

- [ ] **Step 5: Verificar**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: tudo limpo.

No navegador, confirmar que marcar subtarefa, concluir tarefa no Início, alterar meta e mudar status de fatura refletem sem espera.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Aplica resposta imediata nas ações de alta frequência"
```

---

### Task 7: Histórico real da tarefa

Substitui o texto fixo por um registro verdadeiro da vida da tarefa.

**Files:**
- Create: `supabase/migrations/0007_task_history.sql`
- Modify: `src/lib/supabase/database.types.ts` (campo `task_id` em `activity_log`)
- Modify: `src/lib/actions/activity.ts`
- Modify: `src/lib/actions/tasks.ts`
- Modify: `src/lib/actions/time.ts`
- Modify: `src/lib/data/tasks.ts`
- Modify: `src/components/kanban/TaskDetailPanel.tsx`

**Interfaces:**
- Consumes: `logActivity(supabase, userId, verb, detail)` já existente.
- Produces:
  - `logActivity(supabase, userId, verb, detail?, taskId?)` — assinatura estendida, `taskId` opcional
  - `getTaskHistory(taskId)` em `src/lib/data/tasks.ts`, retorna `(Tables<"activity_log"> & { user: { full_name: string; initials: string } | null })[]`

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/0007_task_history.sql`:

```sql
-- Permite que um evento do registro de atividade pertença a uma tarefa,
-- alimentando a aba Histórico sem criar uma tabela paralela.
alter table public.activity_log
  add column task_id uuid references public.tasks(id) on delete cascade;

create index activity_log_task_idx on public.activity_log (task_id, created_at desc);
```

- [ ] **Step 2: Aplicar a migration**

Aplicar via ferramenta Supabase `apply_migration` no projeto `pknooqhosbieqgjzwtww`, com nome `0007_task_history` e o conteúdo acima.

Confirmar com `execute_sql`: `select column_name from information_schema.columns where table_name = 'activity_log';` — deve listar `task_id`.

- [ ] **Step 3: Atualizar os tipos**

Em `src/lib/supabase/database.types.ts`, no bloco `activity_log`, acrescentar `task_id: string | null` em `Row`, e `task_id?: string | null` em `Insert` e `Update`.

- [ ] **Step 4: Estender o registro de atividade**

Em `src/lib/actions/activity.ts`:

```ts
export async function logActivity(
  supabase: SupabaseClient<Database>,
  userId: string | null,
  verb: string,
  detail?: string,
  taskId?: string
) {
  await supabase.from("activity_log").insert({
    user_id: userId,
    verb,
    detail: detail ?? null,
    task_id: taskId ?? null,
  });
}
```

- [ ] **Step 5: Registrar os eventos da tarefa**

Em `src/lib/actions/tasks.ts`, acrescentar chamadas a `logActivity` com o `taskId`:

- `createTask`: já chama; adicionar `task.id` como quinto argumento.
- `updateTaskPosition`: já chama na mudança de status; adicionar `input.taskId`.
- `updateTask`: após o update bem-sucedido, registrar o campo alterado. Para `assignee_id`, verbo `"trocou o responsável de"`; para `due_date`, `"mudou o prazo de"`; para `status` igual a `"done"`, `"concluiu"`. Passar o título da tarefa como `detail` e `taskId` como quinto argumento.
- `toggleChecklistItem`: quando `done` for verdadeiro, registrar `"concluiu a subtarefa"` com o título do item; buscar `task_id` do item para passar adiante.

Em `src/lib/actions/time.ts`, em `stopRunningTimer` e `logManualTime`, registrar `"lançou horas em"` com a quantidade em `detail` e o `task_id` da entrada.

- [ ] **Step 6: Buscar o histórico**

Em `src/lib/data/tasks.ts`, acrescentar:

```ts
export async function getTaskHistory(taskId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_log")
    .select("*, user:profiles(id, full_name, initials)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
```

Em `getTaskDetail`, incluir `getTaskHistory(id)` no `Promise.all` e devolver `history` no objeto de retorno.

- [ ] **Step 7: Exibir o histórico**

Em `src/components/kanban/TaskDetailPanel.tsx`, substituir a linha do stub:

```tsx
{tab === "historico" && <p className="text-[12.5px] text-faint">Sem histórico registrado ainda.</p>}
```

por:

```tsx
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
          <div className="mt-0.5 font-mono text-[11px] text-faint">{formatRelative(event.created_at)}</div>
        </div>
      </div>
    ))}
  </div>
)}
```

Acrescentar `history` ao tipo `TaskDetail` no topo do arquivo e importar `formatRelative` de `@/lib/format`.

- [ ] **Step 8: Verificar**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: tudo limpo.

No navegador: criar uma tarefa, mudar responsável e prazo, concluir uma subtarefa, e conferir os quatro eventos na aba Histórico.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Registra e exibe o histórico real de cada tarefa"
```

---

### Task 8: Timer visível em qualquer tela

O timer para de sumir ao navegar, e avisa quando fica esquecido.

**Files:**
- Create: `src/components/layout/TimerWidget.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/components/layout/Topbar.tsx`
- Modify: `src/components/kanban/TaskCard.tsx`
- Modify: `src/lib/data/tasks.ts`
- Modify: `src/app/(app)/kanban/page.tsx`

**Interfaces:**
- Consumes: `getRunningTimer(userId)` de `@/lib/data/time`; `stopRunningTimer()` de `@/lib/actions/time`; `formatDuration(seconds)` de `@/lib/format`.
- Produces: `<TimerWidget running={{ id, started_at, taskTitle, clientName } | null} />`

- [ ] **Step 1: Criar o indicador**

Criar `src/components/layout/TimerWidget.tsx`:

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDuration } from "@/lib/format";
import { stopRunningTimer } from "@/lib/actions/time";
import { useToast } from "@/components/ui/Toast";

const EIGHT_HOURS_SECONDS = 8 * 3600;

export type RunningTimer = {
  id: string;
  started_at: string;
  taskTitle: string | null;
  clientName: string | null;
};

export function TimerWidget({ running }: { running: RunningTimer | null }) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(running.started_at).getTime()) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [running]);

  if (!running) return null;

  const forgotten = elapsed > EIGHT_HOURS_SECONDS;
  const label = running.taskTitle ?? running.clientName ?? "Interno";

  return (
    <div
      className={
        "flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 " +
        (forgotten ? "border-red-tint-border bg-red-tint" : "border-accent-tint-border bg-accent-tint")
      }
      title={forgotten ? "Timer rodando há mais de 8 horas — provavelmente esquecido" : label}
    >
      <span className={"h-1.5 w-1.5 flex-none rounded-full motion-safe:animate-pulse-soft " + (forgotten ? "bg-red" : "bg-accent")} />
      <span className={"max-w-[140px] truncate text-[12px] " + (forgotten ? "text-red" : "text-accent")}>{label}</span>
      <span className={"font-mono text-[12px] font-semibold " + (forgotten ? "text-red" : "text-accent")}>
        {formatDuration(elapsed)}
      </span>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await stopRunningTimer();
              notify("success", "Timer parado e horas registradas.");
              router.refresh();
            } catch {
              notify("error", "Não foi possível parar o timer.");
            }
          })
        }
        className={"font-mono text-[11px] underline underline-offset-2 " + (forgotten ? "text-red" : "text-accent")}
      >
        parar
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Buscar o timer no layout**

Em `src/app/(app)/layout.tsx`, importar `getRunningTimer` de `@/lib/data/time`, chamá-lo com `profile.id`, e montar o objeto `RunningTimer`:

```tsx
const timer = await getRunningTimer(profile.id);
const running = timer
  ? {
      id: timer.id,
      started_at: timer.started_at,
      taskTitle: timer.task?.title ?? null,
      clientName: timer.client?.name ?? null,
    }
  : null;
```

Passar `running` como prop para `<Topbar>`.

- [ ] **Step 3: Exibir na barra superior**

Em `src/components/layout/Topbar.tsx`, aceitar a prop `running: RunningTimer | null`, importar `TimerWidget`, e renderizá-lo imediatamente antes do `<Avatar>`.

- [ ] **Step 4: Marcar o card cronometrado**

Em `src/lib/data/tasks.ts`, dentro de `listTasks`, não há mudança. Em `src/app/(app)/kanban/page.tsx`, buscar o id da tarefa cronometrada e repassá-lo:

```tsx
const runningTimer = await getRunningTimer(profile.id);
const runningTaskId = runningTimer?.task_id ?? null;
```

Repassar `runningTaskId` até `TaskCard` via `KanbanClient` e `KanbanBoard`. Em `src/components/kanban/TaskCard.tsx`, quando `task.id === runningTaskId`, renderizar um ponto pulsando ao lado do código:

```tsx
{isRunning && <span className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-pulse-soft" title="Timer rodando" />}
```

`src/app/(app)/kanban/page.tsx` precisa importar `requireProfile` de `@/lib/data/profile` e `getRunningTimer` de `@/lib/data/time`.

- [ ] **Step 5: Verificar**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: tudo limpo.

No navegador: iniciar um timer em Horas, navegar até CRM e Kanban, e confirmar que o contador continua visível na barra superior e que o card correspondente exibe o ponto pulsando.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Torna o timer visível em qualquer tela e sinaliza timer esquecido"
```

---

### Task 9: Sino de avisos

Reúne o que exige ação, derivando tudo de dados existentes.

**Files:**
- Create: `src/lib/notifications.ts`
- Create: `src/lib/notifications.test.ts`
- Create: `src/lib/data/notifications.ts`
- Create: `src/components/layout/NotificationBell.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/components/layout/Topbar.tsx`

**Interfaces:**
- Consumes: `todayInAppTz()` de `@/lib/timezone`.
- Produces:
  - `type AppNotification = { id: string; tone: "red" | "amber" | "neutral"; title: string; detail: string; href: string }`
  - `buildNotifications(input: NotificationInput, today: string): AppNotification[]`
  - `getNotifications(userId: string): Promise<AppNotification[]>`

- [ ] **Step 1: Escrever os testes da derivação**

Criar `src/lib/notifications.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildNotifications } from "./notifications";

const TODAY = "2026-08-03";

describe("buildNotifications", () => {
  it("lista fatura vencida como urgente", () => {
    const result = buildNotifications(
      {
        overdueInvoices: [{ id: "i1", clientId: "c1", clientName: "Nimbus", amount: 4200, dueDate: "2026-07-15" }],
        myOpenTasks: [],
        endingContracts: [],
        runningTimerStartedAt: null,
      },
      TODAY
    );
    expect(result).toHaveLength(1);
    expect(result[0].tone).toBe("red");
    expect(result[0].href).toBe("/crm/c1");
  });

  it("separa tarefa atrasada de tarefa que vence hoje", () => {
    const result = buildNotifications(
      {
        overdueInvoices: [],
        myOpenTasks: [
          { id: "t1", title: "Atrasada", dueDate: "2026-08-01" },
          { id: "t2", title: "Hoje", dueDate: TODAY },
          { id: "t3", title: "Futura", dueDate: "2026-08-20" },
        ],
        endingContracts: [],
        runningTimerStartedAt: null,
      },
      TODAY
    );
    expect(result.map((n) => n.title)).toEqual(["Atrasada", "Hoje"]);
    expect(result[0].tone).toBe("red");
    expect(result[1].tone).toBe("amber");
  });

  it("avisa sobre timer rodando há mais de 8 horas", () => {
    const nineHoursAgo = new Date(Date.now() - 9 * 3600 * 1000).toISOString();
    const result = buildNotifications(
      { overdueInvoices: [], myOpenTasks: [], endingContracts: [], runningTimerStartedAt: nineHoursAgo },
      TODAY
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("timer-esquecido");
  });

  it("ignora timer recente", () => {
    const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    const result = buildNotifications(
      { overdueInvoices: [], myOpenTasks: [], endingContracts: [], runningTimerStartedAt: oneHourAgo },
      TODAY
    );
    expect(result).toHaveLength(0);
  });

  it("devolve lista vazia quando não há nada a fazer", () => {
    expect(
      buildNotifications(
        { overdueInvoices: [], myOpenTasks: [], endingContracts: [], runningTimerStartedAt: null },
        TODAY
      )
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./notifications"`

- [ ] **Step 3: Implementar a derivação**

Criar `src/lib/notifications.ts`:

```ts
export type AppNotification = {
  id: string;
  tone: "red" | "amber" | "neutral";
  title: string;
  detail: string;
  href: string;
};

export type NotificationInput = {
  overdueInvoices: { id: string; clientId: string; clientName: string; amount: number; dueDate: string }[];
  myOpenTasks: { id: string; title: string; dueDate: string | null }[];
  endingContracts: { id: string; clientId: string; clientName: string; endDate: string }[];
  runningTimerStartedAt: string | null;
};

const EIGHT_HOURS_MS = 8 * 3600 * 1000;

function currency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

export function buildNotifications(input: NotificationInput, today: string): AppNotification[] {
  const out: AppNotification[] = [];

  for (const invoice of input.overdueInvoices) {
    out.push({
      id: `fatura-${invoice.id}`,
      tone: "red",
      title: `${invoice.clientName} · fatura vencida`,
      detail: `${currency(invoice.amount)} · venceu em ${invoice.dueDate}`,
      href: `/crm/${invoice.clientId}`,
    });
  }

  for (const task of input.myOpenTasks) {
    if (!task.dueDate) continue;
    if (task.dueDate < today) {
      out.push({
        id: `tarefa-${task.id}`,
        tone: "red",
        title: task.title,
        detail: "Atrasada",
        href: `/kanban?task=${task.id}`,
      });
    } else if (task.dueDate === today) {
      out.push({
        id: `tarefa-${task.id}`,
        tone: "amber",
        title: task.title,
        detail: "Vence hoje",
        href: `/kanban?task=${task.id}`,
      });
    }
  }

  for (const contract of input.endingContracts) {
    out.push({
      id: `contrato-${contract.id}`,
      tone: "neutral",
      title: `Contrato ${contract.clientName} termina em breve`,
      detail: `Até ${contract.endDate}`,
      href: `/crm/${contract.clientId}`,
    });
  }

  if (input.runningTimerStartedAt) {
    const elapsed = Date.now() - new Date(input.runningTimerStartedAt).getTime();
    if (elapsed > EIGHT_HOURS_MS) {
      out.push({
        id: "timer-esquecido",
        tone: "amber",
        title: "Timer rodando há mais de 8 horas",
        detail: "Provavelmente esquecido — confira antes que distorça a rentabilidade",
        href: "/horas",
      });
    }
  }

  return out;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS — 5 testes novos.

- [ ] **Step 5: Buscar os dados**

Criar `src/lib/data/notifications.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { buildNotifications, type AppNotification } from "@/lib/notifications";
import { todayInAppTz } from "@/lib/timezone";

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const supabase = await createClient();
  const today = todayInAppTz();
  const in30Days = new Date(new Date(today + "T00:00:00Z").getTime() + 30 * 86400000).toISOString().slice(0, 10);

  const [{ data: invoices }, { data: tasks }, { data: contracts }, { data: timer }] = await Promise.all([
    supabase.from("invoices").select("id, client_id, amount, due_date, client:clients(name)").eq("status", "overdue"),
    supabase.from("tasks").select("id, title, due_date").eq("assignee_id", userId).neq("status", "done"),
    supabase
      .from("contracts")
      .select("id, client_id, end_date, client:clients(name)")
      .eq("status", "active")
      .not("end_date", "is", null)
      .lte("end_date", in30Days)
      .gte("end_date", today),
    supabase.from("time_entries").select("started_at").eq("user_id", userId).is("ended_at", null).maybeSingle(),
  ]);

  return buildNotifications(
    {
      overdueInvoices: (invoices ?? []).map((i) => ({
        id: i.id,
        clientId: i.client_id,
        clientName: i.client?.name ?? "Cliente",
        amount: Number(i.amount),
        dueDate: i.due_date,
      })),
      myOpenTasks: (tasks ?? []).map((t) => ({ id: t.id, title: t.title, dueDate: t.due_date })),
      endingContracts: (contracts ?? []).map((c) => ({
        id: c.id,
        clientId: c.client_id,
        clientName: c.client?.name ?? "Cliente",
        endDate: c.end_date!,
      })),
      runningTimerStartedAt: timer?.started_at ?? null,
    },
    today
  );
}
```

- [ ] **Step 6: Criar o sino**

Criar `src/components/layout/NotificationBell.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { AppNotification } from "@/lib/notifications";

export function NotificationBell({ notifications }: { notifications: AppNotification[] }) {
  const [open, setOpen] = useState(false);
  const urgent = notifications.some((n) => n.tone === "red");

  return (
    <div className="relative flex">
      <button onClick={() => setOpen((v) => !v)} className="relative flex text-muted hover:text-ink" aria-label="Avisos">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M4.4 7a3.6 3.6 0 0 1 7.2 0v2.6l1 1.6H3.4l1-1.6z" />
          <path d="M6.6 12.6a1.5 1.5 0 0 0 2.8 0" />
        </svg>
        {notifications.length > 0 && (
          <span className={"absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full " + (urgent ? "bg-red" : "bg-amber")} />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-50 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-xl motion-safe:animate-fade-in">
            <div className="border-b border-border px-3.5 py-2.5">
              <span className="label">PRECISA DE VOCÊ</span>
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              {notifications.length === 0 && (
                <div className="px-3.5 py-6 text-center text-[12.5px] text-faint">Tudo em dia por aqui.</div>
              )}
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2.5 border-b border-border-soft px-3.5 py-2.5 last:border-b-0 hover:bg-neutral-tint"
                >
                  <span
                    className={
                      "mt-1 h-1.5 w-1.5 flex-none rounded-full " +
                      (n.tone === "red" ? "bg-red" : n.tone === "amber" ? "bg-amber" : "bg-faint")
                    }
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{n.title}</div>
                    <div className="font-mono text-[11px] text-muted">{n.detail}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Ligar ao layout**

Em `src/app/(app)/layout.tsx`, chamar `getNotifications(profile.id)` e passar o resultado a `<Topbar>`. Em `src/components/layout/Topbar.tsx`, aceitar `notifications: AppNotification[]` e renderizar `<NotificationBell notifications={notifications} />` antes do `TimerWidget`.

- [ ] **Step 8: Verificar**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: tudo limpo.

No navegador: criar uma fatura com status "Atrasada" e conferir que o sino ganha ponto vermelho e lista a fatura.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Adiciona sino de avisos derivado dos dados existentes"
```

---

### Task 10: Anexos com arquivo e link

Torna alcançável a capacidade que hoje só existe no backend.

**Files:**
- Create: `supabase/migrations/0008_attachments_storage.sql`
- Create: `src/components/kanban/Attachments.tsx`
- Modify: `src/lib/actions/tasks.ts`
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `src/components/kanban/TaskDetailPanel.tsx`

**Interfaces:**
- Consumes: `addAttachment(taskId, filename, url)` já existente em `src/lib/actions/tasks.ts`.
- Produces:
  - `addLinkAttachment(taskId: string, filename: string, url: string): Promise<void>`
  - `removeAttachment(attachmentId: string, storagePath: string | null): Promise<void>`
  - `<Attachments taskId attachments />`

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/0008_attachments_storage.sql`:

```sql
-- Anexos passam a admitir arquivo hospedado (storage_path) além de link (url).
alter table public.task_attachments add column storage_path text;

insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

create policy "aura_read_attachments" on storage.objects
  for select using (bucket_id = 'task-attachments' and auth.uid() is not null);

create policy "aura_write_attachments" on storage.objects
  for insert with check (bucket_id = 'task-attachments' and auth.uid() is not null);

create policy "aura_delete_attachments" on storage.objects
  for delete using (bucket_id = 'task-attachments' and auth.uid() is not null);
```

- [ ] **Step 2: Aplicar a migration**

Aplicar via ferramenta Supabase `apply_migration`, nome `0008_attachments_storage`.

Confirmar com `execute_sql`: `select id, public from storage.buckets where id = 'task-attachments';` — deve devolver uma linha com `public = false`.

- [ ] **Step 3: Atualizar os tipos**

Em `src/lib/supabase/database.types.ts`, no bloco `task_attachments`, acrescentar `storage_path: string | null` em `Row` e `storage_path?: string | null` em `Insert` e `Update`.

- [ ] **Step 4: Escrever as três ações**

Em `src/lib/actions/tasks.ts`, substituir `addAttachment` pelas três abaixo. Escrevê-las **antes** do componente, para que ele possa importá-las estaticamente:

```ts
export async function addLinkAttachment(taskId: string, filename: string, url: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_attachments")
    .insert({ task_id: taskId, filename, url, storage_path: null });
  if (error) throw error;
  revalidatePath("/kanban");
}

export async function addFileAttachment(taskId: string, filename: string, url: string, storagePath: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_attachments")
    .insert({ task_id: taskId, filename, url, storage_path: storagePath });
  if (error) throw error;
  revalidatePath("/kanban");
}

export async function removeAttachment(attachmentId: string, storagePath: string | null) {
  const supabase = await createClient();
  if (storagePath) {
    await supabase.storage.from("task-attachments").remove([storagePath]);
  }
  const { error } = await supabase.from("task_attachments").delete().eq("id", attachmentId);
  if (error) throw error;
  revalidatePath("/kanban");
}
```

- [ ] **Step 5: Criar a interface de anexos**

Criar `src/components/kanban/Attachments.tsx`:

```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addFileAttachment, addLinkAttachment, removeAttachment } from "@/lib/actions/tasks";
import { useToast } from "@/components/ui/Toast";
import type { Tables } from "@/lib/supabase/database.types";

export function Attachments({
  taskId,
  attachments,
}: {
  taskId: string;
  attachments: Tables<"task_attachments">[];
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    const supabase = createClient();
    const path = `${taskId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("task-attachments").upload(path, file);
    setUploading(false);
    if (error) {
      notify("error", "Não foi possível enviar o arquivo.");
      return;
    }
    const { data } = supabase.storage.from("task-attachments").getPublicUrl(path);
    startTransition(async () => {
      try {
        await addFileAttachment(taskId, file.name, data.publicUrl, path);
        notify("success", "Arquivo anexado.");
        router.refresh();
      } catch {
        notify("error", "Não foi possível registrar o anexo.");
      }
    });
  }

  return (
    <div>
      <div className="label mb-1.5">ANEXOS</div>
      <div className="flex flex-wrap gap-2">
        {attachments.map((a) => (
          <span
            key={a.id}
            className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted"
          >
            <a href={a.url ?? "#"} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
              {a.filename}
            </a>
            <button
              onClick={() =>
                startTransition(async () => {
                  try {
                    await removeAttachment(a.id, a.storage_path);
                    router.refresh();
                  } catch {
                    notify("error", "Não foi possível remover o anexo.");
                  }
                })
              }
              className="hidden text-faint hover:text-red group-hover:block"
              aria-label={`Remover ${a.filename}`}
            >
              ✕
            </button>
          </span>
        ))}

        <input
          ref={fileInput}
          type="file"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
        <button
          disabled={uploading || pending}
          onClick={() => fileInput.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-faint hover:border-faint"
        >
          {uploading ? "Enviando…" : "+ arquivo"}
        </button>
        <button
          onClick={() => setLinkOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-faint hover:border-faint"
        >
          + link
        </button>
      </div>

      {linkOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!linkUrl.trim()) return;
            startTransition(async () => {
              try {
                await addLinkAttachment(taskId, linkName.trim() || linkUrl.trim(), linkUrl.trim());
                setLinkUrl("");
                setLinkName("");
                setLinkOpen(false);
                notify("success", "Link anexado.");
                router.refresh();
              } catch {
                notify("error", "Não foi possível anexar o link.");
              }
            });
          }}
          className="mt-2 flex gap-2"
        >
          <input
            autoFocus
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            placeholder="Nome"
            className="w-28 rounded-lg border border-border bg-bone px-2 py-1.5 text-xs outline-none focus:border-accent"
          />
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://figma.com/…"
            className="flex-1 rounded-lg border border-border bg-bone px-2 py-1.5 text-xs outline-none focus:border-accent"
          />
          <button type="submit" disabled={pending} className="rounded-lg bg-accent px-3 text-xs text-bone">
            Anexar
          </button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Montar no painel da tarefa**

Em `src/components/kanban/TaskDetailPanel.tsx`, importar `Attachments` e renderizar `<Attachments taskId={t.id} attachments={detail.attachments} />` logo após o bloco de subtarefas, dentro da aba "detalhes".

- [ ] **Step 7: Verificar**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: tudo limpo.

No navegador: anexar um PDF pequeno e um link do Figma numa tarefa, recarregar a página, e confirmar que ambos persistem e abrem.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Torna anexos alcançáveis com upload de arquivo e link"
```

---

### Task 11: Leitura no celular

Faz o sistema caber na tela pequena, com três ações preservadas.

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/Topbar.tsx`
- Modify: `src/components/layout/PageBody.tsx`
- Modify: `src/components/crm/CrmClient.tsx`
- Modify: `src/components/kanban/KanbanClient.tsx`
- Modify: `src/app/(app)/horas/page.tsx`
- Modify: `src/app/(app)/inicio/page.tsx`

**Interfaces:**
- Consumes: componentes existentes.
- Produces: `<MobileNavToggle>` exportado de `src/components/layout/Sidebar.tsx`.

- [ ] **Step 1: Barra lateral vira gaveta**

Em `src/components/layout/Sidebar.tsx`:

- Transformar o contêiner em `fixed inset-y-0 left-0 z-50 w-[236px] -translate-x-full transition-transform duration-200 md:static md:translate-x-0`, controlado por um estado `open` recebido por prop.
- Exportar `MobileNavToggle({ onClick })`, um botão com ícone de três linhas visível apenas em `md:hidden`.
- Quando aberta no celular, renderizar um fundo escurecido `fixed inset-0 z-40 bg-ink/20 md:hidden` que fecha ao clique.

Em `src/app/(app)/layout.tsx`, criar um componente cliente fino que segura o estado `open` e conecta `MobileNavToggle` (na `Topbar`) à `Sidebar`.

- [ ] **Step 2: Grades de indicadores empilham**

Substituir toda ocorrência de `grid-cols-4 gap-3` nos blocos de KPI por `grid-cols-2 gap-3 md:grid-cols-4` — arquivos: `src/app/(app)/inicio/page.tsx`, `src/app/(app)/horas/page.tsx`, `src/components/crm/CrmClient.tsx`.

Substituir os layouts de duas colunas `grid-cols-[1.55fr_1fr]`, `grid-cols-[1.75fr_1fr]` e `grid-cols-[1.6fr_1fr]` por `grid-cols-1 md:grid-cols-[…]` com o valor original preservado após o `md:`.

- [ ] **Step 3: Tabelas viram cartões no celular**

Em `src/components/crm/CrmClient.tsx`, nas abas "clientes" e "faturas", envolver o cabeçalho da tabela em `hidden md:grid` e dar às linhas `flex flex-col gap-1 md:grid md:grid-cols-[…]`, com rótulo curto antes de cada valor visível apenas no celular (`md:hidden`).

Aplicar o mesmo padrão à tabela "POR CLIENTE" em `src/app/(app)/horas/page.tsx`.

- [ ] **Step 4: Kanban mostra uma coluna por vez**

Em `src/components/kanban/KanbanClient.tsx`, adicionar um estado `mobileColumn: ColumnId` com abas visíveis apenas em `md:hidden`. Passar `mobileColumn` ao `KanbanBoard`, que no celular renderiza somente a coluna correspondente (`grid-cols-1 md:grid-cols-3`, escondendo as outras com `hidden md:flex`).

Desabilitar os sensores de arraste abaixo de `md`, já que arrastar no celular sequestra a rolagem da página. Ler o tamanho da tela exige cuidado: `window` não existe durante a renderização no servidor, e um inicializador de `useState` **também roda lá**. Usar `useSyncExternalStore`, que é a forma que o React oferece para ler estado do navegador com um valor de servidor explícito.

Criar `src/lib/use-media-query.ts`:

```ts
"use client";

import { useCallback, useSyncExternalStore } from "react";

/** `true` quando a consulta casa. No servidor devolve `serverValue`, sem tocar em `window`. */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue
  );
}
```

Em `src/components/kanban/KanbanBoard.tsx`, substituir a criação dos sensores por:

```tsx
const isMobile = useMediaQuery("(max-width: 767px)");
const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 6 } });
const sensors = useSensors(...(isMobile ? [] : [pointerSensor]));
```

O valor de servidor `false` mantém o comportamento de desktop na primeira renderização, e o hook corrige após a hidratação — a escolha certa, porque desktop é onde se arrasta.

- [ ] **Step 5: Ajustar o corpo da página**

Em `src/components/layout/PageBody.tsx`, trocar `p-5.5` por `p-4 md:p-5.5` e, no `PageHeader`, permitir quebra: `flex flex-col gap-3 md:flex-row md:items-start md:justify-between`.

- [ ] **Step 6: Verificar**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: tudo limpo.

No navegador, reduzir a janela para 390px de largura e confirmar: a gaveta abre e fecha, nenhuma tela rola para os lados, os indicadores ficam dois por linha, o Kanban mostra uma coluna com abas, e concluir tarefa / iniciar timer / registrar horas continuam funcionando.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Adiciona layout responsivo para consulta no celular"
```

---

## Verificação final da Fase 1

Depois da Task 11, rodar a bateria completa e conferir a lista abaixo contra o sistema em execução:

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

- [ ] Nenhuma tela branca ao trocar de módulo
- [ ] Arrastar card fixa na hora, e volta com aviso quando o servidor recusa
- [ ] Marcar subtarefa, concluir tarefa, alterar meta e mudar status de fatura respondem sem espera
- [ ] Nenhum `alert()` restante (`grep -rn "alert(" src/`)
- [ ] Aba Histórico mostra eventos reais
- [ ] Timer visível em todas as telas, com aviso após 8 horas
- [ ] Sino lista faturas vencidas e tarefas de hoje
- [ ] Anexo por arquivo e por link funcionam e persistem
- [ ] Em 390px de largura, nada rola para os lados

Ao final, atualizar `README.md` com a seção "Testes" (`npm test`) e o endereço de produção.

## Fora de escopo desta fase

Tudo da Fase 2 do spec: visões múltiplas (tabela editável, calendário, timeline), edição no lugar, filtros e visões salvas, e ⌘K executável. A Fase 2 ganha plano próprio depois que esta entrar em uso.

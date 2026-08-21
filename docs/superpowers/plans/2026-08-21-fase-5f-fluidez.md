# Fase 5F — Fluidez: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o sistema responder ao clique em vez de esperar o servidor, cortando pela metade o trabalho de toda escrita e tirando as consultas mortas do caminho crítico.

**Architecture:** Três frentes independentes sobre o código existente. (1) Toda escrita passa a renderizar a rota uma vez só — a Server Action já devolve o payload atualizado via `revalidatePath`, então o `router.refresh()` que vinha depois é trabalho repetido e sai. (2) Os três seletores que hoje esperam a viagem inteira passam a usar `useOptimistic`, o mesmo padrão que os quadros já usam no arraste. (3) O sino para de consultar duas tabelas que nenhuma tela alimenta, e a sessão é resolvida uma vez por requisição em vez de duas.

**Tech Stack:** Next.js 16.2.12 (App Router, Server Actions), React 19.2.4, TypeScript 5, Supabase (`@supabase/ssr` 0.12.4, `supabase-js` 2.111), Vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-21-fase-5-fluidez-e-interface-design.md`

## Global Constraints

- **Nenhuma mudança de schema, nenhuma migration.** As tabelas mortas continuam no banco.
- **Não existe teste de componente React neste projeto** (sem `@testing-library/react`). Só `src/lib/**` tem teste automatizado. Para mudança de componente, o portão é `npm test` + `tsc --noEmit` + `eslint` + `next build` limpos, mais a verificação manual escrita em cada task.
- **Ao fim de toda task:** `npm test` passa, `npx tsc --noEmit` limpo, `npx eslint .` sem erros (o aviso de fonte em `app/layout.tsx` é conhecido e sai na 5A), `npm run build` conclui.
- **`beginMutation()`/`end()` continua envolvendo toda escrita.** Ele existe para o refresh de tempo real não atropelar estado derivado de props; nada nesta parte muda isso.
- **`revalidatePath` de outras rotas fica como está.** É o que faz `/hoje` já estar correta quando se volta para ela pelo botão Voltar.
- **Mensagens de commit em português**, explicando o porquê, não o quê.
- **Não publicar tabelas novas em tempo real** (decisão da migration 0013 continua valendo).

## Dados de referência: auditoria action × rota

Levantada antes deste plano. É a base da F1 e não deve ser refeita de cabeça.

`revalidatePath` por action:

| Action | Revalida |
| --- | --- |
| `criarContaComNegocio`, `moverNegocioParaEstagio`, `atualizarNegocio`, `atualizarConta`, `perderNegocio` | `/pipeline`, `/hoje` |
| `ganharNegocio` | `/pipeline`, `/hoje`, `/implantacao` |
| `moverEtapa`, `concluirImplantacao` | `/implantacao`, `/hoje` |
| `createTask`, `updateTaskPosition`, `updateTask`, `deleteTask` | `/kanban`, `/hoje` |
| `addChecklistItem`, `toggleChecklistItem`, `deleteChecklistItem`, `addComment`, `addLinkAttachment`, `addFileAttachment`, `removeAttachment` | `/kanban` |
| `createGoal`, `updateGoalProgress`, `deleteGoal` | `/metas` |
| `createCategory`, `createPlaybook`, `addStep`, `deleteStep`, `toggleRunStep` | `/playbooks` |
| `runPlaybook` | `/playbooks`, `/kanban` |
| `getPlaybookDetailAction` | nenhuma (é leitura) |

Chamadas de `router.refresh()` em componentes — 27 no total, das quais **22 saem** e **5 ficam**:

| Arquivo | Ação anterior | Rota | Decisão |
| --- | --- | --- | --- |
| `pipeline/NegocioDrawer.tsx` (autosave da conta) | `atualizarConta` | `/pipeline` | remover |
| `pipeline/NegocioDrawer.tsx` (`executar`) | `moverNegocioParaEstagio` · `ganharNegocio` · `perderNegocio` | `/pipeline` | remover |
| `pipeline/NegocioDrawer.tsx` (autosave do negócio) | `atualizarNegocio` | `/pipeline` | remover |
| `pipeline/NovoNegocioModal.tsx` | `criarContaComNegocio` | `/pipeline` | remover |
| `pipeline/PipelineBoard.tsx` | `moverNegocioParaEstagio` **dentro do `.catch()`** | `/pipeline` | **MANTER** |
| `implantacao/ImplantacaoDrawer.tsx` (`executar`) | `moverEtapa` · `concluirImplantacao` | `/implantacao` | remover |
| `implantacao/ImplantacaoBoard.tsx` | `moverEtapa` **dentro do `.catch()`** | `/implantacao` | **MANTER** |
| `kanban/TaskDetailPanel.tsx` (9 pontos) | `updateTask` ×5 · checklist ×3 · `addComment` | `/kanban` | remover |
| `kanban/Attachments.tsx` (3 pontos) | `addFileAttachment` · `removeAttachment` · `addLinkAttachment` | `/kanban` | remover |
| `kanban/NewTaskModal.tsx` | `createTask` | `/kanban` | remover |
| `kanban/KanbanBoard.tsx` | `updateTaskPosition` **dentro do `.catch()`** | `/kanban` | **MANTER** |
| `metas/MetasClient.tsx` (3 pontos) | `updateGoalProgress` · `deleteGoal` · `createGoal` | `/metas` | remover |
| `playbooks/PlaybooksClient.tsx` | `createPlaybook` | `/playbooks` | remover |
| `app/login/page.tsx` (2 pontos) | nenhuma (autentica no cliente) | `/login` | **MANTER** |

**Por que os três `.catch()` ficam:** ali a action lançou, então `revalidatePath` nunca rodou e o servidor não devolveu payload novo. O quadro já reverteu o otimismo em memória; o `router.refresh()` é o que reconcilia com o que o servidor realmente tem. Removê-los deixaria a tela divergindo do banco depois de qualquer falha de escrita.

`src/components/pipeline/PipelineClient.tsx` aparece num `grep` por `router.refresh()` mas só em comentários — não há chamada nele.

---

### Task 1: O sino passa a ter uma fonte só

Tira `invoices` e `contracts` de `getNotifications()`. São duas consultas em **toda** renderização de rota do app (o sino mora no layout) contra tabelas que nenhuma tela alimenta desde que o CRM antigo saiu, e cujos avisos já nascem com `href: null` porque a tela de destino não existe.

Esta é a única task da 5F com teste automatizado de verdade — `buildNotifications` é função pura e já tem suíte.

**Files:**
- Modify: `src/lib/notifications.test.ts`
- Modify: `src/lib/notifications.ts`
- Modify: `src/lib/data/notifications.ts`
- Delete: `src/lib/invoices.ts`
- Delete: `src/lib/invoices.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `buildNotifications(input: NotificationInput, today: string): AppNotification[]` com `NotificationInput = { myOpenTasks: { id: string; title: string; dueDate: string | null }[] }`. `AppNotification`, `ALL_CLEAR` e `TONE_BG` seguem exportados sem mudança de forma (`NotificationBell.tsx` depende deles).

- [ ] **Step 1: Reescrever o teste para a fonte única**

Substituir `src/lib/notifications.test.ts` inteiro por:

```ts
import { describe, it, expect } from "vitest";
import { buildNotifications, type NotificationInput } from "./notifications";

const TODAY = "2026-08-03";

const EMPTY: NotificationInput = {
  myOpenTasks: [],
};

function build(input: Partial<NotificationInput>) {
  return buildNotifications({ ...EMPTY, ...input }, TODAY);
}

describe("buildNotifications", () => {
  it("separa tarefa atrasada de tarefa que vence hoje", () => {
    const result = build({
      myOpenTasks: [
        { id: "t1", title: "Atrasada", dueDate: "2026-08-01" },
        { id: "t2", title: "Hoje", dueDate: TODAY },
        { id: "t3", title: "Futura", dueDate: "2026-08-20" },
      ],
    });
    expect(result.map((n) => n.title)).toEqual(["Atrasada", "Hoje"]);
    expect(result[0].tone).toBe("red");
    expect(result[1].tone).toBe("amber");
  });

  it("pula tarefa sem prazo", () => {
    const result = build({
      myOpenTasks: [
        { id: "t1", title: "Sem prazo", dueDate: null },
        { id: "t2", title: "Atrasada", dueDate: "2026-08-01" },
      ],
    });
    expect(result.map((n) => n.title)).toEqual(["Atrasada"]);
  });

  it("leva ao Kanban, na tarefa", () => {
    const result = build({
      myOpenTasks: [{ id: "t1", title: "Atrasada", dueDate: "2026-08-01" }],
    });
    expect(result[0].href).toBe("/kanban?task=t1");
  });

  it("ordena o vermelho antes do âmbar", () => {
    const result = build({
      myOpenTasks: [
        { id: "t1", title: "Vence hoje", dueDate: TODAY },
        { id: "t2", title: "Atrasada", dueDate: "2026-08-01" },
      ],
    });
    expect(result.map((n) => n.tone)).toEqual(["red", "amber"]);
    expect(result.map((n) => n.id)).toEqual(["tarefa-t2", "tarefa-t1"]);
  });

  it("devolve lista vazia quando não há nada a fazer", () => {
    expect(build({})).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/lib/notifications.test.ts`
Expected: FAIL — `NotificationInput` ainda exige `openInvoices` e `endingContracts`, então o objeto `EMPTY` não satisfaz o tipo e o Vitest acusa erro de transformação/tipo nos casos.

- [ ] **Step 3: Encolher `buildNotifications` para a fonte única**

Em `src/lib/notifications.ts`: remover o `import { isInvoiceOverdue } from "./invoices";`, remover os campos `openInvoices` e `endingContracts` de `NotificationInput`, e remover os dois laços correspondentes de `buildNotifications`. O tipo passa a ser:

```ts
export type NotificationInput = {
  myOpenTasks: { id: string; title: string; dueDate: string | null }[];
};
```

E o corpo, apenas o laço de tarefas seguido do `sort` que já existe:

```ts
export function buildNotifications(input: NotificationInput, today: string): AppNotification[] {
  const out: AppNotification[] = [];

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

  // Ordena por urgência (vermelho → âmbar → neutro). `sort` é estável, então a
  // ordem dentro de cada tom continua sendo a da query (por data de vencimento).
  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}
```

Atualizar o comentário de bloco acima de `ALL_CLEAR` para dizer a verdade nova: o sino tem uma fonte só desde esta fase, porque fatura e contrato liam tabelas sem escritor.

Manter `AppNotification`, `ALL_CLEAR`, `TONE_BG` e `TONE_ORDER` com os três tons. O tom `neutral` deixa de ser produzido por `buildNotifications`, mas continua no vocabulário porque `TONE_BG` é a paleta do sino e a 5A vai mexer nela — encolher a união agora obrigaria a reabri-la depois. Registrar isso num comentário de uma linha em `TONE_ORDER`.

- [ ] **Step 4: Encolher a leitura**

Em `src/lib/data/notifications.ts`: remover o `import { UNPAID_INVOICE_STATUSES }`, remover as consultas a `invoices` e `contracts` do `Promise.all` (fica uma consulta só, sem `Promise.all`), remover o cálculo de `in30Days`, e ajustar a checagem de erro e o retorno:

```ts
export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const supabase = await createClient();
  const today = todayInAppTz();

  const tasksRes = await supabase
    .from("tasks")
    .select("id, title, due_date")
    .eq("assignee_id", userId)
    .neq("status", "done")
    .order("due_date");

  if (tasksRes.error) {
    console.error("[avisos] falha ao consultar o Supabase:", tasksRes.error);
    return UNAVAILABLE;
  }

  return buildNotifications(
    {
      myOpenTasks: (tasksRes.data ?? []).map((t) => ({ id: t.id, title: t.title, dueDate: t.due_date })),
    },
    today
  );
}
```

O bloco `UNAVAILABLE` e o comentário dele ficam como estão — a razão de existir não mudou.

- [ ] **Step 5: Apagar o que ficou sem consumidor**

```bash
rm src/lib/invoices.ts src/lib/invoices.test.ts
```

Mesma doutrina da migration 0014: manter código sem chamador é dívida que ninguém lembra. `isInvoiceOverdue` só era usada pelo sino; `UNPAID_INVOICE_STATUSES`, idem.

- [ ] **Step 6: Rodar tudo e confirmar que passa**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```
Expected: 15 arquivos de teste passando (era 16 — `invoices.test.ts` foi apagado), tipos limpos, sem erro de lint, build conclui.

Se `tsc` reclamar de `isInvoiceOverdue` em `src/lib/negocios.ts`, é só o comentário de bloco citando o nome — texto, não código. Atualizar a menção para apontar para `saudeDoNegocio` como o exemplo vivo da mesma disciplina.

- [ ] **Step 7: Commit**

```bash
git add -A src/lib
git commit -m "$(cat <<'EOF'
perf: o sino para de consultar duas tabelas sem escritor

`getNotifications` roda no layout, então suas consultas pesam em TODA
renderização de rota do app. Duas das três liam `invoices` e `contracts`
— tabelas que nenhuma tela alimenta desde que o CRM antigo saiu, e cujos
avisos já nasciam com `href: null` porque a tela de destino não existe.

Sai junto o que ficou sem chamador (`invoices.ts` e seu teste), mesma
doutrina da migration 0014. As tabelas continuam no banco.
EOF
)"
```

---

### Task 2: Uma escrita, uma renderização — Pipeline

Remove os quatro `router.refresh()` redundantes do Pipeline. Cada um deles vinha depois de uma action que já chama `revalidatePath("/pipeline")`, e o Next devolve o payload atualizado dessa rota junto com a resposta da action — o refresh refazia o trabalho inteiro pela segunda vez.

**Files:**
- Modify: `src/components/pipeline/NegocioDrawer.tsx` (3 pontos)
- Modify: `src/components/pipeline/NovoNegocioModal.tsx` (1 ponto)

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: o padrão que as Tasks 3, 4 e 5 repetem em outras rotas.

- [ ] **Step 1: Tirar o refresh do autosave da conta**

Em `NegocioDrawer.tsx`, no `onSave` do `contaAutoSaveStatus`, o corpo do `try` fica só com a chamada da action:

```tsx
      const end = beginMutation();
      try {
        await atualizarConta({
          contaId: negocio.conta_id,
          nome: v.nome,
          nicho: v.nicho.trim() || null,
          cidade: v.cidade.trim() || null,
          uf: v.uf.trim() || null,
          decisorNome: v.decisorNome.trim() || null,
          softwareAtual: v.softwareAtual.trim() || null,
          origem: v.origem.trim() || null,
          email: v.email.trim() || null,
          telefone: v.telefone.trim() || null,
          site: v.site.trim() || null,
        });
      } finally {
        end();
      }
```

- [ ] **Step 2: Tirar o refresh do autosave do negócio**

No `onSave` do `negocioAutoSaveStatus`, mesma remoção:

```tsx
      const end = beginMutation();
      try {
        await atualizarNegocio({
          negocioId: negocio.id,
          proximoPasso: v.proximoPasso.trim() || null,
          proximoPassoEm: v.proximoPassoEm || null,
          setup: numeroOuNulo(v.setup),
          mrr: numeroOuNulo(v.mrr),
        });
      } finally {
        end();
      }
```

- [ ] **Step 3: Tirar o refresh do `executar()`**

```tsx
  /** Toda escrita da gaveta passa por aqui: portão, aviso em caso de falha, e a janela continua aberta. */
  function executar(oQue: string, acao: () => Promise<unknown>, depois?: () => void) {
    startTransition(async () => {
      const end = beginMutation();
      try {
        await acao();
        depois?.();
      } catch (erro) {
        console.error(`[pipeline] falha ao ${oQue}:`, erro);
        notify("error", `Não foi possível ${oQue}. Tente de novo — se persistir, me avise.`);
        setAcaoAtual(null);
      } finally {
        end();
      }
    });
  }
```

Acrescentar acima da função o comentário que explica por que não há refresh aqui:

```tsx
  // Sem `router.refresh()`: as três actions que passam por aqui
  // (`moverNegocioParaEstagio`, `ganharNegocio`, `perderNegocio`) chamam
  // `revalidatePath("/pipeline")`, e o Next devolve o payload novo desta rota
  // junto com a resposta da action. Um refresh depois disso renderizaria a
  // rota inteira uma segunda vez — ~9 idas ao servidor repetidas com a gaveta
  // travada. Ver a auditoria action × rota no plano da 5F.
```

- [ ] **Step 4: Tirar o refresh do cadastro**

Em `NovoNegocioModal.tsx`, o `startTransition` do submit fica:

```tsx
      const end = beginMutation();
      try {
        await criarContaComNegocio({
          nome: nome.trim(),
          nicho: textoOuNulo(nicho),
          cidade: textoOuNulo(cidade),
          uf: textoOuNulo(uf),
          decisorNome: textoOuNulo(decisor),
          softwareAtual: textoOuNulo(software),
          origem: textoOuNulo(origem),
          email: textoOuNulo(email),
          telefone: textoOuNulo(telefone),
          site: textoOuNulo(site),
          setup: numeroOuNulo(setup),
          mrr: numeroOuNulo(mrr),
          proximoPasso: textoOuNulo(proximoPasso),
          proximoPassoEm: proximoPassoEm || null,
          donoId: donoId || null,
        });
        onClose();
      } finally {
        end();
      }
```

Conferir os nomes dos campos contra o arquivo antes de colar: o objeto acima
reproduz o que já está lá — a única mudança desta task é a remoção da linha
`router.refresh();`.

Conferir que o `router` e o `useRouter` ficam sem uso no arquivo — se ficarem, remover o import, senão o lint acusa.

- [ ] **Step 5: Confirmar que o `.catch()` do quadro NÃO foi tocado**

Run: `grep -n "router.refresh()" src/components/pipeline/*.tsx`
Expected: exatamente uma linha, em `PipelineBoard.tsx`, dentro do `.catch()` de `moverNegocioParaEstagio`. Ali a action lançou, `revalidatePath` não rodou, e o refresh é o que reconcilia a tela com o banco.

- [ ] **Step 6: Portões automáticos**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```
Expected: tudo limpo.

- [ ] **Step 7: Verificação manual — é o passo mais importante desta task**

Com `npm run dev`, em `/pipeline`:

1. Abrir a gaveta de um negócio, mudar o **próximo passo**, esperar o "salvo". Fechar a gaveta. O texto novo tem de aparecer no cartão do quadro. *(Se não aparecer, `atualizarNegocio` não está revalidando `/pipeline` — corrigir na action, não devolvendo o refresh.)*
2. Editar **nome da conta** na gaveta, esperar o "salvo", fechar. O nome novo tem de aparecer no cartão.
3. Mudar o **estágio** pelo seletor da gaveta. O cartão tem de trocar de coluna.
4. Cadastrar um negócio pelo **"+ Novo negócio"**. Ele tem de aparecer na coluna LEAD sem recarregar a página.
5. **Arrastar** um cartão entre colunas — continua funcionando (não foi tocado).

- [ ] **Step 8: Commit**

```bash
git add src/components/pipeline
git commit -m "$(cat <<'EOF'
perf: Pipeline renderiza a rota uma vez por escrita, não duas

As actions do Pipeline já chamam revalidatePath("/pipeline"), e o Next
devolve o payload novo desta rota junto com a resposta da action. O
router.refresh() que vinha depois renderizava a rota inteira de novo —
cerca de nove idas ao servidor repetidas, com a gaveta desabilitada
durante as duas.

O refresh dentro do .catch() do quadro FICA: ali a action lançou,
revalidatePath não rodou, e ele é o que reconcilia a tela com o banco
depois de uma escrita que falhou.
EOF
)"
```

---

### Task 3: Uma escrita, uma renderização — Implantação

**Files:**
- Modify: `src/components/implantacao/ImplantacaoDrawer.tsx` (1 ponto)

**Interfaces:**
- Consumes: o padrão estabelecido na Task 2.
- Produces: nada novo.

- [ ] **Step 1: Tirar o refresh do `executar()`**

```tsx
  // Sem `router.refresh()`: `moverEtapa` e `concluirImplantacao` chamam
  // `revalidatePath("/implantacao")`, e o Next devolve o payload novo desta
  // rota junto com a resposta da action. Ver a auditoria action × rota no
  // plano da 5F.
  /** Toda escrita da gaveta passa por aqui: portão, aviso em caso de falha, e a janela continua aberta. */
  function executar(oQue: string, acao: () => Promise<unknown>, depois?: () => void) {
    startTransition(async () => {
      const end = beginMutation();
      try {
        await acao();
        depois?.();
      } catch (erro) {
        console.error(`[implantacao] falha ao ${oQue}:`, erro);
        notify("error", `Não foi possível ${oQue}. Tente de novo — se persistir, me avise.`);
      } finally {
        end();
      }
    });
  }
```

Conferir se `useRouter`/`router` ficaram sem uso no arquivo; se sim, remover o import.

- [ ] **Step 2: Confirmar que o `.catch()` do quadro NÃO foi tocado**

Run: `grep -n "router.refresh()" src/components/implantacao/*.tsx`
Expected: exatamente uma linha, em `ImplantacaoBoard.tsx`, dentro do `.catch()`.

- [ ] **Step 3: Portões automáticos**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```

- [ ] **Step 4: Verificação manual**

Em `/implantacao`, com pelo menos uma implantação aberta (se não houver, criar: ganhar um negócio no Pipeline):

1. Abrir a gaveta, mudar a **etapa** pelo seletor. O cartão tem de trocar de coluna e o "na etapa há Nd" tem de zerar.
2. **Concluir a implantação**. Ela tem de sumir do quadro.
3. Ir a `/hoje` e confirmar que a implantação concluída não aparece mais na lista de pendências.
4. **Arrastar** um cartão entre etapas — continua funcionando.

- [ ] **Step 5: Commit**

```bash
git add src/components/implantacao
git commit -m "$(cat <<'EOF'
perf: Implantação renderiza a rota uma vez por escrita

Mesmo raciocínio da Task 2 no Pipeline: moverEtapa e concluirImplantacao
já revalidam /implantacao, então o router.refresh() seguinte era uma
segunda renderização completa da rota.

O refresh dentro do .catch() do quadro fica, pelo mesmo motivo de lá.
EOF
)"
```

---

### Task 4: Uma escrita, uma renderização — Kanban

Treze pontos. É a task com mais remoções, e todas do mesmo tipo: `await <action>(...)` seguido de `router.refresh()` dentro de um `startTransition`.

**Files:**
- Modify: `src/components/kanban/TaskDetailPanel.tsx` (9 pontos)
- Modify: `src/components/kanban/Attachments.tsx` (3 pontos)
- Modify: `src/components/kanban/NewTaskModal.tsx` (1 ponto)

**Interfaces:**
- Consumes: o padrão estabelecido na Task 2.
- Produces: nada novo.

- [ ] **Step 1: Remover os nove pontos do painel de detalhe**

Em `TaskDetailPanel.tsx`, remover a linha `router.refresh();` que vem logo depois de cada uma destas chamadas, mantendo o `try`/`finally` e o `end()`. A forma da mudança, em todos os nove:

```tsx
// antes
startTransition(async () => {
  const end = beginMutation();
  try {
    await updateTask(t.id, { priority: e.target.value });
    router.refresh();
  } finally {
    end();
  }
});

// depois
startTransition(async () => {
  const end = beginMutation();
  try {
    await updateTask(t.id, { priority: e.target.value });
  } finally {
    end();
  }
});
```

Os nove pontos:

| Action anterior | O que o controle faz |
| --- | --- |
| `updateTask(t.id, { status: ... })` | seletor de status no cabeçalho |
| `updateTask(t.id, { title: ... })` | título editável |
| `updateTask(t.id, { assignee_id: ... })` | seletor de responsável |
| `updateTask(t.id, { due_date: ... })` | campo de prazo |
| `updateTask(t.id, { priority: ... })` | seletor de prioridade |
| `toggleChecklistItem(item.id, ...)` | marcar item do checklist |
| `deleteChecklistItem(item.id)` | remover item do checklist |
| `addChecklistItem(t.id, ...)` | adicionar item ao checklist |
| `addComment(t.id, ...)` | enviar comentário |

Todas as sete actions envolvidas chamam `revalidatePath("/kanban")`.

Acrescentar, uma vez, no topo do componente:

```tsx
// Nenhuma escrita deste painel chama `router.refresh()`: todas as actions de
// tarefa chamam `revalidatePath("/kanban")`, e o Next devolve o payload novo
// desta rota junto com a resposta da action. Ver a auditoria action × rota no
// plano da 5F.
```

- [ ] **Step 2: Remover os três pontos dos anexos**

Em `Attachments.tsx`, mesma remoção depois de `addFileAttachment`, `removeAttachment` e `addLinkAttachment`.

- [ ] **Step 3: Remover o ponto do cadastro de tarefa**

Em `NewTaskModal.tsx`, o `submit` fica:

```tsx
      const end = beginMutation();
      try {
        await createTask({
          title: title.trim(),
          clientId: isInternal ? null : clientId || null,
          isInternal,
          area: isInternal ? area : null,
          priority,
          assigneeId: assigneeId || null,
          dueDate: dueDate || null,
          description: description || null,
        });
        onClose();
      } finally {
        end();
      }
```

- [ ] **Step 4: Limpar imports órfãos e conferir o quadro**

Run: `grep -n "router.refresh()" src/components/kanban/*.tsx`
Expected: exatamente uma linha, em `KanbanBoard.tsx`, dentro do `.catch()` de `updateTaskPosition`.

Em cada um dos três arquivos, se `router` ficou sem uso, remover `useRouter` do import. **Atenção:** `TaskDetailPanel.tsx` usa `router` para outras coisas além do refresh (fechar o painel, apagar tarefa) — conferir antes de remover.

- [ ] **Step 5: Portões automáticos**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```

- [ ] **Step 6: Verificação manual**

Em `/kanban`, abrindo uma tarefa:

1. Trocar **status** pelo seletor — o cartão muda de coluna no quadro atrás do painel.
2. Editar o **título** — muda no cartão.
3. Trocar **responsável**, **prazo** e **prioridade** — cada um reflete no cartão.
4. **Marcar, adicionar e remover** item de checklist — o contador do cartão acompanha.
5. **Comentar** — o comentário aparece na lista.
6. **Anexar um arquivo, anexar um link e remover um anexo** — a lista acompanha.
7. Criar tarefa pelo **"+ Nova tarefa"** — aparece na coluna A fazer.
8. **Arrastar** um cartão — continua funcionando.
9. Ir a `/hoje` e confirmar que uma tarefa marcada como concluída sumiu das pendências.

- [ ] **Step 7: Commit**

```bash
git add src/components/kanban
git commit -m "$(cat <<'EOF'
perf: Kanban renderiza a rota uma vez por escrita

Treze pontos, todos o mesmo padrão: uma action que já revalida /kanban
seguida de router.refresh(). Cada escrita renderizava a rota duas vezes.

O refresh dentro do .catch() do quadro fica, pelo mesmo motivo das
Tasks 2 e 3.
EOF
)"
```

---

### Task 5: Uma escrita, uma renderização — Metas e Playbooks

**Files:**
- Modify: `src/components/metas/MetasClient.tsx` (3 pontos)
- Modify: `src/components/playbooks/PlaybooksClient.tsx` (1 ponto)

**Interfaces:**
- Consumes: o padrão estabelecido na Task 2.
- Produces: nada novo.

- [ ] **Step 1: Remover os três pontos das metas**

Em `MetasClient.tsx`, remover o `router.refresh()` depois de `updateGoalProgress`, de `deleteGoal` e de `createGoal` (este último dentro de `NewGoalModal`). As três actions revalidam `/metas`.

Atenção ao progresso da meta: ele já usa `useOptimistic`, e o valor otimista reverte quando a transição termina. Com o payload novo chegando pela resposta da action, o valor confirmado assume no mesmo commit — é justamente o que se quer. Nada mais a mudar ali.

- [ ] **Step 2: Remover o ponto dos playbooks**

Em `PlaybooksClient.tsx`, no `onSubmit` do `NewPlaybookModal`:

```tsx
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
```

`createPlaybook` revalida `/playbooks`, e a lista visível vem do `useMemo` sobre a prop `allPlaybooks` — o payload novo atualiza a prop e a lista acompanha.

**Não tocar** no `router.push` do `createCategory` na mesma tela: ali a navegação existe para deixar a URL bookmarkável, e o estado local já é atualizado direto (decisão registrada no spec de 2026-08-20).

- [ ] **Step 3: Limpar imports órfãos**

Conferir em cada arquivo se `router` ficou sem uso. Em `PlaybooksClient.tsx` ele continua sendo usado (`router.replace`, `router.push`) — não remover.

- [ ] **Step 4: Portões automáticos**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```

- [ ] **Step 5: Verificação manual**

Em `/metas`:
1. Editar o progresso de uma meta pelo número e confirmar com **Enter** — a barra e o texto acompanham, e o valor persiste ao recarregar.
2. **Excluir** uma meta — some da tela.
3. Criar meta pelo **"+ Nova meta"** — aparece no quadrante da área.

Em `/playbooks`:
4. Criar playbook pelo **"+ Novo playbook"** — aparece na lista da categoria ativa, com o tipo e a contagem de etapas corretos.
5. Trocar de categoria e voltar — o playbook novo continua lá.

- [ ] **Step 6: Commit**

```bash
git add src/components/metas src/components/playbooks
git commit -m "$(cat <<'EOF'
perf: Metas e Playbooks renderizam a rota uma vez por escrita

Fecha a varredura da F1: os últimos quatro router.refresh() redundantes
do app. Sobram cinco chamadas, todas justificadas — três em .catch() de
quadro (a action lançou, revalidatePath não rodou) e duas no login (não
há Server Action ali).
EOF
)"
```

---

### Task 6: A gaveta do negócio responde no clique

Estabelece o padrão otimista para os seletores que hoje esperam a viagem inteira. O quadro já responde na hora quando se arrasta um cartão; o mesmo estágio mudado pelo seletor da gaveta trava a gaveta até o servidor voltar. `MetasClient` já usa `useOptimistic` para o progresso da meta — é a técnica existente aplicada onde faltava.

**Files:**
- Modify: `src/components/pipeline/NegocioDrawer.tsx`

**Interfaces:**
- Consumes: `executar()` da Task 2 (sem refresh).
- Produces: o padrão `useOptimistic` + `beginMutation` que a Task 7 repete em duas outras gavetas.

- [ ] **Step 1: Importar `useOptimistic`**

```tsx
import { useOptimistic, useState, useTransition } from "react";
```

- [ ] **Step 2: Declarar o estágio otimista e a função de troca**

Logo depois dos outros `useState` do componente:

```tsx
  // O estágio responde no clique. `useOptimistic` reverte sozinho quando a
  // transição termina: se a escrita deu certo, o payload novo da action já
  // traz `negocio.estagio` igual ao otimista e a troca é imperceptível; se
  // falhou, o valor volta ao anterior e o toast explica. Mesmo padrão do
  // progresso da meta (`MetasClient.tsx`) e do arraste dos quadros.
  const [estagioOtimista, setEstagioOtimista] = useOptimistic(negocio.estagio);

  function trocarEstagio(novo: EstagioId) {
    startTransition(async () => {
      setEstagioOtimista(novo);
      const end = beginMutation();
      try {
        await moverNegocioParaEstagio(negocio.id, novo);
      } catch (erro) {
        console.error("[pipeline] falha ao mover o negócio de estágio:", erro);
        notify("error", "Não foi possível mover o negócio de estágio. Tente de novo — se persistir, me avise.");
      } finally {
        end();
      }
    });
  }
```

- [ ] **Step 3: Ligar o seletor ao valor otimista**

```tsx
          <Field label="ESTÁGIO">
            <Select value={estagioOtimista} onChange={(e) => trocarEstagio(e.target.value as EstagioId)}>
              {ESTAGIOS.map((estagio) => (
                <option key={estagio.id} value={estagio.id}>
                  {estagio.label}
                </option>
              ))}
            </Select>
          </Field>
```

O `disabled={pendente}` sai: o seletor já mostra o valor novo, e travá-lo seria contradizer a própria tela.

- [ ] **Step 4: Portões automáticos**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```

Se o lint acusar `react-hooks` por `setEstagioOtimista` fora de transição, conferir que a chamada é a **primeira** instrução dentro do `startTransition` — é isso que a regra exige.

- [ ] **Step 5: Verificação manual**

Em `/pipeline`:
1. Abrir a gaveta e trocar o estágio. O seletor tem de mostrar o valor novo **imediatamente**, sem esperar; o cartão troca de coluna logo depois.
2. Trocar de estágio duas vezes seguidas, rápido. O seletor acompanha os dois cliques.
3. **Simular falha:** com o DevTools em modo offline, trocar o estágio. O seletor mostra o novo, volta ao anterior, e o toast de erro aparece. Voltar ao modo online e conferir que o quadro está coerente com o banco depois de um F5.
4. "Ganhar" e "Perder" continuam funcionando e continuam mostrando o texto de progresso no botão.

- [ ] **Step 6: Commit**

```bash
git add src/components/pipeline/NegocioDrawer.tsx
git commit -m "$(cat <<'EOF'
feat: o estágio do negócio responde no clique

O quadro já respondia na hora ao arraste, mas o MESMO estágio mudado
pelo seletor da gaveta esperava a viagem inteira com o controle
desabilitado — no celular, onde o arraste está desligado, esse seletor é
o único caminho.

useOptimistic com reversão automática, mesmo padrão do progresso da meta
em MetasClient. O disabled sai: o seletor já mostra o valor novo, travá-lo
contradiria a tela.
EOF
)"
```

---

### Task 7: A implantação e a tarefa respondem no clique

Aplica o padrão da Task 6 nas outras duas gavetas. O seletor de status da tarefa ganha, de quebra, o tratamento de erro que nunca teve: hoje ele tem `try`/`finally` sem `catch`, então uma escrita que falha não avisa ninguém.

**Files:**
- Modify: `src/components/implantacao/ImplantacaoDrawer.tsx`
- Modify: `src/components/kanban/TaskDetailPanel.tsx`

**Interfaces:**
- Consumes: o padrão `useOptimistic` + `beginMutation` da Task 6.
- Produces: nada novo.

- [ ] **Step 1: Etapa otimista na gaveta da implantação**

Em `ImplantacaoDrawer.tsx`, importar `useOptimistic` de `react` e acrescentar:

```tsx
  // Mesmo padrão da gaveta do negócio (`NegocioDrawer.tsx`): a etapa responde
  // no clique e reverte sozinha se a escrita falhar.
  const [etapaOtimista, setEtapaOtimista] = useOptimistic(implantacao.etapa);

  function trocarEtapa(nova: number) {
    startTransition(async () => {
      setEtapaOtimista(nova);
      const end = beginMutation();
      try {
        await moverEtapa(implantacao.id, nova);
      } catch (erro) {
        console.error("[implantacao] falha ao mover a implantação de etapa:", erro);
        notify("error", "Não foi possível mover a implantação de etapa. Tente de novo — se persistir, me avise.");
      } finally {
        end();
      }
    });
  }
```

E o seletor:

```tsx
          <Field label="ETAPA">
            <Select value={String(etapaOtimista)} onChange={(e) => trocarEtapa(Number(e.target.value))}>
              {etapas.map((etapa) => (
                <option key={etapa.posicao} value={etapa.posicao}>
                  {etapa.nome}
                </option>
              ))}
            </Select>
          </Field>
```

**Atenção:** `etapaAtual`, `vencimento` e `saude` são derivados de `implantacao.etapa`, não do valor otimista — e devem continuar assim. Eles dependem de `etapa_desde`, que só o servidor sabe zerar; mostrar um SLA otimista seria inventar um prazo que não existe. O seletor responde na hora; o rótulo de prazo espera a confirmação, e isso é correto.

- [ ] **Step 2: Status otimista no painel da tarefa**

Em `TaskDetailPanel.tsx`, `useOptimistic` já está importado (o checklist usa). Acrescentar:

```tsx
  // Mesmo padrão da gaveta do negócio (`NegocioDrawer.tsx`). O `catch` é novo:
  // antes desta fase o seletor tinha try/finally sem catch, então uma escrita
  // que falhasse não avisava ninguém — a tela voltava ao status antigo sem
  // explicação.
  const [statusOtimista, setStatusOtimista] = useOptimistic(t.status);

  function trocarStatus(novo: string) {
    startTransition(async () => {
      setStatusOtimista(novo);
      const end = beginMutation();
      try {
        await updateTask(t.id, { status: novo });
      } catch (erro) {
        console.error("[kanban] falha ao mudar o status da tarefa:", erro);
        notify("error", "Não foi possível mudar o status da tarefa. Tente de novo — se persistir, me avise.");
      } finally {
        end();
      }
    });
  }
```

E o seletor do cabeçalho:

```tsx
        <select
          value={statusOtimista}
          onChange={(e) => trocarStatus(e.target.value)}
          className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium"
        >
          <option value="todo">A fazer</option>
          <option value="in_progress">Em andamento</option>
          <option value="done">Finalizada</option>
        </select>
```

Se `notify` ainda não estiver em uso neste arquivo, importar `useToast` de `@/components/ui/Toast` e desestruturar `const { notify } = useToast();` junto dos outros hooks.

- [ ] **Step 3: Portões automáticos**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```

- [ ] **Step 4: Verificação manual**

Em `/implantacao`:
1. Trocar a etapa pela gaveta — o seletor responde na hora; o "na etapa há Nd" e o rótulo de prazo atualizam quando o servidor confirma.
2. Com o DevTools offline, trocar a etapa — o seletor volta e o toast aparece.

Em `/kanban`:
3. Trocar o status de uma tarefa pelo painel — o seletor responde na hora e o cartão muda de coluna.
4. Com o DevTools offline, trocar o status — o seletor volta e o toast aparece. **Antes desta task, esse caso falhava em silêncio.**

- [ ] **Step 5: Commit**

```bash
git add src/components/implantacao/ImplantacaoDrawer.tsx src/components/kanban/TaskDetailPanel.tsx
git commit -m "$(cat <<'EOF'
feat: etapa da implantação e status da tarefa respondem no clique

Aplica nas outras duas gavetas o padrão da gaveta do negócio.

Dois cuidados registrados no código: o rótulo de SLA da implantação NÃO
é otimista (depende de etapa_desde, que só o servidor zera — um prazo
otimista seria um prazo inventado), e o seletor de status da tarefa
ganha o catch que nunca teve: antes, uma escrita que falhava voltava o
status sem avisar ninguém.
EOF
)"
```

---

### Task 8: Bloquear a escrita, não a leitura

Depois das Tasks 2 a 7, `pendente` cobre só a escrita em si. Falta tirar o `disabled` de onde ele não protege mais nada.

**Files:**
- Modify: `src/components/pipeline/NegocioDrawer.tsx`
- Modify: `src/components/implantacao/ImplantacaoDrawer.tsx`

**Interfaces:**
- Consumes: os seletores otimistas das Tasks 6 e 7.
- Produces: nada novo.

- [ ] **Step 1: Conferir o que sobrou de `disabled={pendente}`**

Run: `grep -n "disabled={pendente}" src/components/pipeline/NegocioDrawer.tsx src/components/implantacao/ImplantacaoDrawer.tsx`

Esperado depois das Tasks 6 e 7: os botões "Ganhar", "Perder", "Confirmar perda" e "Concluir implantação" — os seletores já perderam o `disabled`.

- [ ] **Step 2: Manter o `disabled` só onde ele é guarda de clique duplo**

Nesses quatro botões o `disabled` **fica**, e ganha um comentário explicando que não é espera de leitura:

```tsx
        {/* `disabled` aqui não é espera de leitura — é guarda contra clique
            duplo numa ação que muda a fase da conta. Os seletores otimistas
            desta gaveta não usam mais `disabled`. */}
```

Colocar o comentário uma vez por arquivo, acima do rodapé de botões.

- [ ] **Step 3: Conferir que a leitura não está travada**

Em `NegocioDrawer.tsx`, confirmar que nenhum `<Input>`, `<Textarea>` ou `<Select>` da gaveta recebe `disabled` — o autosave nunca deve impedir de continuar digitando. `grep -n "disabled" src/components/pipeline/NegocioDrawer.tsx` só pode devolver os botões do rodapé.

- [ ] **Step 4: Portões automáticos**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```

- [ ] **Step 5: Verificação manual**

Em `/pipeline`, com a gaveta aberta:
1. Digitar no **próximo passo** e, sem parar, rolar a gaveta, abrir outro campo e digitar nele. Nada trava enquanto o "salvando…" aparece.
2. Digitar num campo e clicar em **"Perder"** antes de o autosave terminar. O fluxo de motivo abre normalmente. *(Server Actions são serializadas pelo Next: a escrita da perda entra na fila atrás do autosave. O que muda é que a tela não fica travada esperando.)*
3. Clicar em **"Ganhar"** duas vezes rápido. O segundo clique não passa — o botão está desabilitado durante a escrita.

- [ ] **Step 6: Commit**

```bash
git add src/components/pipeline/NegocioDrawer.tsx src/components/implantacao/ImplantacaoDrawer.tsx
git commit -m "$(cat <<'EOF'
fix: o disabled das gavetas volta a significar uma coisa só

Com os seletores otimistas e sem a segunda renderização de rota,
`pendente` cobre só a escrita em si. O `disabled` fica onde é guarda
contra clique duplo numa ação que muda a fase da conta (Ganhar, Perder,
Concluir) e sai de todo o resto.
EOF
)"
```

---

### Task 9: O primeiro quadro do celular já é o do celular

`useMediaQuery` devolve `false` no servidor, então o celular pinta o layout de desktop e só depois vira celular. Onde isso decide **layout**, a decisão sai do JavaScript e vai para o CSS.

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/implantacao/ImplantacaoBoard.tsx`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: a classe `.board-etapas` e a variável `--colunas`, que a 5B pode reusar se precisar de outro quadro guiado por dado.

- [ ] **Step 1: Criar a regra no CSS**

Em `src/app/globals.css`, depois do bloco `.scrollbar-thin`:

```css
/* O quadro da Implantação tem tantas colunas quantas forem as etapas em
   `implantacao_etapas` — dado, não código, então o número chega por
   `--colunas`. O PONTO DE CORTE, porém, é CSS: com ele em JavaScript
   (`useMediaQuery`, que devolve `false` no servidor) o celular pintava o
   layout de desktop antes de virar celular, e todo carregamento piscava. */
.board-etapas {
  display: grid;
  grid-template-columns: 1fr;
}

@media (min-width: 768px) {
  .board-etapas {
    grid-template-columns: repeat(var(--colunas, 1), minmax(0, 1fr));
  }
}
```

- [ ] **Step 2: Trocar o estilo inline pela classe**

Em `ImplantacaoBoard.tsx`, o contêiner do grid passa a ser:

```tsx
      <div
        className="board-etapas flex-1 gap-3.5 overflow-y-auto scrollbar-thin md:overflow-hidden"
        style={{ "--colunas": Math.max(etapas.length, 1) } as CSSProperties}
      >
```

Remover as classes `grid` e `grid-cols-1` (agora vêm da `.board-etapas`) e o `style` condicional a `isMobile`. Acrescentar `CSSProperties` ao import de tipos do React no topo do arquivo — o cast é necessário porque `CSSProperties` não aceita propriedade customizada:

```tsx
import type { CSSProperties } from "react";
``` O comentário longo que explicava o estilo inline é substituído por um curto apontando para o CSS:

```tsx
      {/* O número de colunas é dado (`etapas.length`) e chega por `--colunas`;
          o ponto de corte mora em `globals.css`, não aqui — ver `.board-etapas`. */}
```

- [ ] **Step 3: Conferir que `isMobile` continua onde deve**

`isMobile` **continua** alimentando `dragDisabled` — isso é comportamento (desligar o arraste no toque), não desenho, e uma troca depois da hidratação não pisca. `grep -n "isMobile" src/components/implantacao/ImplantacaoBoard.tsx` deve devolver só a declaração e o `dragDisabled`.

Não tocar em `PipelineBoard.tsx` nem em `KanbanBoard.tsx`: lá o número de colunas é fixo e já vem de classes Tailwind responsivas (`md:grid-cols-5`), que são CSS puro e não piscam.

- [ ] **Step 4: Portões automáticos**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```

- [ ] **Step 5: Verificação manual**

1. Abrir `/implantacao` no DevTools em modo dispositivo, largura 375px, e **recarregar**. O quadro tem de nascer empilhado — sem nenhum quadro intermediário com seis colunas espremidas.
2. Repetir com o cache desabilitado e a rede em "Slow 3G", que é onde a piscada aparecia com mais clareza.
3. Alargar a janela além de 768px — as colunas viram lado a lado, uma por etapa.
4. No desktop, arrastar um cartão entre etapas — continua funcionando.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/components/implantacao/ImplantacaoBoard.tsx
git commit -m "$(cat <<'EOF'
fix: o quadro da Implantação nasce no layout certo no celular

useMediaQuery devolve false no servidor, então o celular pintava as seis
colunas de desktop e só depois empilhava — toda abertura da tela piscava.

O número de colunas continua vindo do dado, agora por --colunas; o ponto
de corte vira media query em globals.css. isMobile fica só onde decide
comportamento (desligar o arraste no toque), que não pisca.
EOF
)"
```

---

### Task 10: A sessão é resolvida uma vez por requisição

Duas mudanças com pesos diferentes. A primeira é certa e imediata; a segunda depende de uma configuração do projeto Supabase que **precisa ser verificada por alguém com acesso ao painel** — esta sessão não alcança o projeto (achado E1 da auditoria).

**Files:**
- Modify: `src/lib/data/profile.ts`
- Modify: `src/lib/supabase/middleware.ts` (somente no cenário A do Step 3)

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `requireProfile(): Promise<{ userId: string; profile: Tables<"profiles"> }>` — o campo `user` some do retorno. Consumidores atuais (`app/(app)/layout.tsx`, `app/(app)/hoje/page.tsx`) só desestruturam `profile`, então nenhum quebra.

- [ ] **Step 1: Deduplicar `requireProfile` dentro da mesma renderização**

`/hoje` chama `requireProfile()` **duas vezes** por renderização — uma no layout, outra na página. São dois `auth.getUser()` (rede) e duas consultas a `profiles` para responder a mesma pergunta. `cache()` do React deduplica chamadas idênticas dentro de uma mesma passada de renderização no servidor.

Em `src/lib/data/profile.ts`:

```ts
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Envolvida em `cache()` porque `/hoje` chama isto duas vezes por renderização
 * — uma no layout, outra na página. Sem a deduplicação são dois
 * `auth.getUser()` (que é rede, não CPU) e duas consultas a `profiles` para
 * responder a mesma pergunta. O `cache` do React vale por passada de
 * renderização no servidor: pedidos diferentes não compartilham nada.
 */
export const requireProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return { userId: user.id, profile };
});
```

`listProfiles` fica como está.

- [ ] **Step 2: Portões automáticos e verificação da dedupe**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```

Verificação manual: rodar `npm run dev`, abrir `/hoje` e conferir no terminal que não há erro; a dedupe em si não é observável na tela — o ganho é de latência. Para confirmar que funcionou, acrescentar temporariamente um `console.log("[profile] requireProfile")` dentro da função, recarregar `/hoje` e conferir que ele aparece **uma vez** por carregamento, não duas. Remover o log antes de commitar.

- [ ] **Step 3: Verificar a pré-condição da troca de `getUser` por `getClaims`**

**Esta verificação é humana e precisa de acesso ao painel do Supabase.** Abrir o projeto → Authentication → JWT Keys / Signing Keys e ler o algoritmo em uso.

- **Cenário A — chave assimétrica (ECC/RSA, `alg` `ES256` ou `RS256`):** seguir para o Step 4. `getClaims()` valida o token localmente com WebCrypto, sem ida à rede.
- **Cenário B — segredo simétrico (`HS256`):** **pular o Step 4** e ir direto para o Step 5. Com segredo simétrico, `getClaims()` faz o mesmo pedido de rede do `getUser()` e não há ganho nenhum; trocar seria só churn. A alternativa — confiar no cookie sem verificar — troca uma propriedade de segurança real por latência, e não é uma troca que este sistema deve fazer.

Anotar o resultado da verificação na mensagem de commit do Step 5, seja qual for.

- [ ] **Step 4: (Só no cenário A) Trocar `getUser` por `getClaims`**

Em `src/lib/supabase/middleware.ts`:

```ts
  // `getClaims()` valida o token localmente (WebCrypto) porque este projeto usa
  // chave de assinatura assimétrica — sem ida ao servidor de auth. Com segredo
  // simétrico ele cairia no mesmo pedido de rede do `getUser()`; se as chaves
  // do projeto mudarem, esta linha volta a custar uma viagem.
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims ?? null;
```

O resto de `updateSession` fica igual — as três checagens (`!user && !isAuthRoute && !isPublicAsset`, `user && isAuthRoute`, retorno) usam `user` só como "há sessão válida ou não".

Em `src/lib/data/profile.ts`, dentro do `cache()`:

```ts
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub ?? null;

  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile) redirect("/login");

  return { userId, profile };
```

- [ ] **Step 5: Portões, verificação manual e commit**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```

Verificação manual, obrigatória nos dois cenários porque mexe em autenticação:

1. Deslogado, abrir `/pipeline` — tem de redirecionar para `/login`.
2. Logar — tem de cair em `/hoje` com o nome e as iniciais certas na barra lateral.
3. Logado, abrir `/login` na barra de endereço — tem de redirecionar para `/hoje`.
4. Sair pelo botão da barra lateral — tem de voltar para `/login`, e `/hoje` não pode mais abrir.
5. Recarregar uma tela qualquer várias vezes seguidas — nenhuma tem de cair para o login sozinha.

```bash
git add src/lib/data/profile.ts src/lib/supabase/middleware.ts
git commit -m "$(cat <<'EOF'
perf: a sessão é resolvida uma vez por requisição

requireProfile passa por cache() do React: /hoje chamava a função duas
vezes por renderização (layout e página), o que eram dois auth.getUser()
— que é rede — e duas consultas a profiles para a mesma pergunta.

[CENÁRIO A] O projeto usa chave de assinatura assimétrica, então
middleware e requireProfile trocam getUser() por getClaims(), que valida
o token localmente com WebCrypto. Duas idas de rede a menos por
requisição, inclusive nos POSTs de Server Action.

[CENÁRIO B] O projeto usa segredo simétrico: getClaims() faria o mesmo
pedido de rede do getUser(), então a troca não entrou. Fica registrado
para quando as chaves do projeto migrarem.
EOF
)"
```

Apagar do texto do commit o cenário que não se aplica.

---

## Verificação final da 5F

Depois da Task 10, com tudo integrado:

- [ ] `npx vitest run` — 15 arquivos, todos passando.
- [ ] `npx tsc --noEmit` — limpo.
- [ ] `npx eslint .` — só o aviso conhecido de fonte em `app/layout.tsx`.
- [ ] `npm run build` — conclui.
- [ ] `grep -rn "router.refresh()" src --include=*.tsx | grep -v "^src/app/login"` — devolve exatamente **três** linhas, todas dentro de `.catch()` de quadro.
- [ ] Percorrer as sete telas uma vez, fazendo uma escrita em cada, e confirmar que nenhuma exige F5 para mostrar o resultado. **É a verificação que fecha a F1** — uma tela que precisa de F5 significa que uma action não revalida a rota de onde foi chamada, e a correção é na action.
- [ ] No DevTools, aba Network, filtrando por documento: uma escrita na gaveta do Pipeline tem de gerar **uma** requisição de action, não uma de action seguida de uma de RSC.

## Fora de escopo desta parte

Registrado para ninguém achar que foi esquecido: escala tipográfica, contraste, foco visível e ícone são a **5A**; mover cartão sem arrastar, telas responsivas e busca são a **5B**; Esc, foco preso, confirmação de descarte e hierarquia de botões são a **5C**. Paginação do Kanban, fila de Server Actions no cliente e republicação de tabelas em tempo real ficam fora da Fase 5 inteira.

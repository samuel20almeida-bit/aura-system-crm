# Unificação de `contas` e `clients` — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer tarefa, playbook e credencial se ligarem a `contas` — a tabela que a venda já usa — para que o Kanban deixe de abrir vazio e a pergunta "o que está pendente nesta conta" passe a ter resposta.

**Architecture:** Troca de referência, não modelo novo. `tasks`, `playbook_runs` e `credenciais` ganham `conta_id`; `contas` ganha `code_prefix` para os códigos de tarefa. A migration é **aditiva** — nada é apagado —, e a troca de consumidor acontece um módulo por vez, com `listClientsLite` convivendo com `listContasLite` até o último passo. Cada task deixa a árvore compilando.

**Tech Stack:** Next.js 16.2.12 (App Router, Server Actions), React 19.2.4, TypeScript 5, Supabase (`@supabase/ssr` 0.12.4), Vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-22-unificacao-contas-clients-design.md`

## Global Constraints

- **A migration é aditiva.** Não remove coluna, não remove tabela, não apaga linha. `clients` e as colunas `client_id`/`cliente_id` **ficam** — a limpeza é uma migration própria, depois da verificação humana.
- **`database.types.ts` é gerado do banco, e este ambiente não alcança o banco.** A Task 1 edita o arquivo à mão para casar com a migration; quando alguém aplicar a migration e regenerar, o diff deve ser nulo. É a única exceção à regra de não editar arquivo gerado, e existe para a árvore compilar em todas as tasks.
- **Não existe teste de componente React neste projeto** (sem `@testing-library/react`). Só `src/lib/**` tem teste automatizado. Para componente, o portão é tipos + lint + build + a verificação manual escrita na task.
- **O app não sobe aqui** (sem `.env.local`, sem projeto Supabase alcançável). Nenhuma task deve tentar rodar o app nem fingir que rodou. Cada uma lista seus passos manuais como DEFERIDOS AOS HUMANOS.
- **Ao fim de toda task:** `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`, `npm run build` limpos. O aviso de fonte em `src/app/layout.tsx` é conhecido e esperado.
- **`beginMutation()`/`end()` continua envolvendo toda escrita.**
- **Comentários e mensagens de commit em português**, explicando o porquê.
- **Nada de helper compartilhado novo** entre gavetas ou telas; o padrão do projeto é helper local por tela.

## Estrutura de arquivos

| Arquivo | Responsabilidade após a mudança |
| --- | --- |
| `supabase/migrations/0020_tarefas_por_conta.sql` | **criar** — as quatro colunas novas e o backfill do prefixo |
| `src/lib/supabase/database.types.ts` | modificar — casar com a migration |
| `src/lib/task-codes.ts` | modificar — ganha `derivePrefixoDaConta`, função pura |
| `src/lib/task-codes.test.ts` | modificar — testes da função nova |
| `src/lib/data/tasks.ts` | modificar — lê conta em vez de client; `listContasLite` |
| `src/lib/data/hoje.ts` | modificar — join por conta |
| `src/lib/data/credenciais.ts` | modificar — join por conta |
| `src/lib/actions/tasks.ts` | modificar — grava `conta_id`; `updateTask` aceita conta e escopo |
| `src/lib/actions/playbooks.ts` | modificar — `runPlaybook` grava `conta_id` |
| `src/lib/actions/credenciais.ts` | modificar — grava `conta_id` |
| `src/lib/actions/deals.ts` | modificar — preenche `code_prefix` no cadastro |
| `src/components/kanban/*` | modificar — tipo `ContaLite`, seletor, cartão, painel |
| `src/components/playbooks/PlaybooksClient.tsx` | modificar — seletor de conta |
| `src/components/credenciais/*` | modificar — seletor de conta |
| `src/app/(app)/{kanban,playbooks,credenciais}/page.tsx` | modificar — passam contas |

---

### Task 1: A migration e os tipos

Cria as colunas e alinha o arquivo de tipos. **Nenhuma mudança de comportamento** — depois desta task o app funciona exatamente como antes, só com colunas novas disponíveis.

**Files:**
- Create: `supabase/migrations/0020_tarefas_por_conta.sql`
- Modify: `src/lib/supabase/database.types.ts`

**Interfaces:**
- Consumes: nada.
- Produces: as colunas `contas.code_prefix`, `tasks.conta_id`, `playbook_runs.conta_id`, `credenciais.conta_id`, todas `string | null` nos tipos. Todas as tasks seguintes dependem delas.

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/0020_tarefas_por_conta.sql`:

```sql
-- Unificação de `contas` e `clients`: tarefa, execução de playbook e
-- credencial passam a apontar para a conta que a venda já usa.
--
-- ADITIVA DE PROPÓSITO. Nada é removido: `clients`, `tasks.client_id`,
-- `playbook_runs.client_id` e `credenciais.cliente_id` continuam onde estão.
-- Enquanto isto não rodar em produção com dado real, o caminho antigo intacto
-- é o que permite voltar atrás sem migration de emergência. Derrubar `clients`
-- também derrubaria `client_contacts`, `invoices` e `contracts` por cascata.
-- A limpeza é migration própria, condicionada à verificação humana.
--
-- ANTES DE APLICAR, conferir que não há dado a migrar (o esperado é zero nas
-- três, porque `clients` nunca teve escritor):
--   select count(*) from public.tasks         where client_id  is not null;
--   select count(*) from public.playbook_runs where client_id  is not null;
--   select count(*) from public.credenciais   where cliente_id is not null;
-- Se alguma devolver linha, PARAR: não existe regra automática que adivinhe
-- qual conta corresponde a qual cliente antigo.

-- ============ PREFIXO DO CÓDIGO DA TAREFA ============
-- As tarefas usam códigos `PREFIXO-NN` (`BAR-07`). O prefixo vinha de
-- `clients.code_prefix`; `contas` não tinha equivalente.
--
-- É coluna, e não derivação na hora de gerar o código, porque o prefixo é um
-- rótulo que as pessoas falam em voz alta. Derivado do nome, ele mudaria em
-- silêncio quando alguém corrigisse a grafia da conta, e as tarefas antigas
-- deixariam de combinar com as novas.
--
-- Colisão entre contas de nome parecido é aceita: `highestTaskCodeNumber` já
-- consulta `ilike 'BAR-%'` e toma o maior, então duas contas com o mesmo
-- prefixo compartilham a sequência e nenhum código se repete.
alter table public.contas add column code_prefix text;

-- `nullif(..., '')` deixa NULL em vez de string vazia; a leitura trata NULL
-- como "INT", que é o mesmo destino da regra em TypeScript
-- (`derivePrefixoDaConta`, src/lib/task-codes.ts). A remoção de acento usa
-- `translate` puro: habilitar a extensão `unaccent` por causa de um rótulo de
-- três letras não se paga.
update public.contas
   set code_prefix = nullif(
         upper(
           substr(
             translate(
               btrim(nome),
               'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
               'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
             ),
             1, 3
           )
         ),
         ''
       )
 where code_prefix is null;

-- ============ REFERÊNCIAS NOVAS ============
-- `on delete set null` e não `cascade`: apagar uma conta não pode levar junto
-- o histórico de trabalho feito para ela. Mesmo critério que `tasks.client_id`
-- já usava.
alter table public.tasks
  add column conta_id uuid references public.contas(id) on delete set null;
create index tasks_conta_idx on public.tasks (conta_id);

alter table public.playbook_runs
  add column conta_id uuid references public.contas(id) on delete set null;

alter table public.credenciais
  add column conta_id uuid references public.contas(id) on delete set null;
```

- [ ] **Step 2: Alinhar `database.types.ts` à mão**

O arquivo é gerado, mas este ambiente não alcança o banco. Editar à mão para a árvore compilar; quando alguém aplicar a migration e regenerar, o diff deve ser nulo.

Em **`contas`**, adicionar `code_prefix` em ordem alfabética dentro dos três blocos:
- `Row:` → `code_prefix: string | null`
- `Insert:` → `code_prefix?: string | null`
- `Update:` → `code_prefix?: string | null`

Em **`tasks`**, **`playbook_runs`** e **`credenciais`**, adicionar em ordem alfabética:
- `Row:` → `conta_id: string | null`
- `Insert:` → `conta_id?: string | null`
- `Update:` → `conta_id?: string | null`

E, no array `Relationships` de cada uma das três, acrescentar a entrada correspondente. O formato é o das existentes — em `tasks`, ao lado de `tasks_client_id_fkey`:

```ts
          {
            foreignKeyName: "tasks_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
```

Para as outras duas, os nomes são `playbook_runs_conta_id_fkey` e `credenciais_conta_id_fkey`, com `columns: ["conta_id"]` e `referencedRelation: "contas"`.

- [ ] **Step 3: Portões**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```
Expected: tudo limpo. Nada mudou de comportamento; se algo quebrar, é erro de digitação no arquivo de tipos.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0020_tarefas_por_conta.sql src/lib/supabase/database.types.ts
git commit -m "$(cat <<'EOF'
feat: colunas para ligar tarefa, playbook e credencial à conta

Aditiva de propósito: `clients` e as três colunas antigas ficam onde
estão. Enquanto isto não rodar em produção, o caminho antigo intacto é o
que permite voltar atrás sem migration de emergência.

`contas.code_prefix` é coluna, e não derivação na hora, porque o prefixo
do código da tarefa é um rótulo que se fala em voz alta — derivado do
nome, mudaria em silêncio a cada correção de grafia.

Os tipos foram editados à mão porque este ambiente não alcança o banco.
Ao aplicar a migration e regenerar, o diff deve ser nulo.
EOF
)"
```

---

### Task 2: A regra do prefixo, em TypeScript

A mesma regra que a migration aplicou uma vez em SQL, agora para toda conta nova. Função pura, e a **única task genuinamente testável** deste plano.

**Files:**
- Modify: `src/lib/task-codes.ts`
- Modify: `src/lib/task-codes.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `derivePrefixoDaConta(nome: string): string` — três letras maiúsculas sem acento, ou `"INT"` quando o nome não produz letra nenhuma. Usada pela Task 3 (`criarContaComNegocio`).

- [ ] **Step 1: Escrever os testes primeiro**

Acrescentar ao fim de `src/lib/task-codes.test.ts`:

```ts
describe("derivePrefixoDaConta", () => {
  it("usa as três primeiras letras, em maiúsculas", () => {
    expect(derivePrefixoDaConta("Barbearia do Léo")).toBe("BAR");
  });

  it("remove acento", () => {
    expect(derivePrefixoDaConta("Ótica Vera")).toBe("OTI");
  });

  it("ignora espaço no começo", () => {
    expect(derivePrefixoDaConta("  Studio X")).toBe("STU");
  });

  it("aceita nome com menos de três letras", () => {
    expect(derivePrefixoDaConta("Zé")).toBe("ZE");
    expect(derivePrefixoDaConta("A")).toBe("A");
  });

  it("devolve INT quando não sobra letra nenhuma", () => {
    // `contas.nome` é `not null` e a action recusa nome vazio, então isto não
    // deve acontecer — mas um prefixo vazio geraria códigos como "-01".
    expect(derivePrefixoDaConta("")).toBe("INT");
    expect(derivePrefixoDaConta("   ")).toBe("INT");
  });
});
```

Conferir que o `import` no topo do arquivo inclui `derivePrefixoDaConta` junto das funções já importadas.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/lib/task-codes.test.ts`
Expected: FAIL — `derivePrefixoDaConta` não existe ainda.

- [ ] **Step 3: Implementar**

Acrescentar a `src/lib/task-codes.ts`:

```ts
const COM_ACENTO = "áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ";
const SEM_ACENTO = "aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC";

/**
 * O prefixo do código da tarefa, derivado do nome da conta: três primeiras
 * letras, sem acento, em maiúsculas.
 *
 * A MESMA REGRA existe em SQL, no backfill da migration 0020. Não dá para o
 * banco chamar esta função nem o contrário sem inventar infraestrutura; o que
 * evita divergência é o teste, que cobre os mesmos casos que o `translate` de
 * lá. Mudar a regra obriga a tocar os dois lugares.
 *
 * `"INT"` quando o nome não produz letra nenhuma — prefixo vazio geraria
 * códigos como "-01". É o mesmo destino que a leitura dá a `code_prefix` nulo.
 */
export function derivePrefixoDaConta(nome: string): string {
  let saida = "";
  for (const caractere of nome.trim()) {
    const posicao = COM_ACENTO.indexOf(caractere);
    saida += posicao === -1 ? caractere : SEM_ACENTO[posicao];
    if (saida.length === 3) break;
  }
  return saida === "" ? "INT" : saida.toUpperCase();
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lib/task-codes.test.ts`
Expected: PASS, incluindo os testes que já existiam no arquivo.

- [ ] **Step 5: Portões e commit**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
git add src/lib/task-codes.ts src/lib/task-codes.test.ts
git commit -m "$(cat <<'EOF'
feat: derivePrefixoDaConta — o prefixo do código da tarefa

A mesma regra que a migration 0020 aplicou uma vez no backfill, agora
para toda conta nova. Duplicação deliberada e registrada no comentário:
banco e app não podem chamar a mesma função, e é o teste que impede a
divergência.
EOF
)"
```

---

### Task 3: Ler contas, e nascer com prefixo

Acrescenta `listContasLite` **ao lado** de `listClientsLite`, que continua existindo. Nenhum consumidor troca ainda — as tasks seguintes migram um módulo por vez, e é isto que mantém a árvore compilando em cada passo.

**Files:**
- Modify: `src/lib/data/tasks.ts`
- Modify: `src/lib/actions/deals.ts`

**Interfaces:**
- Consumes: `derivePrefixoDaConta(nome: string): string` (Task 2).
- Produces: `listContasLite(): Promise<{ id: string; nome: string }[]>` e o tipo exportado `export type ContaLite = { id: string; nome: string }`. As Tasks 4, 5 e 6 consomem os dois.

- [ ] **Step 1: Acrescentar `listContasLite`**

Em `src/lib/data/tasks.ts`, logo abaixo de `listClientsLite`:

```ts
export type ContaLite = { id: string; nome: string };

/**
 * As contas que podem receber tarefa, playbook ou credencial.
 *
 * TODAS, ordenadas por nome — sem filtrar por `fase`. Filtrar por
 * `fase = 'cliente'` esconderia justamente a conta em `prospect` para a qual
 * se está preparando uma proposta, que é trabalho real com tarefa real. A
 * fase governa o funil, não o direito de ter tarefa.
 */
export async function listContasLite(): Promise<ContaLite[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("contas").select("id, nome").order("nome");
  return data ?? [];
}
```

Não remover `listClientsLite` — ele ainda tem três consumidores, migrados nas Tasks 4, 5 e 6, e desaparece na Task 8.

- [ ] **Step 2: A conta nova nasce com prefixo**

Em `src/lib/actions/deals.ts`, dentro de `criarContaComNegocio`, no `insert` de `contas`, acrescentar o campo:

```ts
      code_prefix: derivePrefixoDaConta(nomeLimpo),
```

e o import no topo do arquivo:

```ts
import { derivePrefixoDaConta } from "@/lib/task-codes";
```

`nomeLimpo` é a variável que a função já calcula com `input.nome.trim()`. Não mexer em `atualizarConta`: renomear a conta **não** reescreve o prefixo, e é exatamente isso que se quer — o rótulo é estável por decisão de desenho.

- [ ] **Step 3: Portões**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```

- [ ] **Step 4: Verificação estática**

Não dá para rodar o app. Confirmar por leitura e registrar no relatório:
- `listClientsLite` continua exportada e com os mesmos três consumidores (`kanban/page.tsx`, `playbooks/page.tsx`, `credenciais/page.tsx`) — `grep -rn "listClientsLite" src`.
- Nenhuma tela consome `listContasLite` ainda.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/tasks.ts src/lib/actions/deals.ts
git commit -m "$(cat <<'EOF'
feat: listContasLite, e conta nova nasce com prefixo

Convive com listClientsLite de propósito: os três consumidores migram um
por task, e é isso que mantém a árvore compilando em cada passo.

listContasLite não filtra por fase — filtrar por 'cliente' esconderia a
conta em prospect para a qual se prepara proposta, que é trabalho real.

atualizarConta continua sem tocar no prefixo: renomear a conta não pode
reescrever um rótulo que já foi falado em voz alta.
EOF
)"
```

---

### Task 4: O Kanban passa a falar de contas

A maior task do plano, e coerente: é uma tela inteira, do banco ao cartão. Um revisor consegue aceitá-la ou rejeitá-la como unidade.

**Files:**
- Modify: `src/lib/data/tasks.ts`
- Modify: `src/lib/actions/tasks.ts`
- Modify: `src/app/(app)/kanban/page.tsx`
- Modify: `src/components/kanban/KanbanClient.tsx`
- Modify: `src/components/kanban/NewTaskModal.tsx`
- Modify: `src/components/kanban/TaskCard.tsx`

**Interfaces:**
- Consumes: `listContasLite()` e `ContaLite` (Task 3).
- Produces: `createTask` passa a receber `contaId: string | null` no lugar de `clientId`. A Task 5 usa o mesmo padrão em `runPlaybook`.

- [ ] **Step 1: A leitura passa a trazer a conta**

Em `src/lib/data/tasks.ts`, em `listTasks`, trocar o `select`:

```ts
    .select(
      "*, conta:contas(id, nome), assignee:profiles!tasks_assignee_id_fkey(id, full_name, initials)"
    )
```

Em `getTaskDetail`, na consulta de `tasks`, aplicar a mesma troca de `client:clients(id, name, color, code_prefix)` para `conta:contas(id, nome)`.

E `resolveTaskCodePrefix` passa a ler a conta:

```ts
async function resolveTaskCodePrefix(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contaId: string | null,
  isInternal: boolean
) {
  if (isInternal || !contaId) return "INT";
  const { data: conta } = await supabase
    .from("contas")
    .select("code_prefix")
    .eq("id", contaId)
    .single();
  // `code_prefix` nulo acontece se a conta nasceu numa janela entre a
  // migration e a Task 3. O código sai menos informativo, nunca quebra.
  return conta?.code_prefix ?? "INT";
}
```

Renomear o parâmetro `clientId` para `contaId` em `nextTaskCode` e `nextTaskCodes`, que só o repassam.

- [ ] **Step 2: A escrita grava a conta**

Em `src/lib/actions/tasks.ts`, em `createTask`: trocar `clientId` por `contaId` no tipo do `input`, passar `input.contaId` para `nextTaskCode`, e no `insert` trocar a linha do cliente por:

```ts
      conta_id: input.isInternal ? null : input.contaId,
```

**Não remover `client_id` do insert por engano** — ele simplesmente deixa de ser informado, e a coluna aceita nulo.

- [ ] **Step 3: A página passa contas**

Em `src/app/(app)/kanban/page.tsx`, trocar o import e a chamada de `listClientsLite` por `listContasLite`, e renomear a variável que ela alimenta de `clients` para `contas`, propagando para o `<KanbanClient>`.

- [ ] **Step 4: O cliente do Kanban fala de conta**

Em `src/components/kanban/KanbanClient.tsx`, substituir o tipo local:

```ts
type ContaLite = { id: string; nome: string };
```

Renomear a prop `clients` para `contas`, o estado `clientFilter` para `contaFilter`, e o filtro:

```ts
      if (contaFilter && t.conta_id !== contaFilter) return false;
```

No `<select>` de filtro, trocar o rótulo para `Todas as contas` e mapear `contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)`. Na visão em lista, a coluna CLIENTE passa a mostrar `t.conta?.nome ?? "Interno"`.

- [ ] **Step 5: O formulário de nova tarefa**

Em `src/components/kanban/NewTaskModal.tsx`: trocar o tipo `ClientLite` por `type ContaLite = { id: string; nome: string }`, a prop `clients` por `contas`, o estado `clientId` por `contaId` (com o mesmo `contas[0]?.id ?? ""` de valor inicial e o mesmo `contas.length === 0` decidindo `isInternal`), o rótulo do campo para `CONTA`, e a chamada:

```ts
        await createTask({
          title: title.trim(),
          contaId: isInternal ? null : contaId || null,
          isInternal,
          area: isInternal ? area : null,
          priority,
          assigneeId: assigneeId || null,
          dueDate: dueDate || null,
          description: description || null,
        });
```

Não tocar em nada do painel de Área — é trabalho recente de outra fase e não faz parte desta mudança.

- [ ] **Step 6: O quadradinho colorido sai do cartão**

Em `src/components/kanban/TaskCard.tsx`, substituir o bloco do cliente por:

```tsx
      {task.conta && (
        <div className="text-[11.5px] text-muted">{task.conta.nome}</div>
      )}
```

O quadradinho usava `clients.color`, e `contas` não tem cor. **Inventar uma cor por conta seria decoração sem fonte de verdade** — um valor que ninguém escolheu, que não significa nada, e que passaria a exigir tela de edição. O nome da conta já é a informação que ele tentava resumir. Registrar isso num comentário de uma linha acima do bloco.

O bloco de `task.is_internal && task.area`, logo abaixo, **não muda** — ali o quadradinho é cor fixa (`bg-ink`), não vem de tabela nenhuma.

- [ ] **Step 7: Portões**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```
Se `tsc` reclamar de `task.client` em algum lugar não listado acima, é um consumidor que este plano não previu: **parar e reportar**, não improvisar.

- [ ] **Step 8: Verificação**

Estática, para o relatório: `grep -rn "client:clients\|\.client\b" src/components/kanban src/lib/data/tasks.ts` não deve devolver nada.

DEFERIDO AOS HUMANOS (o app não sobe aqui):
1. Criar tarefa de cliente escolhendo uma conta — o código sai com o prefixo dela.
2. O Kanban abre no escopo "Clientes" e mostra a tarefa.
3. O filtro por conta funciona.
4. O cartão mostra o nome da conta e nenhum quadradinho colorido.

- [ ] **Step 9: Commit**

```bash
git add src/lib/data/tasks.ts src/lib/actions/tasks.ts "src/app/(app)/kanban/page.tsx" src/components/kanban
git commit -m "$(cat <<'EOF'
feat: o Kanban passa a falar de contas

A tarefa deixa de apontar para `clients` — tabela do CRM antigo sem
escritor desde a Fase 3A — e passa a apontar para a conta que a venda já
usa. É a causa de o Kanban abrir sempre vazio.

O quadradinho colorido do cartão sai junto: ele vinha de `clients.color`,
e `contas` não tem cor. Inventar uma por conta seria decoração sem fonte
de verdade. O nome da conta já estava ali.
EOF
)"
```

---

### Task 5: Playbooks passam a falar de contas

**Files:**
- Modify: `src/lib/actions/playbooks.ts`
- Modify: `src/app/(app)/playbooks/page.tsx`
- Modify: `src/components/playbooks/PlaybooksClient.tsx`
- Modify: `src/lib/data/playbooks.ts`

**Interfaces:**
- Consumes: `listContasLite()` e `ContaLite` (Task 3); `nextTaskCodes(contaId, isInternal, count)` (Task 4).
- Produces: nada que tasks seguintes consumam.

- [ ] **Step 1: A execução grava a conta**

Em `src/lib/actions/playbooks.ts`, `runPlaybook` passa a receber `contaId`:

```ts
export async function runPlaybook(playbookId: string, contaId: string | null) {
```

No `insert` de `playbook_runs`, trocar `client_id: clientId` por `conta_id: contaId`. Em `const isInternal = !clientId;` trocar para `!contaId`. Na chamada `nextTaskCodes(clientId, ...)` trocar para `contaId`. No `taskRows`, trocar `client_id: clientId` por `conta_id: contaId`.

- [ ] **Step 2: A leitura da execução traz a conta**

Em `src/lib/data/playbooks.ts`, no `select` que carrega as execuções, trocar `client:clients(id, name)` por `conta:contas(id, nome)`.

- [ ] **Step 3: Página e tela**

Em `src/app/(app)/playbooks/page.tsx`, trocar `listClientsLite` por `listContasLite` e renomear a variável para `contas`.

Em `src/components/playbooks/PlaybooksClient.tsx`: a prop `clients: { id: string; name: string }[]` vira `contas: { id: string; nome: string }[]`; o tipo `Run` passa a ter `conta: { id: string; nome: string } | null`; a linha que mostra `r.client?.name ?? "Interno"` vira `r.conta?.nome ?? "Interno"`; e o seletor do modal de execução lista `contas` por `nome`.

- [ ] **Step 4: Portões**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```

- [ ] **Step 5: Verificação**

Estática: `grep -rn "client" src/components/playbooks src/lib/actions/playbooks.ts src/lib/data/playbooks.ts` não deve devolver referência à tabela antiga.

DEFERIDO AOS HUMANOS:
1. Executar um playbook escolhendo uma conta.
2. As tarefas geradas aparecem no Kanban ligadas a essa conta, com o prefixo dela no código.
3. A execução aparece em "EM EXECUÇÃO" com o nome da conta, não "Interno".

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/playbooks.ts src/lib/data/playbooks.ts "src/app/(app)/playbooks/page.tsx" src/components/playbooks
git commit -m "$(cat <<'EOF'
feat: playbooks passam a falar de contas

runPlaybook recebia um clientId que nunca existia, então toda execução
virava "Interno" e as tarefas geradas nasciam sem dono. Agora a execução
e as tarefas ficam ligadas à conta escolhida.
EOF
)"
```

---

### Task 6: Credenciais passa a falar de contas

O módulo mais novo herdou a tabela morta: `credenciais.cliente_id` referencia `clients`, e o seletor "de qual cliente é esta credencial" nunca teve opção. Mesmo defeito, mesma correção.

**Files:**
- Modify: `src/lib/data/credenciais.ts`
- Modify: `src/lib/actions/credenciais.ts`
- Modify: `src/app/(app)/credenciais/page.tsx`
- Modify: `src/components/credenciais/CredenciaisClient.tsx`
- Modify: `src/components/credenciais/CredentialModal.tsx`

**Interfaces:**
- Consumes: `listContasLite()` e `ContaLite` (Task 3).
- Produces: nada que tasks seguintes consumam.

- [ ] **Step 1: Leitura e escrita**

Em `src/lib/data/credenciais.ts`, no `select`, trocar `cliente:clients(id, name)` por `conta:contas(id, nome)`.

Em `src/lib/actions/credenciais.ts`, o tipo `CredentialInput` tem o campo `clienteId: string | null`, gravado como `cliente_id` por `createCredential` e por `updateCredential`. Trocar os três: o campo do input vira `contaId`, e as duas escritas viram `conta_id: input.contaId`. **O significado não muda:** nulo continua sendo "credencial interna da Aura Studio", preenchido continua sendo "de um cliente".

- [ ] **Step 2: Página e telas**

Em `src/app/(app)/credenciais/page.tsx`, trocar `listClientsLite` por `listContasLite` e renomear a variável para `contas`.

Em `CredenciaisClient.tsx` e `CredentialModal.tsx`: substituir o tipo local `ClientLite = { id: string; name: string; color: string; code_prefix: string }` por `type ContaLite = { id: string; nome: string }`, renomear a prop `clients` para `contas`, e trocar as leituras de `cliente`/`.name` por `conta`/`.nome` — em `CredenciaisClient.tsx` a exibição é `credential.cliente ? credential.cliente.name : "Interna"`, que vira `credential.conta ? credential.conta.nome : "Interna"`.

**Não tocar no filtro da tela.** Ele filtra por categoria (`categoriaFiltro`), não por cliente, e não faz parte desta mudança — inclusive a mensagem de lista vazia que distingue "nenhuma nesta categoria" de "nenhuma cadastrada", que é correção recente de outra fase.

- [ ] **Step 3: Portões**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```

- [ ] **Step 4: Verificação**

Estática: `grep -rn "clients\|\.name\b" src/components/credenciais src/lib/data/credenciais.ts src/lib/actions/credenciais.ts` não deve devolver referência à tabela antiga.

DEFERIDO AOS HUMANOS:
1. Criar credencial escolhendo uma conta; ela aparece na lista com o nome da conta.
2. Criar credencial sem conta; continua aparecendo como interna.
3. O filtro da tela, se houver, continua funcionando.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/credenciais.ts src/lib/actions/credenciais.ts "src/app/(app)/credenciais/page.tsx" src/components/credenciais
git commit -m "$(cat <<'EOF'
feat: Credenciais passa a falar de contas

O módulo mais novo herdou a tabela morta: `credenciais.cliente_id`
apontava para `clients`, então o seletor "de qual cliente" nunca teve
opção. É o argumento de que a tabela morta estava se espalhando — ela
parecia viva no esquema e cada módulo novo se ligava a ela de boa-fé.
EOF
)"
```

---

### Task 7: Trocar a conta de uma tarefa

Corrige o achado C7 da auditoria: hoje uma tarefa criada como interna **nunca** vira tarefa de cliente, e a única saída é apagar e refazer — perdendo comentários, checklist e anexos.

**Files:**
- Modify: `src/lib/actions/tasks.ts`
- Modify: `src/components/kanban/TaskDetailPanel.tsx`

**Interfaces:**
- Consumes: `ContaLite` (Task 3), `conta_id` em `tasks` (Task 1).
- Produces: nada.

- [ ] **Step 1: `updateTask` aceita conta e escopo**

Em `src/lib/actions/tasks.ts`, acrescentar dois campos ao `Partial<>` do `patch`:

```ts
    conta_id: string | null;
    is_internal: boolean;
```

O corpo da função não muda — ela já repassa o `patch` inteiro para o `update`.

- [ ] **Step 2: O painel deixa trocar**

Em `src/components/kanban/TaskDetailPanel.tsx`, o painel passa a receber a prop `contas: { id: string; nome: string }[]` (vinda de `kanban/page.tsx`, que já a tem desde a Task 4) e ganha, ao lado do seletor de responsável, um seletor de conta:

```tsx
              <Field label="CONTA">
                <Select
                  value={t.conta_id ?? ""}
                  onChange={(e) =>
                    startTransition(async () => {
                      const end = beginMutation();
                      try {
                        const contaId = e.target.value || null;
                        await updateTask(t.id, { conta_id: contaId, is_internal: contaId === null });
                      } catch (erro) {
                        console.error("[kanban] falha ao trocar a conta da tarefa:", erro);
                        notify("error", "Não foi possível trocar a conta da tarefa. Tente de novo — se persistir, me avise.");
                      } finally {
                        end();
                      }
                    })
                  }
                >
                  <option value="">Interna</option>
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
              </Field>
```

Acrescentar acima o comentário que explica por que os dois campos andam juntos:

```tsx
              {/* Conta e escopo são um controle só: uma tarefa com conta não é
                  interna, e uma interna não tem conta. Deixar os dois separados
                  permitiria o estado incoerente "interna com conta". */}
```

O código da tarefa **não** é recalculado ao trocar de conta. `tasks.code` é único e já foi falado em voz alta; reescrevê-lo quebraria a referência de quem anotou o número. Registrar isso num comentário de uma linha.

- [ ] **Step 3: Portões**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```

- [ ] **Step 4: Verificação**

DEFERIDO AOS HUMANOS:
1. Abrir uma tarefa interna, trocar para uma conta — o cartão passa a mostrar o nome dela.
2. Conferir que comentários, checklist e anexos continuam lá.
3. Trocar de volta para "Interna" — o cartão volta a mostrar a área.
4. Conferir que o código da tarefa **não** mudou nas duas trocas.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/tasks.ts src/components/kanban/TaskDetailPanel.tsx
git commit -m "$(cat <<'EOF'
feat: trocar a conta de uma tarefa depois de criada

Achado C7 da auditoria: updateTask aceitava título, prazo, responsável,
prioridade e status — mas não conta nem escopo. Errar isso na criação
obrigava a apagar e refazer, perdendo comentários, checklist e anexos.

Conta e escopo mudam juntos porque são um controle só: tarefa com conta
não é interna. Separados, permitiriam o estado incoerente "interna com
conta".

O código da tarefa não é recalculado: `tasks.code` é único e já foi
falado em voz alta.
EOF
)"
```

---

### Task 8: `/hoje` e a aposentadoria de `listClientsLite`

Fecha a varredura. Depois desta task, **nenhuma linha do app lê `clients`**.

**Files:**
- Modify: `src/lib/data/hoje.ts`
- Modify: `src/components/hoje/HojeClient.tsx`
- Modify: `src/lib/data/tasks.ts`

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces: nada.

- [ ] **Step 1: `/hoje` lê a conta**

Em `src/lib/data/hoje.ts`, na consulta de `tasks`, trocar `client:clients(id, name)` por `conta:contas(id, nome)`.

Em `src/components/hoje/HojeClient.tsx`, trocar `clienteNome: t.client?.name ?? null` por `clienteNome: t.conta?.nome ?? null`. O campo do domínio (`clienteNome` em `src/lib/hoje.ts`) **não muda de nome** — ele descreve o que a linha mostra ("de quem é esta pendência"), não de qual tabela veio, e renomeá-lo espalharia a mudança por uma função pura que já tem teste.

- [ ] **Step 2: Apagar `listClientsLite`**

Em `src/lib/data/tasks.ts`, remover a função `listClientsLite` inteira. Ela não tem mais consumidor.

- [ ] **Step 3: Provar que `clients` ficou sem leitor**

Run: `grep -rn 'from("clients")\|client:clients\|cliente:clients' src --include=*.ts --include=*.tsx`
Expected: **nenhum resultado.** Se aparecer algum, é um consumidor que este plano não previu: parar e reportar.

A tabela continua no banco, por decisão registrada no spec. O que acabou é a leitura.

- [ ] **Step 4: Portões**

```bash
npx vitest run && npx tsc --noEmit && npx eslint . && npm run build
```

- [ ] **Step 5: Verificação**

DEFERIDO AOS HUMANOS:
1. `/hoje` mostra o nome da conta nas tarefas de cliente, e "Interno" nas internas.
2. O filtro por dono de `/hoje` continua funcionando.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/hoje.ts src/components/hoje/HojeClient.tsx src/lib/data/tasks.ts
git commit -m "$(cat <<'EOF'
fix: /hoje lê a conta, e clients fica sem leitor

Fecha a unificação: nenhuma linha do app lê mais `clients`. A tabela
continua no banco — a limpeza é migration própria, condicionada à
verificação humana, conforme o spec.

`clienteNome` mantém o nome no domínio: ele descreve o que a linha mostra,
não de qual tabela veio, e renomear espalharia a mudança por uma função
pura que já tem teste.
EOF
)"
```

---

## Verificação final da unificação

- [ ] `npx vitest run` — todos os arquivos, incluindo os testes novos de `derivePrefixoDaConta`.
- [ ] `npx tsc --noEmit`, `npx eslint .`, `npm run build` — limpos.
- [ ] `grep -rn 'from("clients")\|clients(' src --include=*.ts --include=*.tsx` — só o arquivo de tipos gerado.
- [ ] `grep -rn "listClientsLite" src` — nenhum resultado.

**A verificação que fecha esta mudança é humana e vem em ordem:**

1. **Antes de aplicar a migration**, rodar as três contagens de `client_id`/`cliente_id`. Zero nas três é o esperado. Qualquer linha → parar e decidir o mapeamento.
2. Aplicar `0020` e conferir que as contas existentes ganharam `code_prefix`.
3. Regenerar os tipos do Supabase e conferir que **o diff é nulo** contra o que a Task 1 escreveu à mão. Um diff aqui significa que a migration e os tipos discordam.
4. Percorrer os passos deferidos das Tasks 4 a 8.

## Fora de escopo

Registrado para não virar dívida esquecida: a **limpeza** de `clients`, `client_contacts`, `invoices`, `contracts` e das colunas `client_id`/`cliente_id` é uma migration própria, depois de a verificação humana confirmar que o Kanban funciona pela conta. A tela de Clientes e o churn são funcionalidade nova, da fase seguinte. Nada de 5A, 5B ou 5C entra aqui.

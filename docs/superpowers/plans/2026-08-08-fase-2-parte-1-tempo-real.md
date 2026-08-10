# Fase 2 · Parte I — Tempo real

**Spec:** `docs/superpowers/specs/2026-08-08-aura-fase-2-flexibilidade.md`
**Base:** `main` em produção (Fase 1 completa, 60 testes)
**Branch:** `feat/fase-2-tempo-real`

## Global Constraints

- **Idioma da interface:** português do Brasil. Toda string visível em pt-BR.
- **Paleta (`src/app/globals.css`):** fundo `--color-bone`, tinta `--color-ink`, acento `--color-accent`, erro `--color-red`, apoio `--color-muted`, tênue `--color-faint`.
- **Fuso horário:** toda data passa por `src/lib/timezone.ts`. Nunca `new Date()` cru para decidir "hoje".
- **Erros de Supabase:** Server Action confere `error` e lança. Leitor de dados que alimenta o layout confere e devolve estado honesto (padrão de `src/lib/data/notifications.ts`), nunca um zero confiante.
- **Duração de animação:** 120–240ms. O bloco global de `prefers-reduced-motion` em `globals.css` já neutraliza; **não** use o prefixo `motion-safe:`, que não gera CSS neste projeto.
- **Sem dados fictícios:** nenhuma migration insere cliente, tarefa, fatura ou meta de exemplo. A base é real e pertence a duas pessoas.
- **Migrations:** arquivo em `supabase/migrations/` **e** aplicada via ferramenta MCP. As duas coisas, sempre. Project ref `pknooqhosbieqgjzwtww`.
- **Verificação por tarefa:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` limpos antes de cada commit.
- **Sem navegador neste ambiente.** Nenhuma verificação visual é possível; nunca afirme ter visto algo renderizar. Tempo real, em particular, só se confirma com duas telas abertas — o que só Samuel e Saymon podem fazer.

## As três regras não negociáveis do tempo real

Valem para toda tarefa desta parte:

1. **O eco da própria ação não pode atrapalhar.** Quem agiu já viu o resultado pelo otimismo da Fase 1. Uma atualização chegando por cima disso causa piscada ou reversão visível.
2. **Atualização nunca destrói trabalho em curso.** Arraste em andamento, campo em edição, janela aberta — nada disso pode ser resetado por uma mudança que o outro fez.
3. **Rajada vira uma atualização.** Arrastar um card dispara vários UPDATE (status + posição de cada card da coluna). Isso não pode virar dez recarregamentos.

O perigo concreto, e a razão da regra 2: `src/components/kanban/KanbanBoard.tsx:107-110` contém

```tsx
if (tasks !== prevTasks) {
  setPrevTasks(tasks);
  setColumns(groupTasks(tasks));
}
```

Uma atualização no meio de um arraste substitui `columns` e o card volta para o lugar de origem na mão do usuário. Pausar durante o arraste não é refinamento, é requisito.

---

### Task 1: Fundação — publicar mudanças e assinar com segurança

Entrega o encanamento. Nenhuma tela muda de aparência.

**Files:**
- Create: `supabase/migrations/0011_realtime_publication.sql`
- Create: `src/lib/realtime/mutation-gate.ts`
- Create: `src/lib/realtime/mutation-gate.test.ts`
- Create: `src/lib/realtime/useLiveRefresh.ts`

**Interfaces:**
- Produces: `beginMutation(): () => void`, `isMutating(): boolean`, `subscribeToGate(fn): () => void`
- Produces: `useLiveRefresh(tables: string[], options?: { paused?: boolean }): LiveStatus`

- [ ] **Step 1: Publicar as tabelas**

`supabase/migrations/0011_realtime_publication.sql`:

```sql
-- Tempo real: o Postgres passa a anunciar mudanças nestas tabelas.
-- replica identity full é necessário para o evento de UPDATE/DELETE carregar a
-- linha antiga; sem isso o payload vem só com a chave e não dá para saber o que
-- mudou nem aplicar RLS sobre o registro anterior.
alter table public.tasks replica identity full;
alter table public.invoices replica identity full;
alter table public.clients replica identity full;
alter table public.deals replica identity full;
alter table public.time_entries replica identity full;
alter table public.activity_log replica identity full;

alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.invoices;
alter publication supabase_realtime add table public.clients;
alter publication supabase_realtime add table public.deals;
alter publication supabase_realtime add table public.time_entries;
alter publication supabase_realtime add table public.activity_log;
```

Aplicar via MCP `apply_migration`, nome `realtime_publication`. Confirmar com `execute_sql`:
`select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename;` — devem voltar as seis.

**Sobre permissão:** as seis tabelas têm `authenticated_full_access` com `using (auth.uid() is not null)` (`supabase/migrations/0003_rls.sql`). O canal do Supabase aplica RLS com o token do usuário logado, então a assinatura herda exatamente a mesma regra das tabelas — nem mais frouxa nem mais restrita. Confirme lendo `0003_rls.sql` antes de assumir.

- [ ] **Step 2: O portão de mutação (lógica pura, testável)**

O eco da própria ação precisa ser suprimido, e a única informação confiável que temos no cliente é "eu tenho uma escrita em andamento agora". `src/lib/realtime/mutation-gate.ts`:

```ts
/**
 * Conta escritas locais em andamento. Enquanto houver alguma, a atualização por
 * tempo real espera — é o que impede o eco da própria ação de passar por cima
 * do otimismo da Fase 1 e causar piscada ou reversão visível.
 *
 * Módulo puro: sem React, sem DOM. Um contador, não um booleano, porque duas
 * ações podem estar em voo ao mesmo tempo (arrastar um card enquanto um
 * comentário salva) e a primeira a terminar não pode liberar o portão.
 */
type Listener = () => void;

let inFlight = 0;
const listeners = new Set<Listener>();

function notify() {
  for (const fn of listeners) fn();
}

export function beginMutation(): () => void {
  inFlight += 1;
  notify();
  let released = false;
  return function end() {
    if (released) return;
    released = true;
    inFlight = Math.max(0, inFlight - 1);
    notify();
  };
}

export function isMutating(): boolean {
  return inFlight > 0;
}

export function subscribeToGate(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Só para os testes: zera o contador entre casos. */
export function resetGateForTests() {
  inFlight = 0;
  listeners.clear();
}
```

- [ ] **Step 3: Testes do portão**

`src/lib/realtime/mutation-gate.test.ts`, 5 casos:

1. Sem escritas, `isMutating()` é `false`.
2. Uma escrita em voo, `isMutating()` é `true`; liberada, volta a `false`.
3. **Duas escritas em voo: a primeira a terminar não abre o portão.** É o caso que um booleano erraria.
4. Liberar o mesmo retorno duas vezes não derruba o contador abaixo de zero nem abre o portão cedo.
5. `subscribeToGate` é chamado ao abrir e ao fechar, e o retorno cancela a inscrição.

- [ ] **Step 4: O hook**

`src/lib/realtime/useLiveRefresh.ts`:

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isMutating, subscribeToGate } from "./mutation-gate";

export type LiveStatus = "conectando" | "ao-vivo" | "sem-conexao";

const DEBOUNCE_MS = 400;

/**
 * Assina mudanças nas tabelas indicadas e pede dados novos ao servidor.
 *
 * `router.refresh()` refaz o payload do servidor preservando o estado dos
 * componentes cliente — janela aberta e campo digitado sobrevivem. O que NÃO
 * sobrevive é estado derivado de props, como o `columns` do KanbanBoard: por
 * isso existe `paused`, e por isso o Kanban a usa durante o arraste.
 */
export function useLiveRefresh(tables: string[], options?: { paused?: boolean }): LiveStatus {
  const router = useRouter();
  const [status, setStatus] = useState<LiveStatus>("conectando");
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paused = useRef(Boolean(options?.paused));
  paused.current = Boolean(options?.paused);

  // A lista vira string para não reassinar a cada render por identidade nova.
  const key = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`aura:${key}`);

    function flush() {
      timer.current = null;
      if (!pending.current) return;
      if (paused.current || isMutating()) {
        timer.current = setTimeout(flush, DEBOUNCE_MS);
        return;
      }
      pending.current = false;
      router.refresh();
    }

    function schedule() {
      pending.current = true;
      if (timer.current) return;
      timer.current = setTimeout(flush, DEBOUNCE_MS);
    }

    for (const table of key.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
    }

    channel.subscribe((s) => {
      if (s === "SUBSCRIBED") setStatus("ao-vivo");
      else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") setStatus("sem-conexao");
    });

    // Uma escrita que termina enquanto havia evento represado precisa acordar o
    // flush; senão a atualização fica esperando o próximo evento do outro.
    const unsubscribeGate = subscribeToGate(() => {
      if (pending.current && !timer.current) timer.current = setTimeout(flush, 0);
    });

    return () => {
      unsubscribeGate();
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [key, router]);

  return status;
}
```

- [ ] **Step 5: Ligar o portão nas ações existentes**

O portão só serve se as escritas o usarem. Em `src/components/ui/Toast.tsx` **não** — o lugar certo é cada chamada de Server Action no cliente. Comece pelas que já têm `startTransition`:

- `src/components/kanban/KanbanBoard.tsx` — `updateTaskPosition`
- `src/components/crm/CrmClient.tsx` — `markInvoiceStatus`, `updateDealStage`
- `src/components/metas/MetasClient.tsx` — `updateGoalProgress`, `deleteGoal`
- `src/components/crm/CrmModals.tsx` — dentro de `useCreateHandler`

Padrão:

```ts
const end = beginMutation();
try {
  await acao();
} finally {
  end();
}
```

- [ ] **Step 6: Verificar**

`npm test` (65 testes: 60 + 5 do portão), `npx tsc --noEmit`, `npm run lint`, `npm run build`.

Confirme por MCP que as seis tabelas estão na publicação. Registre no relatório que o comportamento ao vivo só é verificável com duas telas abertas.

- [ ] **Step 7: Commit**

`git commit -m "Assina as mudanças do banco e segura a atualização enquanto há escrita local"`

---

### Task 2: Fluxo de atividade ao vivo

O melhor negócio da fase: os dados já existem e ninguém os vê.

**Files:**
- Create: `src/lib/activity-feed.ts`
- Create: `src/lib/activity-feed.test.ts`
- Create: `src/lib/data/activity.ts`
- Create: `src/components/inicio/LiveActivity.tsx`
- Modify: `src/app/(app)/inicio/page.tsx`

**Interfaces:**
- Produces: `describeActivity(row, currentUserId): { who: string; text: string; when: string }`
- Produces: `getRecentActivity(limit?: number)`
- Produces: `<LiveActivity items />`

- [ ] **Step 1: A frase, como lógica pura**

`activity_log` guarda `verb` e `detail` separados, e as frases foram escritas para encaixar assim (conferido no banco): `verb: "moveu Finalizar o CRM para"`, `detail: "Em andamento"`; `verb: "criou a tarefa"`, `detail: "Finalizar o CRM"`; `verb: "lançou"`, `detail: "1,5h"`.

`src/lib/activity-feed.ts` monta a linha exibida, sem tocar em React, DOM ou Supabase:

- Quem: primeiro nome do autor, ou **"Você"** quando `user_id === currentUserId`.
- Texto: `verb` + `detail`, com espaço único e sem espaço sobrando quando `detail` é nulo.
- Quando: tempo relativo em pt-BR — "agora", "há 2 min", "há 3 h", "ontem", e a data para o que passa de 7 dias. Use os helpers de `src/lib/timezone.ts` para decidir o dia.

Autor nulo (três linhas antigas do banco têm) vira **"Alguém"**, não string vazia.

- [ ] **Step 2: Testes**

`src/lib/activity-feed.test.ts`, 6 casos: você mesmo vira "Você"; outro vira o primeiro nome; autor nulo vira "Alguém"; `detail` nulo não deixa espaço sobrando; "agora" abaixo de um minuto; a virada de "há 59 min" para "há 1 h".

- [ ] **Step 3: A leitura**

`src/lib/data/activity.ts` — `getRecentActivity(limit = 12)`, juntando `user:profiles(id, full_name, initials)`, ordenado por `created_at desc`. **Confere `error`** e devolve estado honesto; nunca lista vazia silenciosa.

- [ ] **Step 4: A tela**

`src/components/inicio/LiveActivity.tsx`, componente cliente:

- Chama `useLiveRefresh(["activity_log"])`.
- Lista as entradas com avatar, frase e tempo relativo.
- O tempo relativo é recalculado por um intervalo de 60s no cliente — **começando pelo valor vindo do servidor**, para não haver diferença entre servidor e primeiro quadro (mesma armadilha do TimerWidget da Task 8).
- Entrada nova entra com `animate-slide-in`, sem o prefixo `motion-safe:`.
- Vazio: "Nada aconteceu por aqui ainda."

Montar na `/início` como um painel. O card "PRECISA DE VOCÊ" continua onde está — um diz o que exige ação, o outro diz o que aconteceu.

- [ ] **Step 5: Verificar e commitar**

Quatro comandos limpos, 71 testes. `git commit -m "Mostra ao vivo o que o outro está fazendo"`

---

### Task 3: Quem está online, e em que tela

**Files:**
- Create: `src/lib/realtime/usePresence.ts`
- Create: `src/components/layout/PresenceRow.tsx`
- Modify: `src/components/layout/Topbar.tsx`, `src/components/layout/AppShell.tsx`

- [ ] **Step 1: O hook**

Presença é recurso do canal do Supabase — não precisa de tabela, coluna nem migração.

```ts
const channel = supabase.channel("aura:presenca", {
  config: { presence: { key: userId } },
});
channel.on("presence", { event: "sync" }, () => setPeers(channel.presenceState()));
channel.subscribe(async (s) => {
  if (s === "SUBSCRIBED") await channel.track({ name, initials, module: moduleFromPath(pathname) });
});
```

Re-anunciar (`track`) quando o caminho mudar, para o módulo acompanhar a navegação. **Excluir o próprio usuário** da lista exibida: ninguém precisa ser informado de que está online.

`moduleFromPath` traduz a rota para o nome que aparece no menu — `/kanban` → "Kanban", `/crm/[id]` → "CRM". Função pura, no mesmo arquivo do hook ou em `src/lib/nav-labels.ts` se já houver mapa parecido; **procure antes de criar um segundo**.

- [ ] **Step 2: A faixa**

`PresenceRow` na barra superior: avatar com as iniciais e um ponto verde; ao passar o mouse, "Saymon · no Kanban". No celular, só o avatar com o ponto — a barra superior já é apertada (a Task 11 precisou enxugá-la).

Sem ninguém além de você, não renderiza nada. Uma faixa vazia com um avatar só é ruído.

- [ ] **Step 3: Verificar e commitar**

`git commit -m "Mostra quem está online e em que tela"`

---

### Task 4: Cronômetro do outro à vista

**Files:**
- Modify: `src/lib/data/time.ts`, `src/components/layout/TimerWidget.tsx`, `src/app/(app)/layout.tsx`

- [ ] **Step 1: Ler os cronômetros dos outros**

`getRunningTimersOfOthers(currentUserId)` em `src/lib/data/time.ts`: entradas com `ended_at is null` de **outros** usuários, com tarefa, código e cliente.

Ler do banco e não da presença é deliberado: se o Saymon fechar o notebook com o cronômetro rodando, ele **continua rodando** — e é exatamente essa a situação que interessa ver. Presença sumiria e esconderia o problema.

Confere `error` (o vizinho `getRunningTimer` já foi corrigido nesta linha; siga o mesmo padrão).

- [ ] **Step 2: Mostrar**

Ao lado do seu cronômetro, em tom mais discreto: `SY · 0:42 · NIM-04`. Passa de 8 horas, ganha o mesmo alerta do seu — o limiar já é constante compartilhada (`FORGOTTEN_TIMER_MS` em `src/lib/notifications.ts`).

Assinar `time_entries` com `useLiveRefresh` para começar e parar aparecerem sozinhos.

No celular, não renderizar: a Task 11 já teve de enxugar a barra para caber.

- [ ] **Step 3: Verificar e commitar**

`git commit -m "Mostra o cronômetro do outro fundador na barra"`

---

### Task 5: Colisão avisa em vez de sobrescrever

O item mais caro, e o único que mexe no esquema.

**Files:**
- Create: `supabase/migrations/0012_row_versioning.sql`
- Create: `src/lib/conflict.ts` + `src/lib/conflict.test.ts`
- Modify: `src/lib/actions/tasks.ts`, `src/components/kanban/TaskDetailPanel.tsx`

- [ ] **Step 1: A migration**

```sql
-- Quem mudou e quando, mantidos pelo banco. Pela aplicação seria pior: o que a
-- aplicação esquece de preencher, o banco não esquece.
create or replace function public.touch_row()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
```

Acrescentar `updated_at timestamptz not null default now()` e `updated_by uuid references public.profiles(id)` onde faltarem (`tasks` já tem `updated_at`; `invoices`, `clients`, `goals`, `contracts` não têm nenhum dos dois), e criar o gatilho `before update` em cada uma.

Aplicar via MCP e conferir com `execute_sql` que as cinco tabelas têm as duas colunas e o gatilho.

- [ ] **Step 2: A regra, pura e testada**

`src/lib/conflict.ts` — dado o `updated_at` que a tela carregou e o que está no banco, decidir: sem conflito, conflito, ou registro apagado. Quatro testes.

- [ ] **Step 3: A escrita**

`updateTask` passa a receber o `updated_at` de origem e a escrever com `.eq("updated_at", origem)`. Zero linhas afetadas significa que alguém mudou antes — a ação devolve um resultado de conflito com a linha atual, **sem lançar**: conflito não é erro de sistema, é informação.

- [ ] **Step 4: O aviso**

No painel da tarefa, uma faixa: *"Saymon mudou esta tarefa enquanto você editava"*, mostrando o valor dele, com "usar o meu" e "ficar com o dele". Sem escolha automática — o sistema não adivinha qual está certo.

- [ ] **Step 5: Verificar e commitar**

`git commit -m "Avisa quando o outro mudou o mesmo registro em vez de sobrescrever"`

---

### Task 6: Sinal honesto de defasagem

**Files:**
- Create: `src/components/layout/LiveStatusBar.tsx`
- Modify: `src/components/layout/AppShell.tsx`

- [ ] **Step 1**

`useLiveRefresh` já devolve `"conectando" | "ao-vivo" | "sem-conexao"`. Em `sem-conexao`, uma faixa discreta: *"Sem conexão ao vivo — os dados podem estar desatualizados."* com botão "atualizar" chamando `router.refresh()`.

Em `ao-vivo`, **não mostrar nada**. Um selo permanente de "ao vivo" é ruído: o normal não precisa de anúncio, só a exceção.

Não mostrar nada durante `conectando` nos primeiros segundos — uma faixa que pisca a cada carregamento de página é pior que o problema que resolve.

- [ ] **Step 2: Verificar e commitar**

`git commit -m "Avisa quando a atualização ao vivo cai em vez de mostrar dado velho"`

---

### Task 7: Corrigir "lançou 0h"

Achado no histórico real do usuário em 2026-08-08 22:40.

**Files:** `src/lib/format.ts` (ou onde a frase é montada), `src/lib/actions/time.ts`, mais testes.

- [ ] **Step 1**

Um cronômetro curto virou a linha `lançou 0h` no histórico. `elapsedMinutes` garante o mínimo de 1 minuto (`src/lib/time-math.ts`), então o problema é a formatação: abaixo de 30 minutos o arredondamento em horas come tudo.

Passar a escrever em minutos abaixo de 1 hora — `lançou 12min` — e manter horas acima disso. Cobrir com testes as fronteiras: 1 min, 59 min, 60 min, 90 min.

- [ ] **Step 2: Verificar e commitar**

`git commit -m "Escreve lançamentos curtos em minutos em vez de arredondar para 0h"`

---

## Verificação final da Parte I

Depois das sete tarefas: revisão da branch inteira pelo modelo mais capaz, uma rodada de correção, e uma re-revisão escopada — o mesmo ciclo da Fase 1, que encontrou 23 defeitos, 19 deles originados no plano.

**E então a verificação que só os donos podem fazer**, com Samuel e Saymon logados ao mesmo tempo em máquinas diferentes:

1. Samuel move um card. A tela do Saymon acompanha sem ele tocar em nada.
2. Samuel arrasta um card **enquanto** o Saymon mexe em outro. O card na mão do Samuel não volta para o lugar.
3. Saymon inicia um cronômetro. Aparece na barra do Samuel.
4. Os dois abrem a mesma tarefa e editam o mesmo campo. O segundo a salvar é avisado, não sobrescreve calado.
5. Saymon põe o celular em modo avião. A tela dele avisa que perdeu a conexão.
6. Samuel cria uma tarefa. A linha aparece no fluxo de atividade do Saymon em segundos.

Nenhum desses seis é verificável por mim. Todos são verificáveis por vocês em dez minutos.

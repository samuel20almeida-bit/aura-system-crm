# Fase 3A — O núcleo: contas, negócios, Hoje e Pipeline

**Spec:** `docs/superpowers/specs/2026-08-14-aura-fase-3-crm-de-agentes.md`
**Protótipo:** `auracrminterfaces.html`, enviado pelo Samuel
**Base:** `main` (Fase 1 + Parte I do tempo real, ambas em produção)
**Branch:** `feat/fase-3a-nucleo-crm`

## Global Constraints

- **Idioma:** português do Brasil em toda string visível.
- **Paleta:** o protótipo usa exatamente os tokens que já existem em `src/app/globals.css` — `--osso`/`bone`, `--grafite`/`ink`, `--petroleo`/`accent` (`#0B6B54`), `--alerta`/`red`, `--atencao`. Reusar os tokens do projeto; **não** introduzir cor nova.
- **Tipografia:** Archivo (corpo), IBM Plex Mono (dados e rótulos), Fraunces itálico (ênfase rara). Igual ao protótipo, igual ao que já existe.
- **Fuso:** toda data passa por `src/lib/timezone.ts`. Nunca `new Date()` cru para decidir "hoje", "atrasado" ou "há N dias".
- **Erros de Supabase:** Server Action confere `error` e lança. Leitor que alimenta layout confere e devolve estado honesto (padrão de `src/lib/data/notifications.ts`), nunca um zero confiante.
- **Sem `motion-safe:`** — não gera CSS neste projeto. O bloco global de `prefers-reduced-motion` em `globals.css` já cobre.
- **Sem dados fictícios.** O protótipo vem cheio de contas de exemplo (Odonto Vila Mariana, Barbearia Rei do Norte…). **Nenhuma delas entra em migration.** O banco começa vazio e o Samuel cadastra o pipeline real.
- **Migrations:** arquivo em `supabase/migrations/` **e** aplicada via MCP. As duas coisas. Project ref `pknooqhosbieqgjzwtww`.
- **Verificação por tarefa:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` limpos antes de cada commit.
- **Sem navegador neste ambiente.** Nenhuma verificação visual é possível; nunca afirmar ter visto algo renderizar.

## O que o tempo real já entrega, e o que não entrega

A Parte I parou em 3 de 7. Hoje `useLiveRefresh` só é montado na `/início` e a publicação do banco cobre **só `activity_log`**. As telas novas desta fase **não nascem ao vivo** — e isso é escolha consciente, não esquecimento: republicar tabela é uma linha, e a hora de decidir isso é quando o modelo novo estiver estável, não agora.

O portão de escrita (`beginMutation`) continua valendo e deve ser usado nas ações novas, pelo mesmo motivo de sempre.

---

### Task 1: Aposentar o cronômetro e a tela de Horas

Primeiro, para o resto ser construído sobre base limpa. É remoção pura: nada novo nasce aqui.

**Files:**
- Delete: `src/app/(app)/horas/` (página, loading), `src/components/horas/`, `src/components/layout/TimerWidget.tsx`, `src/lib/actions/time.ts`, `src/lib/data/time.ts`, `src/lib/time-math.ts` e seus testes, `src/app/api/horas/export/route.ts`
- Modify: `src/components/layout/Sidebar.tsx`, `src/components/layout/Topbar.tsx`, `src/components/layout/AppShell.tsx`, `src/app/(app)/layout.tsx`, `src/lib/notifications.ts`, `src/lib/data/notifications.ts`, `src/components/kanban/TaskDetailPanel.tsx`, `src/components/kanban/KanbanBoard.tsx` e `TaskCard.tsx` (o `isRunning`), `src/lib/data/dashboard.ts`, `src/lib/data/nav.ts`
- Create: `supabase/migrations/0014_remove_time_tracking.sql`

- [ ] **Step 1: Levantar o alcance antes de apagar**

`grep -rn "time_entries\|TimerWidget\|startTimer\|stopRunningTimer\|getRunningTimer\|elapsedMinutes\|FORGOTTEN_TIMER\|isRunning\|/horas" src/`

O cronômetro atravessou três tarefas da Fase 1 (T8 global, T9 sino, T11 celular) e a Parte I da Fase 2 (portão). **Não confie nesta lista de arquivos** — ela é o que eu enxerguei, e o grep é a verdade.

- [ ] **Step 2: O sino perde o aviso de timer esquecido**

`src/lib/notifications.ts` tem a categoria `timer` e a constante `FORGOTTEN_TIMER_MS`. Sai a categoria, sai a constante, saem os testes correspondentes. Os outros avisos — fatura vencida, tarefa atrasada, tarefa de hoje, contrato terminando — **não mudam**, e os testes deles têm que continuar verdes sem edição. Se algum precisar de edição, é sinal de acoplamento que não devia existir; **pare e me diga**.

- [ ] **Step 3: A barra superior e o layout**

`TimerWidget` some da `Topbar`; `getRunningTimer` some do `(app)/layout.tsx` e do `Promise.all`. O `AppShell` perde a prop `running`. A `PresenceRow` e o `NotificationBell` **ficam** exatamente onde estão.

Atenção: `FORGOTTEN_TIMER_MS` era importado pelo `TimerWidget` **de dentro de** `notifications.ts`. Confirme que remover não deixa import órfão nem quebra o tree-shaking que mantinha `buildNotifications` fora do bundle do cliente.

- [ ] **Step 4: O Kanban**

`TaskCard` tem `isRunning` e o ponto pulsante; `KanbanBoard` e `Column` repassam `runningTaskId`. Some a cadeia inteira. O arraste, o otimismo, o `dragDisabled` do celular e o contador de interação **não mudam**.

- [ ] **Step 5: A migration**

```sql
-- O cronômetro sai por decisão do dono do sistema (spec da Fase 3).
-- A tabela some junto: manter tabela sem escritor é dívida que ninguém lembra.
drop table if exists public.time_entries;
```

`time_entries` já saiu da publicação de tempo real na 0013, então não há publicação a limpar. Confirme por `execute_sql` que a tabela deixou de existir e que **nenhuma view ou função** referenciava ela.

- [ ] **Step 6: Verificar**

Quatro comandos limpos. A contagem de testes **cai** (saem os de `time-math` e os de timer no sino) — diga o número final e quais saíram.

- [ ] **Step 7: Commit**

`git commit -m "Remove o controle de horas e o cronômetro"`

---

### Task 2: O modelo novo

**Files:**
- Create: `supabase/migrations/0015_crm_agentes.sql`
- Modify: `src/lib/supabase/database.types.ts`

- [ ] **Step 1: A migration**

```sql
-- Uma conta, várias fases. O protótipo tinha três listas separadas (deals,
-- implantacoes, clientes) para o MESMO negócio em momentos diferentes da vida,
-- o que perde histórico e obriga a copiar dado de uma para a outra.

create type public.conta_fase as enum ('prospect','implantacao','cliente','perdido','churn');
create type public.deal_estagio as enum ('lead','contato','qualificado','diagnostico','proposta');
create type public.deal_resultado as enum ('ganho','perdido');
create type public.etapa_espera as enum ('nos','cliente');

create table public.contas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nicho text,
  cidade text,
  uf text,
  decisor_nome text,
  software_atual text,
  origem text,
  fase public.conta_fase not null default 'prospect',
  dono_id uuid references public.profiles(id),
  criado_em timestamptz not null default now()
);

create table public.planos (
  id uuid primary key default gen_random_uuid(),
  nicho text not null,
  nome text not null,
  setup numeric(12,2) not null,
  mrr numeric(12,2) not null,
  ativo boolean not null default true,
  posicao int not null default 0
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  estagio public.deal_estagio not null default 'lead',
  plano_id uuid references public.planos(id),
  -- Copiados do plano na proposta, NUNCA referenciados: subir o preço em
  -- novembro não pode reescrever o que foi vendido em agosto.
  setup numeric(12,2),
  mrr numeric(12,2),
  desconto numeric(12,2) not null default 0,
  proximo_passo text,
  proximo_passo_em date,
  mexido_em timestamptz not null default now(),
  resultado public.deal_resultado,
  motivo_perda text,
  fechado_em date,
  dono_id uuid references public.profiles(id),
  criado_em timestamptz not null default now()
);

create table public.implantacao_etapas (
  posicao int primary key,
  nome text not null,
  sla_dias int not null,
  -- Registrado desde já, mesmo sem tela: duas destas etapas dependem do
  -- cliente, e alertar igual as duas famílias faz o alerta perder valor.
  espera public.etapa_espera not null default 'nos'
);

insert into public.implantacao_etapas (posicao, nome, sla_dias, espera) values
  (0, 'Pago · aguardando kickoff', 1, 'cliente'),
  (1, 'Coleta de acessos',         1, 'cliente'),
  (2, 'Build do agente',           2, 'nos'),
  (3, 'Teste com o cliente',       1, 'cliente'),
  (4, 'Go-live',                   1, 'nos'),
  (5, 'Acompanhamento D+7',        7, 'nos');
```

Índices em `deals(estagio)`, `deals(proximo_passo_em)`, `deals(conta_id)`, `contas(fase)`.

RLS igual ao resto do sistema — `authenticated_full_access` com `auth.uid() is not null`, o mesmo padrão de `0003_rls.sql`. Não invente política diferente aqui.

**`implantacao_etapas` é a única tabela que nasce com linhas**, e não são dados fictícios: são a configuração da esteira, que o spec definiu. Nenhuma conta, nenhum negócio, nenhum plano de exemplo.

- [ ] **Step 2: Aplicar e conferir**

Via MCP `apply_migration`. Confirmar por `execute_sql`: as quatro tabelas existem, os quatro tipos existem, `implantacao_etapas` tem 6 linhas, `contas`/`deals`/`planos` têm **zero**, e RLS está ligada nas quatro.

- [ ] **Step 3: Tipos**

Regenerar ou estender `src/lib/supabase/database.types.ts`. Se usar a ferramenta MCP de gerar tipos, confira o diff antes de aceitar — ela reescreve o arquivo inteiro.

---

### Task 3: "Apodrecendo", como regra pura e testada

O coração da fase. Se esta função estiver errada, o sistema mente sobre a coisa que ele existe para dizer.

**Files:**
- Create: `src/lib/deals.ts`, `src/lib/deals.test.ts`

- [ ] **Step 1: A regra**

Um negócio está podre quando **não tem próximo passo**, **ou** o próximo passo está vencido, **ou** está parado há mais de 7 dias.

Assinatura pura, no molde de `isInvoiceOverdue` (`src/lib/invoices.ts`) — que é o precedente do projeto e resolveu exatamente o mesmo tipo de problema:

```ts
export type SaudeDeal = "ok" | "atencao" | "podre";

export function saudeDoDeal(
  deal: { proximoPasso: string | null; proximoPassoEm: string | null; mexidoEm: string },
  hoje: string,
  agora: number
): SaudeDeal
```

`atencao` é o estado intermediário do protótipo (`.dot.aberto`): parado entre 4 e 7 dias, ainda com próximo passo.

**Sem React, sem DOM, sem Supabase.** É o que torna os testes possíveis.

- [ ] **Step 2: Testes**

Mínimo **10** casos: sem próximo passo → podre; próximo passo vencido ontem → podre; vence hoje → ok; vence amanhã → ok; parado 8 dias com próximo passo futuro → podre; parado 5 dias → atenção; parado 3 dias → ok; a fronteira exata de 7 dias; a fronteira exata de 4; e um às 23h de São Paulo, que é onde o fuso morde (a Fase 1 teve esse defeito em três lugares).

- [ ] **Step 3: Commit**

---

### Task 4: Pipeline

**Files:**
- Create: `src/app/(app)/pipeline/page.tsx` + `loading.tsx`, `src/components/pipeline/PipelineClient.tsx`, `src/components/pipeline/DealCard.tsx`, `src/components/pipeline/DealDrawer.tsx`, `src/lib/data/deals.ts`, `src/lib/actions/deals.ts`

- [ ] **Step 1: As cinco colunas**

Lead · Contato · Qualificado · Diagnóstico · Proposta. **Não existe coluna de ganho** — ganhar é passagem de bastão, e vira botão na gaveta do negócio, não sexta coluna.

Arrastar entre colunas reusa a mecânica do Kanban (`@dnd-kit`, `src/lib/optimistic.ts`, o portão de interação). **Leia `KanbanBoard.tsx` antes de escrever**: ele carrega três correções que custaram caro — a coluna de origem vem do snapshot do início do arraste, soltar fora reverte, e `onDragCancel` não é `onDragEnd`. Não reinvente; reuse ou copie com os comentários.

- [ ] **Step 2: O cartão**

Conta, nicho, cidade, dono, valor (setup + MRR), e o **ponto de saúde** — verde, contorno, ou vermelho pulsando — vindo de `saudeDoDeal`. Abaixo, o próximo passo e quando vence, ou **"sem próximo passo"** em vermelho, que é o estado que o sistema existe para gritar.

- [ ] **Step 3: A gaveta**

Abre sobre a tela, não navega — o padrão que o `trycompai/crm` usa e que o spec da Fase 2 já tinha registrado como certo. Mostra decisor, software atual, origem, histórico da conta, e os botões: **definir próximo passo**, **ganhar** (vira implantação, fase da conta muda), **perder** (pede motivo).

O campo de próximo passo é texto + data, e salvar **atualiza `mexido_em`** — é o que zera o relógio do apodrecimento.

- [ ] **Step 4: Verificar e commitar**

---

### Task 5: Hoje

**Files:**
- Create: `src/app/(app)/hoje/page.tsx` + `loading.tsx`, `src/components/hoje/HojeClient.tsx`, `src/lib/hoje.ts` + `src/lib/hoje.test.ts`, `src/lib/data/hoje.ts`

- [ ] **Step 1: Três fontes, um formato**

Próximo passo de negócio + tarefa não concluída, unificados numa lista só, cada linha com texto, contexto, dono, vencimento e ponto de saúde. (Implantação entra na 3B; a função tem que aceitar a terceira fonte sem reescrita.)

A unificação é **função pura e testada** em `src/lib/hoje.ts` — 6 testes no mínimo, incluindo a ordenação (atrasado primeiro, depois hoje, depois futuro) e o empate.

- [ ] **Step 2: O filtro por dono**

Todos · Samuel · Saymon, conforme o protótipo. É estado de tela; **ponha na URL**, não em `useState` — o spec da Fase 2 registrou por quê, e é barato fazer certo agora.

- [ ] **Step 3: Esta tela substitui o "PRECISA DE VOCÊ"**

O card da `/início` e o sino dizem a mesma coisa com dados diferentes — dívida registrada no ledger da Fase 1 (achado M10/C4). **A `/hoje` passa a ser a fonte, e o card sai da `/início`.** O sino continua, apontando para cá.

- [ ] **Step 4: Verificar e commitar**

---

### Task 6: Navegação e aposentadoria do CRM antigo

- [ ] **Step 1**

Menu novo: **Hoje · Pipeline · Kanban · Metas · Playbooks**. `/crm` e `/horas` saem. `/inicio` vira redirecionamento para `/hoje` — não apague a rota sem redirecionar, senão o atalho que o Samuel já tem no navegador quebra.

O CRM antigo (`clients`, `contracts`, `invoices`, `deals` antigos) fica **no banco, sem tela**, até a 3C decidir o que migra. Não apague tabela nesta tarefa: a 3C precisa olhar para elas.

- [ ] **Step 2: Verificar e commitar**

---

## Depois da 3A: parar

**Antes de construir implantação, clientes ou painel, o Samuel cadastra o pipeline real.**

A ideia central desta fase — "apodrecendo" — só tem valor se os negócios de verdade estiverem no sistema. Com o pipeline na cabeça e no WhatsApp, as cinco telas mais bonitas do mundo não avisam de nada.

E usando de verdade aparecem coisas que nenhum de nós prevê agora: que falta um campo, que "Diagnóstico" na verdade são duas etapas, que o próximo passo precisa de hora e não só de data. A 3B sai calibrada em vez de chutada.

## Verificação final da 3A

Revisão da branch inteira pelo modelo mais capaz, uma rodada de correção, uma re-revisão escopada. O mesmo ciclo que na Fase 1 encontrou 23 defeitos (19 originados no plano) e na Parte I da Fase 2 encontrou mais 4 críticos.

E o que só o Samuel pode fazer: **cadastrar um negócio real, definir um próximo passo, deixar vencer, e conferir que o ponto fica vermelho.**

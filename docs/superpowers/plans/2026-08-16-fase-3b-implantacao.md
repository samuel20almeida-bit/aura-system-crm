# Fase 3B — Implantação: esteira com SLA e passagem de bastão

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um negócio ganho no Pipeline vira uma implantação automaticamente, atravessa seis etapas com prazo (SLA), e a esteira aparece em `/hoje` como terceira fonte — fechando o "sistema sabe vender e não sabe o que fazer depois do sim" que a revisão final da 3A registrou.

**Architecture:** Uma tabela nova (`implantacoes`) por cima do modelo de contas já existente; um board Kanban por cima de `implantacao_etapas` (dado, não código — as 6 etapas já estão no banco desde a Task 2 da 3A); reuso extensivo do que a 3A já construiu (`optimistic.ts` genérico, `Slideover`, `saudeDaTarefa` movida para junto de `saudeDoNegocio`, `rotuloVencimento`, `ordenarPorUrgencia` de `/hoje` — que já foi desenhada para aceitar uma terceira fonte sem reescrita).

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Supabase (Postgres + RLS), @dnd-kit, Vitest.

**Base:** `main` @ `da864be` (Fase 3A em produção). Branch nova: `feat/fase-3b-implantacao`.

## Global Constraints

- **Idioma:** português do Brasil em toda string visível.
- **Paleta/tipografia:** tokens já existentes em `src/app/globals.css`. Não introduzir cor nova.
- **Fuso:** toda data passa por `src/lib/timezone.ts`. Nunca `new Date()` cru para decidir "hoje", "atrasado" ou comparar datas.
- **Erros de Supabase:** Server Action confere `error` e lança. Leitor que alimenta uma tela confere e devolve `{ unavailable: true }` (padrão de `src/lib/data/crm.ts` histórico, hoje em `notifications.ts`/`deals.ts`/`hoje.ts`). Nunca lista vazia confiante.
- **Sem `motion-safe:`** — não gera CSS neste projeto.
- **Sem dados fictícios.** As linhas de `implantacao_etapas` (6, seeds do spec) já existem e NÃO são dado fictício — são configuração. Nenhuma `implantacao` de exemplo nasce em migration.
- **Migrations:** arquivo em `supabase/migrations/` **e** aplicada via MCP. Project ref `pknooqhosbieqgjzwtww`.
- **Verificação por tarefa:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` limpos antes de cada commit. Hoje (antes desta fase): **115 testes**.
- **Sem navegador neste ambiente.** Nenhuma verificação visual é possível; nunca afirmar ter visto algo renderizar.
- **O portão de escrita (`beginMutation`/`beginInteraction` de `src/lib/realtime/mutation-gate.ts`)** embrulha toda escrita client-side, mesmo tabelas não publicadas para tempo real — é a convenção do projeto inteiro.
- **Banco único, sem separação dev/prod.** Migration aplicada via MCP vale para produção na hora, não importa em que branch o código está. Regra já quebrada uma vez nesta fase (Task 1 da 3A): não juntar uma migration destrutiva com trabalho que ainda depende do estado antigo.
- **Régua:** *"quero que seja algo que as pessoas no mundo real realmente pagariam para utilizar."*

## Contexto que esta fase herda

A tabela `implantacao_etapas` **já existe e já tem as 6 linhas** (Task 2 da 3A, `supabase/migrations/0015_crm_agentes.sql`):

| posicao | nome | sla_dias | espera |
|---|---|---|---|
| 0 | Pago · aguardando kickoff | 1 | nos |
| 1 | Coleta de acessos | 1 | cliente |
| 2 | Build do agente | 2 | nos |
| 3 | Teste com o cliente | 1 | cliente |
| 4 | Go-live | 1 | nos |
| 5 | Acompanhamento D+7 | 7 | nos |

`espera` (`nos` | `cliente`) já existe na tabela mas **nenhuma tela usa ainda** — é decisão registrada no spec (item 2): duas etapas dependem do cliente, e alertar as duas famílias com o mesmo vermelho faz o alerta perder valor quando o atraso não é culpa nossa. **Esta fase é quando essa distinção passa a valer.**

`contas.fase` já tem o valor `'implantacao'` no enum, e `ganharNegocio` (`src/lib/actions/deals.ts`) já seta `contas.fase = 'implantacao'` ao ganhar — mas **não cria nenhuma linha de implantação**, porque a tabela não existia. É a lacuna concreta que a revisão final da 3A apontou: *"o sistema hoje sabe conduzir uma venda até o 'sim' e não sabe o que fazer depois dele."*

`negocios.plano_id`/`desconto` já existem no schema (Task 2 da 3A) mas sem catálogo de planos cadastrado (`planos` está vazia) — **fora do escopo desta fase**, não mexer.

**Também fora do escopo desta fase** (spec, seção "Ordem de construção" — pertencem à 3C): `assinaturas` (nasce no go-live, mas a tela que a usaria é Clientes), `account_sinais` (uso do agente, sem fonte ainda) e a tabela `client_contacts` (existe desde a Fase 1, "dias sem contato"). Não criar, não migrar, não referenciar nesta fase — a 3B termina quando a conta vira `'cliente'`, sem tela nenhuma consumindo essa fase ainda, mesmo padrão já aceito para negócio ganho → implantação na 3A.

## Uma armadilha de import circular — resolvida aqui, antes de escrever qualquer coisa nova

`src/lib/hoje.ts` (Task 5 da 3A) já exporta `saudeDaTarefa`, usada para classificar tarefas do Kanban dentro da lista de `/hoje`. Esta fase precisa da MESMA função para classificar etapas de implantação (etapa vencida = mesma lógica de "tarefa vencida", só que aplicada à data derivada `etapa_desde + sla_dias` em vez de `due_date`). Se `src/lib/implantacoes.ts` importar `saudeDaTarefa` de `hoje.ts`, e `hoje.ts` importar de `implantacoes.ts` para o mapeador da terceira fonte (Task 5 abaixo), os dois módulos importam um do outro — ciclo.

**Resolvido na Task 2**: `saudeDaTarefa` muda de casa, de `hoje.ts` para `src/lib/negocios.ts`, ao lado de `saudeDoNegocio` — as duas já compartilham o tipo `SaudeNegocio` que mora lá, então é o lugar certo, não só o lugar que evita o ciclo. `hoje.ts` passa a importar `saudeDaTarefa` de `./negocios` como já importa `saudeDoNegocio`.

## Passo a passo

- [ ] **Task 1: A tabela `implantacoes`**

  **Files:** Create `supabase/migrations/0016_implantacoes.sql`. Modify `src/lib/supabase/database.types.ts`.

  ```sql
  -- A esteira de implantação: nasce quando um negócio é ganho (passagem de
  -- bastão automática, Task 3 desta fase), atravessa as seis etapas de
  -- implantacao_etapas (dado, não código — Task 2 da 3A), termina quando a
  -- conta vira cliente.
  --
  -- negocio_id é UNIQUE: um negócio só gera uma implantação. É o que torna
  -- ganharNegocio seguro de repetir se a escrita anterior falhar pela metade —
  -- a segunda tentativa esbarra na constraint em vez de duplicar (ver o
  -- comentário em src/lib/actions/deals.ts, Task 3 desta fase).
  create table public.implantacoes (
    id uuid primary key default gen_random_uuid(),
    conta_id uuid not null references public.contas(id) on delete cascade,
    negocio_id uuid not null unique references public.negocios(id) on delete cascade,
    etapa int not null default 0 references public.implantacao_etapas(posicao),
    -- Zerado a cada troca de etapa; é o relógio do SLA, mesmo raciocínio de
    -- negocios.mexido_em para o apodrecimento.
    etapa_desde timestamptz not null default now(),
    -- Nulo = em andamento. A esteira não "conclui" etapa por etapa — conclui
    -- quando a conta vira cliente, uma vez só.
    concluida_em timestamptz,
    dono_id uuid references public.profiles(id) on delete set null,
    criado_em timestamptz not null default now()
  );
  create index implantacoes_etapa_idx on public.implantacoes (etapa);
  create index implantacoes_conta_idx on public.implantacoes (conta_id);

  alter table public.implantacoes enable row level security;
  create policy "authenticated_full_access" on public.implantacoes
    for all using (auth.uid() is not null) with check (auth.uid() is not null);
  ```

  - [ ] **Step 1:** Escrever o arquivo acima.
  - [ ] **Step 2:** Aplicar via MCP (`apply_migration`, project ref `pknooqhosbieqgjzwtww`).
  - [ ] **Step 3:** Confirmar no banco: `implantacoes` existe, RLS ligada, 0 linhas, a constraint `unique` em `negocio_id` existe (`\d implantacoes` ou consulta em `information_schema`).
  - [ ] **Step 4:** Gerar tipos (`generate_typescript_types` via MCP) e atualizar `database.types.ts` à mão (mesmo processo da Task 2 da 3A: comparar o gerado, aplicar só a tabela nova).
  - [ ] **Step 5:** `npm test`/`tsc`/`lint`/`build` limpos (nenhum teste novo ainda — só schema). Commit.

- [ ] **Task 2: Lógica pura — mover `saudeDaTarefa`, criar `src/lib/implantacoes.ts`**

  **Files:** Modify `src/lib/negocios.ts`, `src/lib/negocios.test.ts`, `src/lib/hoje.ts`, `src/lib/hoje.test.ts`. Create `src/lib/implantacoes.ts`, `src/lib/implantacoes.test.ts`.

  **Interfaces produzidas por esta task** (Task 4 e Task 5 dependem destas assinaturas exatas):
  ```ts
  // src/lib/negocios.ts (saudeDaTarefa MOVIDA de hoje.ts para cá)
  export function saudeDaTarefa(dueDate: string | null, agora?: Date): SaudeNegocio

  // src/lib/implantacoes.ts (novo)
  export type EtapaEspera = "nos" | "cliente";
  export function vencimentoDaEtapa(etapaDesde: string, slaDias: number): string
  export function saudeDaImplantacao(vencimento: string, espera: EtapaEspera, agora?: Date): SaudeNegocio
  ```

  - [ ] **Step 1:** Mover `saudeDaTarefa` (corpo idêntico) de `src/lib/hoje.ts` para `src/lib/negocios.ts`, logo depois de `saudeDoNegocio` — mesmo raciocínio, mesmo lugar. Mover também os testes correspondentes de `hoje.test.ts` para `negocios.test.ts`. Em `hoje.ts`, trocar a definição local por `import { saudeDaTarefa, ... } from "./negocios";` (já importa `saudeDoNegocio`/`SaudeNegocio` de lá, só acrescenta ao import existente). Rodar `npm test` — mesma contagem de antes, só reorganizados os arquivos.

  - [ ] **Step 2:** Escrever `src/lib/implantacoes.ts`:
  ```ts
  import { saudeDaTarefa, type SaudeNegocio } from "./negocios";
  import { addDaysToDateStr, todayInAppTz } from "./timezone";

  export type EtapaEspera = "nos" | "cliente";

  /**
   * A data em que o SLA da etapa atual vence, como "YYYY-MM-DD" — a mesma
   * forma de `proximo_passo_em`/`due_date`, para reusar `saudeDaTarefa` sem
   * adaptar a assinatura dela.
   */
  export function vencimentoDaEtapa(etapaDesde: string, slaDias: number): string {
    return addDaysToDateStr(todayInAppTz(new Date(etapaDesde)), slaDias);
  }

  /**
   * Mesmo vocabulário de saúde do resto do sistema, calculado com a MESMA
   * regra de tarefa vencida (`saudeDaTarefa`) — a etapa também é "algo com
   * prazo", não uma família de regra nova.
   *
   * A única diferença: duas das seis etapas esperam o CLIENTE, não a gente
   * (`implantacao_etapas.espera`). Decisão registrada no spec da Fase 3: o
   * mesmo vermelho pulsando para as duas famílias faz o alerta perder valor
   * quando o atraso não é culpa nossa. Aqui o teto para `espera: "cliente"`
   * é "atencao" — nunca "podre".
   */
  export function saudeDaImplantacao(
    vencimento: string,
    espera: EtapaEspera,
    agora: Date = new Date()
  ): SaudeNegocio {
    const saude = saudeDaTarefa(vencimento, agora);
    if (espera === "cliente" && saude === "podre") return "atencao";
    return saude;
  }
  ```

  - [ ] **Step 3:** Testes em `src/lib/implantacoes.test.ts` — mínimo 8, cobrindo: `vencimentoDaEtapa` soma os dias certos (etapa iniciada num dia, SLA de N dias, vencimento cai N dias depois); etapa `espera: "nos"` vencida ontem → `"podre"`; etapa `espera: "nos"` vencendo hoje → `"atencao"`; etapa `espera: "nos"` no prazo → `"ok"`; etapa `espera: "cliente"` vencida ontem → `"atencao"` (não `"podre"` — é o teste que prova a regra do spec); etapa `espera: "cliente"` no prazo → `"ok"` (não vira "melhor que ok" por esperar cliente); vencimento no futuro distante → `"ok"` para as duas famílias de espera.

  - [ ] **Step 4:** `npm test`/`tsc`/`lint`/`build` limpos. Commit.

- [ ] **Task 3: Passagem de bastão automática — `ganharNegocio` cria a implantação**

  **Files:** Modify `src/lib/actions/deals.ts`.

  A ordem de escrita de `ganharNegocio` já segue uma disciplina (fixada no fix round da Task 4 da 3A, achado I3): leitura primeiro, depois a escrita que NÃO tira nada de visão, depois por último a escrita que tira o negócio do Pipeline — para que uma falha no meio deixe o botão "Ganhar" clicável de novo, sem estado inconsistente.

  Esta task acrescenta uma escrita nova no MEIO dessa ordem, não no fim: criar a implantação **antes** de marcar `negocios.resultado = 'ganho'` (que é o que tira o negócio da tela). Se a criação da implantação falhar, o negócio continua visível e clicável — retry seguro. Se a criação suceder mas a escrita seguinte falhar, uma segunda tentativa esbarraria em duplicar a implantação — por isso `negocio_id` é `unique` (Task 1): a segunda tentativa recebe um erro de violação de constraint nesse insert, que o código trata como "já existe, segue em frente" em vez de propagar como falha.

  ```ts
  // src/lib/actions/deals.ts — dentro de ganharNegocio, substituindo o corpo atual
  export async function ganharNegocio(negocioId: string) {
    const supabase = await createClient();
    const hoje = todayInAppTz();

    const { data: negocio, error: leituraError } = await supabase
      .from("negocios")
      .select("conta_id, dono_id")
      .eq("id", negocioId)
      .single();
    if (leituraError) throw leituraError;

    // Nasce a implantação ANTES de marcar o negócio como ganho — se isto
    // falhar, o negócio continua visível e o botão continua clicável.
    // `dono_id` herda do negócio (quem vendeu); a gaveta da implantação
    // deixa trocar depois.
    const { error: implantacaoError } = await supabase.from("implantacoes").insert({
      conta_id: negocio.conta_id,
      negocio_id: negocioId,
      dono_id: negocio.dono_id,
    });
    // 23505 = unique_violation. Repetir "Ganhar" depois de a implantação já
    // ter nascido (e a escrita seguinte ter falhado da vez anterior) não pode
    // virar um erro assustador — a implantação já existe, é exatamente o que
    // se queria.
    if (implantacaoError && implantacaoError.code !== "23505") throw implantacaoError;

    const { error: contaError } = await supabase
      .from("contas")
      .update({ fase: "implantacao" })
      .eq("id", negocio.conta_id);
    if (contaError) throw contaError;

    const { error } = await supabase
      .from("negocios")
      .update({ resultado: "ganho", fechado_em: hoje, mexido_em: new Date().toISOString() })
      .eq("id", negocioId);
    if (error) throw error;

    revalidatePath("/pipeline");
    revalidatePath("/hoje");
    revalidatePath("/implantacao");
  }
  ```

  - [ ] **Step 1:** Aplicar a mudança acima. Atualizar o comentário que já existe sobre a ordem das escritas (linhas 123-139 do arquivo atual) para descrever as TRÊS escritas, não duas.
  - [ ] **Step 2:** Não há teste automatizado para Server Actions neste projeto (nenhuma tem — `ganharNegocio`/`perderNegocio` também não tinham antes). Não introduzir o primeiro aqui; a garantia é a leitura cuidadosa + verificação manual do Samuel (Task 6 desta fase pede exatamente isso).
  - [ ] **Step 3:** `npm test`/`tsc`/`lint`/`build` limpos. Commit.

- [ ] **Task 4: A tela Implantação**

  **Files:** Create `src/app/(app)/implantacao/page.tsx` + `loading.tsx`, `src/components/implantacao/ImplantacaoClient.tsx`, `src/components/implantacao/ImplantacaoBoard.tsx`, `src/components/implantacao/ImplantacaoCard.tsx`, `src/components/implantacao/ImplantacaoDrawer.tsx`, `src/lib/data/implantacoes.ts`, `src/lib/actions/implantacoes.ts`.

  **Diferença estrutural em relação ao Pipeline (`PipelineBoard.tsx`), leia antes de copiar**: as colunas do Pipeline são um `as const` fixo em TypeScript (`ESTAGIOS` em `PipelineBoard.tsx`) porque o enum `negocio_estagio` é código. As colunas daqui são **dado** — `implantacao_etapas`, editável sem deploy (é literalmente o que o spec pede: *"os prazos são dados, não código — vocês vão querer ajustar depois das primeiras dez implantações"*). Isso muda três coisas:
  1. As colunas vêm de uma consulta (`listEtapas()`), não de um array `as const`.
  2. `Columns<T, C extends string = string>` (`src/lib/optimistic.ts`, generalizado na Task 4 da 3A) exige `C extends string`, mas `implantacao_etapas.posicao` é `int4`. A coluna precisa de uma chave string — use `String(etapa.posicao)` como `C`, e converta de volta com `Number(...)` na Server Action que recebe o id da coluna alvo.
  3. Sem `as const satisfies`, não há checagem de tipo garantindo que as 6 etapas do banco batem com algo — é o preço consciente de ser dado, não código. A UI trata a lista de etapas como veio do banco, ordenada por `posicao`.

  - [ ] **Step 1: A leitura** (`src/lib/data/implantacoes.ts`)

  ```ts
  export async function listEtapas() {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("implantacao_etapas")
      .select("posicao, nome, sla_dias, espera")
      .order("posicao");
    if (error) { console.error("[implantacao] falha ao consultar etapas:", error); return { unavailable: true as const }; }
    return { unavailable: false as const, etapas: data ?? [] };
  }

  export async function listImplantacoesAbertas() {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("implantacoes")
      .select("id, etapa, etapa_desde, conta:contas(id, nome, nicho, cidade, uf), dono:profiles(id, full_name, initials)")
      .is("concluida_em", null)
      .order("etapa_desde", { ascending: true });
    if (error) { console.error("[implantacao] falha ao consultar implantações:", error); return { unavailable: true as const }; }
    return { unavailable: false as const, implantacoes: data ?? [] };
  }
  ```
  Sentinela `{ unavailable: true }` em cada uma, mesmo padrão de `listNegociosAbertos`. `listEtapas` é pública para a Task 5 reusar (a leitura de `/hoje` também precisa das etapas para calcular `vencimentoDaEtapa`/`saudeDaImplantacao` de cada implantação).

  - [ ] **Step 2: As Server Actions** (`src/lib/actions/implantacoes.ts`)

  ```ts
  export async function moverEtapa(implantacaoId: string, etapa: number) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("implantacoes")
      .update({ etapa, etapa_desde: new Date().toISOString() })
      .eq("id", implantacaoId);
    if (error) throw error;
    revalidatePath("/implantacao");
    revalidatePath("/hoje");
  }

  export async function concluirImplantacao(implantacaoId: string) {
    const supabase = await createClient();
    const { data: implantacao, error: leituraError } = await supabase
      .from("implantacoes").select("conta_id").eq("id", implantacaoId).single();
    if (leituraError) throw leituraError;

    // Mesma disciplina de ganharNegocio: a conta primeiro, a implantação (que
    // sai da tela, via concluida_em not null) por último.
    const { error: contaError } = await supabase
      .from("contas").update({ fase: "cliente" }).eq("id", implantacao.conta_id);
    if (contaError) throw contaError;

    const { error } = await supabase
      .from("implantacoes").update({ concluida_em: new Date().toISOString() }).eq("id", implantacaoId);
    if (error) throw error;

    revalidatePath("/implantacao");
    revalidatePath("/hoje");
  }
  ```
  **Fora de escopo, decisão consciente:** conta vira `'cliente'` e some de toda tela — não existe tela de Clientes ainda (Fase 3C). Mesmo padrão já aceito quando um negócio ganho vira implantação sem tela até esta fase existir.

  - [ ] **Step 3: O board** (`ImplantacaoBoard.tsx`)

  Copie o mecanismo de arraste de `PipelineBoard.tsx` linha por linha, adaptando ao ponto 2 acima (chaves de coluna string derivadas de `posicao`). As três correções caras do Kanban (snapshot de origem, reverter fora, `onDragCancel` separado) continuam valendo — são do `@dnd-kit`, não do domínio. Ao soltar numa coluna diferente, chama `moverEtapa` com `Number(colunaAlvo)`.

  - [ ] **Step 4: O cartão** (`ImplantacaoCard.tsx`)

  Conta (nome, nicho, cidade), dono, dias na etapa atual (reusa `diasParado` de `src/lib/negocios.ts` — o cálculo é genérico, "dias desde uma data", não específico de negócio, apesar do nome; **não duplique**), o ponto de saúde (`CLASSE_DO_PONTO_DE_SAUDE`/`ROTULO_DA_SAUDE` de `src/lib/negocios.ts`, reusados — mesma régua visual do Pipeline e do Hoje) vindo de `saudeDaImplantacao(vencimentoDaEtapa(implantacao.etapa_desde, etapa.sla_dias), etapa.espera)`, e um selo pequeno "esperando você" ou "esperando cliente" conforme `etapa.espera` — é a peça que dá uso de verdade ao campo que a 3A já guardava sem tela nenhuma usar.

  - [ ] **Step 5: A gaveta** (`ImplantacaoDrawer.tsx`)

  `Slideover` (mesmo componente da gaveta do Pipeline). Mostra conta, dono, etapa atual, dias na etapa, vencimento do SLA. Um seletor de etapa (`<Select>`, mesmo padrão que `NegocioDrawer.tsx` já usa para `moverNegocioParaEstagio` — **nasce com isso desde o início desta vez**, não como correção depois: a 3A só ganhou esse escape num fix round porque não veio de fábrica, não repita o erro). Um botão "Concluir implantação", com `confirm("Concluir a implantação? A conta vira cliente.")` antes de chamar `concluirImplantacao`.

  - [ ] **Step 6: A página** (`src/app/(app)/implantacao/page.tsx` + `loading.tsx`)

  Busca `listEtapas()` e `listImplantacoesAbertas()` em paralelo. Se qualquer uma falhar, `{ unavailable: true }` — mesma disciplina de `/hoje` (Task 5 da 3A, achado da revisão final: uma tela "isto é tudo que precisa de atenção" mentindo por omissão é pior que avisar que não carregou). `loading.tsx` desde o primeiro commit desta tela — a 3A só teve seu buraco em `/hoje` porque isso foi esquecido uma vez; não esqueça de novo.

  **Não adicione ao menu lateral nesta task** — é a Task 6.

  - [ ] **Step 7:** `npm test`/`tsc`/`lint`/`build` limpos. Commit.

- [ ] **Task 5: `/hoje` ganha a terceira fonte**

  **Files:** Modify `src/lib/hoje.ts`, `src/lib/hoje.test.ts`, `src/lib/data/hoje.ts`, `src/components/hoje/HojeClient.tsx`.

  Esta é a task que prova se o desenho da Task 5 da 3A realmente entregou o que prometeu: *"a função tem que aceitar a terceira fonte sem reescrita"* (comentário em `ordenarPorUrgencia`, `src/lib/hoje.ts`). Se este passo pedir tocar em `ordenarPorUrgencia`, algo no desenho original estava errado — pare e diga, não force.

  - [ ] **Step 1:** Em `src/lib/hoje.ts`, acrescentar (não substituir nada existente):
  ```ts
  import { saudeDaImplantacao, vencimentoDaEtapa } from "./implantacoes";

  export type ImplantacaoParaItemHoje = {
    id: string;
    etapaNome: string;
    etapaDesde: string;
    slaDias: number;
    espera: "nos" | "cliente";
    donoId: string | null;
    contaNome: string | null;
  };

  export function implantacaoParaItemHoje(implantacao: ImplantacaoParaItemHoje, agora: Date = new Date()): ItemHoje {
    const vencimento = vencimentoDaEtapa(implantacao.etapaDesde, implantacao.slaDias);
    return {
      id: implantacao.id,
      texto: implantacao.etapaNome,
      contexto: implantacao.contaNome,
      donoId: implantacao.donoId,
      vencimento,
      saude: saudeDaImplantacao(vencimento, implantacao.espera, agora),
      origem: "implantacao",
    };
  }
  ```
  E adicionar `"implantacao"` ao union de `ItemHoje["origem"]` (hoje só `"negocio" | "tarefa"`).

  - [ ] **Step 2:** Testes em `hoje.test.ts`: `implantacaoParaItemHoje` calcula `vencimento`/`saude` corretamente (reusa os casos já cobertos em `implantacoes.test.ts`, não reduplique a matriz inteira — 2-3 casos bastam aqui, o grosso da regra já está testado onde nasceu); uma implantação `espera: "cliente"` vencida aparece ANTES de uma tarefa em dia mas DEPOIS de um negócio podre, provando que o `"atencao"` que `saudeDaImplantacao` devolve participa da mesma ordenação das outras duas fontes sem tratamento especial.

  - [ ] **Step 3:** Em `src/lib/data/hoje.ts`, terceira consulta em paralelo (junto de `negocios`/`tasks`): `listImplantacoesAbertas()` e `listEtapas()` (de `src/lib/data/implantacoes.ts`, Task 4) — precisa das duas para montar `slaDias`/`espera` de cada implantação (join por `etapa`/`posicao` em memória, ou uma segunda consulta pequena; a tabela de etapas tem 6 linhas, sem custo). Se qualquer uma das agora QUATRO consultas falhar, a leitura inteira é `{ unavailable: true }} (mesma regra já em vigor, só estendida a uma fonte a mais).

  - [ ] **Step 4:** Em `HojeClient.tsx`, mapear `implantacoes` para `ItemHoje` junto de `negocios`/`tarefas`, e no `href` do clique de cada linha: `item.origem === "implantacao" ? "/implantacao" : ...` (sem deep-link por id nesta fase — diferente do Pipeline, que ganhou `?negocio=<id>` na própria Task 5 da 3A porque sem ele metade das linhas não levava a lugar nenhum; aqui, se o board de Implantação for pequeno o bastante para achar a etapa certa sem deep-link, não construa o que não é preciso ainda. Se a revisão discordar, é um Step 0 barato de acrescentar, mesmo padrão da 3A.)

  - [ ] **Step 5:** `npm test`/`tsc`/`lint`/`build` limpos. Commit.

- [ ] **Task 6: Navegação**

  **Files:** Modify `src/components/layout/Sidebar.tsx`.

  Menu novo: **Hoje · Pipeline · Implantação · Kanban · Metas · Playbooks** — Implantação entra entre Pipeline e Kanban, seguindo a ordem do funil completo (venda → build) que o spec descreve na tabela de telas.

  - [ ] **Step 1:** Acrescentar o item ao array `workItems` (ou onde fizer sentido no agrupamento atual — `Sidebar.tsx` já tem `workItems`/`businessItems`, a Task 6 da 3A tratou isso como julgamento do implementador, não norma).
  - [ ] **Step 2:** `npm test`/`tsc`/`lint`/`build` limpos. Commit.

## Verificação final da 3B

Mesmo ciclo que fechou a 3A: revisão da branch inteira (contra `main`), uma rodada de correção se necessário, merge.

**E o que só o Samuel e o Saymon podem fazer:** ganhar o negócio real já cadastrado (Barbearia do Saymon, ou outro que exista até lá) e ver a implantação nascer sozinha, mover pelas etapas, deixar uma etapa `espera: "nos"` estourar o prazo e conferir que fica vermelho — e uma `espera: "cliente"` estourar e conferir que fica só âmbar, não vermelho. É a mesma régua de aceitação da 3A, aplicada à peça nova.

# Fase 3D — Painel (versão reduzida: métricas de hoje, sem evolução histórica)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma tela `/painel` que responde "de onde vem o próximo real", com métricas honestas do estado atual do funil e da carteira — sem o gráfico de evolução do MRR, que dependeria da tabela `assinaturas` da Fase 3C (pulada por decisão explícita do usuário).

**Architecture:** Puramente de leitura — nenhuma migration, nenhuma Server Action, nenhuma escrita. Uma função pura e testada (`src/lib/painel.ts`) agrega três listas cruas (`negocios`, `contas`, `implantacoes`) em memória, seguindo o mesmo padrão já usado em `src/lib/data/hoje.ts`/`nav.ts`. A tela é um Server Component só — sem estado de cliente, sem drag, sem gaveta, então não precisa de `PainelClient.tsx`.

**Tech Stack:** Next.js App Router (Server Components), Supabase (leitura), Vitest.

**Base:** `main` @ `4bd4507` (Fases 3A+3B em produção). Branch nova: `feat/fase-3d-painel`.

## Global Constraints

- **Idioma:** português do Brasil em toda string visível.
- **Paleta/tipografia:** tokens já existentes em `src/app/globals.css`. Não introduzir cor nova.
- **Fuso:** toda data passa por `src/lib/timezone.ts`.
- **Erros de Supabase:** leitor confere `error` e devolve `{ unavailable: true }` (mesmo padrão de `src/lib/data/hoje.ts`/`deals.ts`/`implantacoes.ts`). Nunca zero confiante quando a leitura falhou — mas **zero genuíno (leitura funcionou, resultado é realmente zero) se renderiza como zero**, não como "—": essa distinção é o que `src/lib/data/nav.ts` já ensina (`null` = não sei, `0` = sei e é zero).
- **Sem `motion-safe:`.**
- **Sem dados fictícios.** Zero migration nesta fase — nada novo nasce no banco.
- **Verificação por tarefa:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` limpos antes de cada commit. Hoje (antes desta fase): **129 testes**.
- **Sem navegador neste ambiente.** Nunca afirmar ter visto algo renderizar.
- **Sem escrita nesta fase inteira** — não há `beginMutation`/Server Action para aplicar, mas se alguma task achar necessidade de escrever algo, pare e diga: não é o desenho.

## Contexto que esta fase herda, e a decisão que a define

O protótipo original tem uma seção central "Evolução e movimento do MRR" (gráfico de série mensal) que **fica de fora desta fase**, por decisão explícita: ela depende de `assinaturas` (nasce no go-live, guarda início/fim/motivo — spec, Fase 3C), que não existe e não vai ser construída agora. Construir um substituto ad-hoc (uma tabela de "snapshot de MRR" só para este gráfico) criaria um segundo modelo de dado que precisaria ser reconciliado com `assinaturas` quando a 3C chegar — decisão consciente de não fazer isso.

O que **entra**, tudo computável do schema que já existe (`contas`, `negocios`, `implantacoes` — Fases 3A/3B), sem nada novo no banco:

- **MRR ativo** — soma de `negocios.mrr` (dos ganhos) cuja conta está em `fase = 'cliente'`. Confirmado por leitura de código: o único caminho que uma conta chega em `'cliente'` hoje é `concluirImplantacao` (`src/lib/actions/implantacoes.ts:50-53`). Não existe caminho para `'churn'` ainda — não precisa ser tratado.
- **Pipeline aberto** — soma de `mrr` + contagem dos negócios com `resultado is null` (mesmo corte que o Pipeline já usa).
- **Ticket médio** — pipeline aberto ÷ contagem de negócios abertos. **`null` (não zero) quando não há negócio aberto** — é uma razão indefinida, não uma razão que deu zero.
- **Deals apodrecendo** — contagem + R$ travados, reusando `saudeDoNegocio` (`src/lib/negocios.ts:59`) exatamente como `PipelineClient.tsx:46-52` já faz. Não duplicar a regra.
- **MRR esperando go-live** — soma de `mrr` dos negócios ganhos cuja implantação ainda não tem `concluida_em`. **Simplificação consciente em relação ao protótipo**: lá o corte era "etapa < Go-live" (posição 4, hardcoded); aqui isso seria fixar em código uma posição que é dado (`implantacao_etapas`, editável sem deploy — o mesmo motivo que fez `ImplantacaoBoard.tsx` não usar `as const` para colunas na Fase 3B). O corte desta fase é mais simples e mais honesto com o modelo atual: "receita ainda não rodando" = implantação aberta, ponto.
- **Setup na receita** — `soma(setup dos ganhos) / (soma(setup) + soma(mrr) dos ganhos)`, como percentual **desde o início** (não mensal — a leitura mensal é exatamente o que a 3C/3D completa traria). `null` quando o denominador é zero.
- **Origem → receita** — agrupa TODOS os negócios (abertos, ganhos, perdidos) pela `contas.origem` de cada um: quantos leads, quantos ganhos, quanto MRR. `contas.origem` é texto livre sem normalização no banco (`NovoNegocioModal.tsx:132-134`, um `<Input>` comum) — o agrupamento normaliza por `trim().toLowerCase()` para não separar "Instagram" de "instagram", mas exibe o rótulo com a grafia da primeira ocorrência lida. Negócio sem conta com origem preenchida cai em "Sem origem".

**Estado real do banco hoje** (2 contas, 2 negócios, ambos fechados, 1 implantação em andamento): a maioria das métricas vai mostrar números pequenos e reais — R$0 de MRR ativo (ninguém virou cliente ainda), Ticket médio em "—" (nenhum negócio aberto), R$1.000/mês esperando go-live, ~94% de setup na receita. **Isso é esperado, não é bug** — a tela existe para crescer com o uso real, e mostrar isso honestamente (não zero disfarçado, não vazio genérico) é o ponto.

## `Kpi`, reusado, não reinventado

`src/components/ui/Card.tsx:21-44` já tem um componente `Kpi` (`label`, `value`, `sub`, `valueClassName`, `labelClassName`, `children`) que sobreviveu à aposentadoria de `/início` (Task 6 da Fase 3A) sem nenhum consumidor ativo hoje — só um resquício de import no skeleton de `/implantacao`. Esta fase é o primeiro uso real dele desde então. **Não crie um segundo componente de tile** — leia `Card.tsx` inteiro antes de montar a grade de métricas.

## Passo a passo

- [ ] **Task 1: A lógica pura**

  **Files:** Create `src/lib/painel.ts`, `src/lib/painel.test.ts`.

  **Interfaces produzidas** (Task 2 depende destas assinaturas exatas):
  ```ts
  export type NegocioParaPainel = {
    id: string;
    contaId: string;
    resultado: "ganho" | "perdido" | null;
    mrr: number | null;
    setup: number | null;
    proximoPasso: string | null;
    proximoPassoEm: string | null;
    mexidoEm: string;
  };
  export type ContaParaPainel = {
    id: string;
    fase: "prospect" | "implantacao" | "cliente" | "perdido" | "churn";
    origem: string | null;
  };
  export type ImplantacaoParaPainel = {
    negocioId: string;
    concluidaEm: string | null;
  };
  export type OrigemReceita = { origem: string; leads: number; ganhos: number; mrr: number };
  export type MetricasPainel = {
    mrrAtivo: number;
    clientesAtivos: number;
    pipelineMrr: number;
    pipelineContagem: number;
    ticketMedio: number | null;
    apodrecendoContagem: number;
    apodrecendoMrr: number;
    mrrEsperandoGoLive: number;
    setupNaReceita: number | null; // razão 0-1, quem exibe formata em %
    origemReceita: OrigemReceita[]; // ordenado por mrr desc
  };

  export function calcularMetricasPainel(
    negocios: NegocioParaPainel[],
    contas: ContaParaPainel[],
    implantacoes: ImplantacaoParaPainel[],
    agora?: Date
  ): MetricasPainel
  ```

  A função:
  1. Monta `Map<contaId, ContaParaPainel>` e `Set<negocioId>` das implantações com `concluidaEm === null` (para "esperando go-live").
  2. `negociosAbertos = negocios.filter(n => n.resultado === null)`; `pipelineMrr`/`pipelineContagem` derivados dali.
  3. `ticketMedio = pipelineContagem ? Math.round(pipelineMrr / pipelineContagem) : null`.
  4. Apodrecendo: sobre `negociosAbertos`, chama `saudeDoNegocio({ proximoPasso, proximoPassoEm, mexidoEm }, agora)` de `./negocios` — **importa, não reimplementa** — filtra `"podre"`, soma contagem e `mrr`.
  5. `negociosGanhos = negocios.filter(n => n.resultado === "ganho")`.
  6. `mrrAtivo` = soma de `mrr` dos ganhos cuja conta (via Map) tem `fase === "cliente"`. `clientesAtivos` = contagem de `contas` com `fase === "cliente"` (não de negócios — uma conta é uma conta).
  7. `mrrEsperandoGoLive` = soma de `mrr` dos ganhos cujo `id` está no Set de implantações abertas.
  8. `setupNaReceita`: soma `setup`/`mrr` só dos ganhos; `denominador = somaSetup + somaMrr`; `denominador > 0 ? somaSetup / denominador : null`.
  9. `origemReceita`: agrupa TODOS os `negocios` pela `origem` normalizada da conta correspondente (`trim().toLowerCase()`, `null`/vazio → chave `"sem-origem"` com rótulo "Sem origem"); para cada grupo, `leads` = contagem, `ganhos` = contagem com `resultado === "ganho"`, `mrr` = soma de `mrr` dos ganhos; array final ordenado por `mrr` descendente.

  Testes, mínimo 12, cobrindo cada métrica isoladamente e pelo menos um caso "tudo vazio" (três arrays vazios → `MetricasPainel` com tudo zero/null, sem lançar): `mrrAtivo` soma só ganhos com conta cliente, ignora ganho cuja conta ainda está em implantação; `ticketMedio` null com zero negócio aberto; `apodrecendoContagem` reflete exatamente o que `saudeDoNegocio` diria isoladamente (teste cruzado, não reimplementado); `mrrEsperandoGoLive` ignora implantação já concluída; `setupNaReceita` null com zero negócio ganho; `origemReceita` agrupa "Instagram" e "instagram" na mesma linha, com o rótulo da primeira grafia vista; negócio cuja conta não é encontrada no Map (defensivo, não deveria acontecer, mas não pode lançar).

  - [ ] **Step 1-4:** implementar, testar, verificar (`npm test`/`tsc`/`lint`/`build`), commitar.

- [ ] **Task 2: A leitura e a tela**

  **Files:** Create `src/lib/data/painel.ts`, `src/app/(app)/painel/page.tsx`, `src/app/(app)/painel/loading.tsx`.

  - [ ] **Step 1 — `src/lib/data/painel.ts`:**
  ```ts
  export async function listDadosDoPainel() {
    const supabase = await createClient();
    const [negociosRes, contasRes, implantacoesRes] = await Promise.all([
      supabase.from("negocios").select("id, conta_id, resultado, mrr, setup, proximo_passo, proximo_passo_em, mexido_em"),
      supabase.from("contas").select("id, fase, origem"),
      supabase.from("implantacoes").select("negocio_id, concluida_em"),
    ]);
    if (negociosRes.error || contasRes.error || implantacoesRes.error) {
      console.error("[painel] falha ao consultar o Supabase:", negociosRes.error, contasRes.error, implantacoesRes.error);
      return { unavailable: true as const };
    }
    return {
      unavailable: false as const,
      negocios: negociosRes.data ?? [],
      contas: contasRes.data ?? [],
      implantacoes: implantacoesRes.data ?? [],
    };
  }
  ```
  Três consultas em paralelo, sem join — os três arrays crus alimentam `calcularMetricasPainel` (Task 1), que faz o cruzamento em memória (mesmo padrão de `data/hoje.ts`). Adapte os nomes de coluna exatamente aos tipos reais de `database.types.ts` (`conta_id` vira `contaId` etc. na hora de montar os objetos que `calcularMetricasPainel` espera — confira se o mapeamento snake_case→camelCase precisa ser feito aqui ou dentro da função pura; **decida e documente com um comentário curto**, não deixe implícito).

  - [ ] **Step 2 — `src/app/(app)/painel/page.tsx`:**

  Server Component puro, sem `"use client"`, sem componente `PainelClient` — não há interação nenhuma nesta tela (nem filtro, nem gaveta, nem arraste). Busca os dados, calcula `agora = new Date()` uma vez (não precisa reancorar por `useMemo`: é uma renderização de servidor por requisição, não um estado de cliente que sobrevive a uma aba aberta a noite toda — se isso parecer errado, pare e diga em vez de inventar um `"use client"` sem necessidade real), chama `calcularMetricasPainel`, renderiza a grade de `Kpi` (`src/components/ui/Card.tsx`) e a lista de Origem → Receita.

  Layout sugerido (não é obrigação de pixel, é estrutura): `PageHeader` com título "Painel" e um `sub` explicando o recorte ("hoje, sem histórico" ou frase equivalente em pt-BR — sua escolha de texto exato); grade de 6 `Kpi` (MRR ativo, Pipeline aberto, Ticket médio, Apodrecendo, Esperando go-live, Setup na receita), usando `formatCurrency`/`formatCurrencyCompact` de `src/lib/format.ts` para os valores em R$ e `Math.round(setupNaReceita * 100) + "%"` para o percentual; abaixo, uma tabela ou lista simples de `origemReceita` (origem, leads, ganhos, MRR).

  `Ticket médio` com `null` mostra "—" no lugar do valor (mesmo padrão de `src/lib/data/nav.ts`/`Sidebar.tsx` para "não sei" — aqui é "não aplicável", rótulo pode diferenciar com um `sub` tipo "sem negócio aberto" em vez do texto de `nav.ts` que é sobre falha de leitura; não confunda os dois motivos de "—" na entrega, mas o glifo pode ser o mesmo).

  Se `listDadosDoPainel()` devolver `{ unavailable: true }`, a tela inteira vira `<Unavailable>` (`src/components/ui/Unavailable.tsx`) — sem cálculo sobre dado que não chegou.

  - [ ] **Step 3 — `src/app/(app)/painel/loading.tsx`:**

  Nasce JUNTO com este commit — não depois. Esqueleto simples: `PageHeader` fantasma + grade de 6 blocos `Skeleton` no formato de `Kpi` (copie o padrão de `SkeletonKpiRow`, `src/components/ui/Skeleton.tsx`, se ele servir sem modificação; se precisar de ajuste, ajuste, mas não deixe esta tela sem esqueleto — é o erro que `/hoje` cometeu na Fase 3A e só corrigiu numa revisão final corretiva).

  - [ ] **Step 4:** `npm test`/`tsc`/`lint`/`build` limpos (sem teste novo aqui — a lógica já foi testada na Task 1). Commit.

- [ ] **Task 3: Navegação**

  **Files:** Modify `src/components/layout/Sidebar.tsx`.

  - [ ] **Step 1:** Acrescentar `{ href: "/painel", label: "Painel", icon: PainelIcon }` a `businessItems` (ou onde fizer sentido — sua leitura, mesmo espaço de julgamento que a Task 6 da 3A e a Task 6 da 3B já tiveram para agrupamento). **Sem `countKey`** — é um snapshot, não uma fila de pendências, não force um contador que não existe. Ícone novo, consistente em estilo com os demais (mesmo `iconProps()`, sem cor nova).
  - [ ] **Step 2:** `npm test`/`tsc`/`lint`/`build` limpos (129 testes + os da Task 1, sem mudança nesta task). Commit.

## Verificação final da 3D

Mesmo ciclo das fases anteriores: revisão da branch inteira contra `main`, rodada de correção se necessário, merge.

**O que só o Samuel/Saymon podem fazer:** abrir `/painel` e conferir que os números batem com o que eles sabem de cabeça sobre o funil agora (hoje: ~R$0 de MRR ativo, ~R$1.000/mês esperando a implantação da Barbearia do Samuca concluir, dois negócios fechados). Não é um teste de "algo quebrou" — é um teste de "os números contam a verdade".

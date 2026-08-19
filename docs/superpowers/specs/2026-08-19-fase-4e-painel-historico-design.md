# Fase 4E — Painel histórico com gráficos e filtro de período

**Data:** 2026-08-19
**Status:** Aprovado
**Referência de componentes:** 21st.dev (wrapper de gráfico do shadcn sobre `recharts`)

## Problema

O `/painel` (Fase 3D) é deliberadamente um instantâneo de HOJE — "Hoje, sem
histórico" está no próprio subtítulo da tela. Isso foi certo para o estágio em
que a Fase 3D foi construída (sem tabela de assinaturas, sem necessidade de
tendência), mas hoje já existem datas de evento reais em `negocios.criado_em`,
`negocios.fechado_em`, `contas.criado_em` e `implantacoes.concluida_em` que
nunca foram usadas para nada além de ordenação. Dá pra mostrar tendência real
sem inventar nenhum dado — só agrupando o que já existe por período.

## Objetivo

Acrescentar, abaixo do painel de hoje (que continua exatamente como está), uma
seção histórica com gráficos fluidos e um filtro de período — pra Samuel e
Saymon enxergarem "estamos crescendo ou não" sem abrir uma planilha.

## Restrições

- **Nenhum dado fictício.** Todo gráfico consome os mesmos arrays que já saem
  do Supabase hoje — nenhuma tabela nova, nenhuma migração.
- **pt-BR** em toda string visível.
- **Sem `motion-safe:`** em nenhuma classe Tailwind.
- **Banco único**, sem separação dev/prod.
- Workspace de duas pessoas — sem paginação nem otimização de escala além do
  que o volume atual da Aura Studio pede.

## Arquitetura

`PainelPage` (Server Component) continua buscando os três arrays crus (`negócios`,
`contas`, `implantações`) numa única leitura, como hoje — só que agora as
consultas também trazem `criado_em`/`fechado_em` dos negócios e `criado_em` das
contas (colunas que já existem; sem migração). Os KPIs de hoje continuam
calculados e renderizados exatamente como estão.

Os arrays crus descem inteiros como prop para um novo Client Component,
`PainelHistoricoClient.tsx`, que:
1. Guarda o período selecionado em estado local (preset ou intervalo customizado).
2. Chama as funções puras de agregação (abaixo) a cada mudança de período,
   **sem nenhuma nova consulta ao servidor** — os dados já estão no cliente.
3. Renderiza os 4 cartões de gráfico com o resultado.

Isso segue o mesmo padrão que `calcularMetricasPainel` já usa (buscar tudo,
cruzar em memória) — só que agora reexecutado no cliente a cada troca de
período, o que evita round-trip e mantém a UI instantânea.

## Dados & cálculo

Novo módulo puro, `src/lib/painel-historico.ts` — sem import de Supabase, sem
DOM, testável com Vitest exatamente como `src/lib/painel.ts`.

```ts
export type Granularidade = "dia" | "semana" | "mes";

/** ≤31 dias → dia · 32–180 dias → semana · >180 dias → mês. */
export function granularidadeParaPeriodo(inicio: Date, fim: Date): Granularidade;

export type BucketSerie = { chave: string; rotulo: string };

export type PontoNegociosGanhos = BucketSerie & { ganhos: number; mrrGanho: number };
export function calcularSerieNegociosGanhos(
  negocios: Array<{ resultado: "ganho" | "perdido" | null; fechadoEm: string | null; mrr: number | null }>,
  inicio: Date,
  fim: Date
): PontoNegociosGanhos[];

export type PontoContasCriadas = BucketSerie & { contas: number };
export function calcularSerieContasCriadas(
  contas: Array<{ criadoEm: string }>,
  inicio: Date,
  fim: Date
): PontoContasCriadas[];

export type PontoImplantacoesConcluidas = BucketSerie & { concluidas: number };
export function calcularSerieImplantacoesConcluidas(
  implantacoes: Array<{ concluidaEm: string | null }>,
  inicio: Date,
  fim: Date
): PontoImplantacoesConcluidas[];

export type OrigemReceitaPeriodo = { origem: string; leads: number; ganhos: number; mrr: number };
export function calcularOrigemReceitaNoPeriodo(
  negocios: Array<{ contaId: string; resultado: "ganho" | "perdido" | null; mrr: number | null; criadoEm: string }>,
  contas: Array<{ id: string; origem: string | null }>,
  inicio: Date,
  fim: Date
): OrigemReceitaPeriodo[];
```

Regras de agregação:

- **Bucket vazio não some.** Todo bucket entre `inicio` e `fim` aparece na
  série, mesmo com valor 0 — um gráfico que pula buckets sem evento mentiria
  por omissão sobre a continuidade do tempo.
- **Granularidade é automática**, não escolhida pelo usuário — decide sozinha
  pelo tamanho do período, igual ao que já foi decidido no design.
- **Fuso horário**: toda fronteira de bucket (início/fim do dia, da semana, do
  mês) usa as primitivas já existentes em `src/lib/timezone.ts`
  (`todayInAppTz`, `addDaysToDateStr`, `startOfWeekInAppTz`,
  `startOfMonthInAppTz`) — nenhuma lógica de fuso nova é escrita neste módulo.
  Como o app já assume offset fixo (sem horário de verão desde 2019, ver
  comentário em `timezone.ts`), somar dias/semanas em milissegundos é seguro;
  meses usam `startOfMonthInAppTz(ano, mês, offset)` para lidar com meses de
  tamanho variável.
- **`calcularOrigemReceitaNoPeriodo`** replica o agrupar-por-origem que já
  existe em `calcularMetricasPainel`, mas filtrando por `criadoEm` dentro do
  período em vez de somar todos os negócios — dois lugares com a mesma regra
  de normalização de origem (trim + lowercase pra agrupar, grafia da primeira
  ocorrência pra exibir) até valer a pena extrair um helper compartilhado, o
  que fica pra quando (e se) um terceiro consumidor aparecer.

## Componentes / UI

Porto para `src/components/ui/chart.tsx` só o wrapper de gráfico do shadcn
(`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, tipo `ChartConfig`)
encontrado via busca no 21st.dev — que usa `recharts` por baixo — sem o resto
do componente de demonstração (que gera dado aleatório com `Math.random()` e
usa `Card`/`Button`/`Badge` do shadcn que este projeto não usa). Cores de série
mapeadas para as variáveis CSS que já existem: `--color-accent` (verde),
`--color-amber`, `--color-red` — nenhuma cor nova entra no projeto.

`recharts` é a única dependência nova (`npm install recharts`).

`PainelHistoricoClient.tsx` renderiza, abaixo da tabela "Origem → receita"
(all-time) que já existe e não muda:

1. **Filtro de período** — barra de botões (7 dias / 30 dias / 90 dias / este
   ano / personalizado), mesmo padrão visual de segmented-control já usado em
   outras telas do app. "Personalizado" revela dois `<Input type="date">`
   (mesmo componente já usado em `NegocioDrawer.tsx`/`NovoNegocioModal.tsx`),
   com "até" limitado a hoje e "de" não podendo ficar depois de "até". Padrão
   ao carregar: últimos 30 dias.
2. **Grid de 4 cartões** (`grid-cols-1 md:grid-cols-2`, mesmo breakpoint da
   Fase 4A):
   - **Mensalidade conquistada por período** — área suave (`AreaChart` do
     recharts), cor `accent`; tooltip mostra também a contagem de negócios
     ganhos naquele bucket.
   - **Novas contas por período** — barra (`BarChart`), cor `accent`.
   - **Origem → receita no período** — barra por origem, rotulada
     explicitamente "no período selecionado" para não ser confundida com a
     tabela all-time que continua na tela.
   - **Implantações concluídas por período** — barra, cor `amber`.

## Erros e casos-limite

- Falha na leitura do Supabase: mesmo componente `Unavailable` já usado hoje —
  a seção histórica nem aparece se os dados de base não vieram.
- Período sem nenhum evento: gráfico renderiza com todos os buckets zerados
  (não esconde o cartão, não mostra "sem dados") — mesmo raciocínio de bucket
  vazio acima.
- Intervalo customizado inválido ("de" depois de "até"): botão de aplicar fica
  desabilitado, mesmo padrão de validação inline já usado em formulários deste
  projeto (ex: "nome não pode ficar vazio" na gaveta do Pipeline).

## Testes

`src/lib/painel-historico.test.ts`, Vitest, sem testing-library (mesma
limitação já documentada na Fase 4B — este projeto não tem infraestrutura de
testes de componente React). Cobre as 4 funções de agregação:

- Granularidade muda corretamente nas bordas de 31/32 e 180/181 dias.
- Bucket sem nenhum evento aparece com valor 0, não é omitido.
- Evento exatamente na borda do período (início ou fim) é incluído.
- Mês com 28/30/31 dias agrega corretamente.
- `calcularOrigemReceitaNoPeriodo` normaliza origem (trim + lowercase) do
  mesmo jeito que `calcularMetricasPainel` já faz.

## Fora de escopo

- Comparação com o período anterior (ex: "+12% vs. mês passado") — não foi
  pedido; fica pra uma iteração futura se fizer falta.
- Qualquer nova tabela ou coluna no banco — os campos de data já existem.
- Filtro de período afetando os KPIs de "hoje" no topo da tela — esses
  continuam sendo, deliberadamente, o instantâneo de agora.

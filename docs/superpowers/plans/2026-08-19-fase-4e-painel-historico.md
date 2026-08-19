# Fase 4E — Painel Histórico com Gráficos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acrescentar, abaixo do painel de hoje (que não muda), uma seção histórica no `/painel` com 4 gráficos e um filtro de período (presets + customizado), consumindo só dados reais já existentes no banco.

**Architecture:** `PainelPage` (Server Component) passa a buscar também `criado_em`/`fechado_em` dos negócios e `criado_em` das contas (colunas já existentes, sem migração) e repassa os arrays crus para um novo Client Component, `PainelHistoricoClient`, que guarda o período selecionado em estado local e recalcula os 4 gráficos inteiramente no navegador a cada troca de período — sem nova consulta ao servidor. Um módulo puro novo (`src/lib/painel-historico.ts`, mesmo padrão de `src/lib/painel.ts`) faz o agrupamento por bucket de tempo (dia/semana/mês, escolhido automaticamente pelo tamanho do período).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (Postgres + PostgREST), Vitest, Tailwind CSS v4, `recharts` (dependência nova) atrás de um wrapper fino adaptado do componente de gráfico do shadcn/ui (achado via busca de componentes no 21st.dev).

## Global Constraints

- **Nenhum dado fictício.** Todo gráfico consome os mesmos arrays que já saem do Supabase hoje — nenhuma tabela nova, nenhuma migração, nenhum dado gerado no cliente (o wrapper de gráfico adaptado do 21st.dev descarta o gerador de dado aleatório do componente original).
- **pt-BR** em toda string visível ao usuário.
- **Sem `motion-safe:`** em nenhuma classe Tailwind.
- **Banco único**, sem separação dev/prod.
- Spec de referência: `docs/superpowers/specs/2026-08-19-fase-4e-painel-historico-design.md`.

---

### Task 1: Módulo puro de agregação histórica

**Files:**
- Create: `src/lib/painel-historico.ts`
- Test: `src/lib/painel-historico.test.ts`

**Interfaces:**
- Consumes: `todayInAppTz`, `addDaysToDateStr`, `startOfWeekInAppTz`, `yearMonthInAppTz` de `src/lib/timezone.ts` (já existem, não mudam); `formatDate` de `src/lib/format.ts` (já existe, não muda).
- Produces (para a Task 4 consumir): tipos `Granularidade`, `BucketSerie`, `PontoNegociosGanhos`, `PontoContasCriadas`, `PontoImplantacoesConcluidas`, `OrigemReceitaPeriodo`; funções `granularidadeParaPeriodo(inicio: Date, fim: Date): Granularidade`, `calcularSerieNegociosGanhos(negocios, inicio: Date, fim: Date): PontoNegociosGanhos[]`, `calcularSerieContasCriadas(contas, inicio: Date, fim: Date): PontoContasCriadas[]`, `calcularSerieImplantacoesConcluidas(implantacoes, inicio: Date, fim: Date): PontoImplantacoesConcluidas[]`, `calcularOrigemReceitaNoPeriodo(negocios, contas, inicio: Date, fim: Date): OrigemReceitaPeriodo[]`. Os parâmetros de array usam tipos estruturais próprios do módulo (não importam de `painel.ts`) — qualquer array cujos itens tenham pelo menos os campos exigidos serve, incluindo `NegocioParaPainel`/`ContaParaPainel`/`ImplantacaoParaPainel` depois que a Task 2 os estender.

- [ ] **Step 1: Write the failing test**

Crie `src/lib/painel-historico.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  granularidadeParaPeriodo,
  calcularSerieNegociosGanhos,
  calcularSerieContasCriadas,
  calcularSerieImplantacoesConcluidas,
  calcularOrigemReceitaNoPeriodo,
} from "./painel-historico";

describe("granularidadeParaPeriodo", () => {
  it("30 e 31 dias agrupam por dia", () => {
    const inicio = new Date("2026-01-01T12:00:00Z");
    expect(granularidadeParaPeriodo(inicio, new Date("2026-01-31T12:00:00Z"))).toBe("dia");
    expect(granularidadeParaPeriodo(inicio, new Date("2026-02-01T12:00:00Z"))).toBe("dia");
  });

  it("32 e 180 dias agrupam por semana", () => {
    const inicio = new Date("2026-01-01T12:00:00Z");
    expect(granularidadeParaPeriodo(inicio, new Date("2026-02-02T12:00:00Z"))).toBe("semana");
    expect(granularidadeParaPeriodo(inicio, new Date("2026-06-30T12:00:00Z"))).toBe("semana");
  });

  it("181 dias agrupa por mês", () => {
    const inicio = new Date("2026-01-01T12:00:00Z");
    expect(granularidadeParaPeriodo(inicio, new Date("2026-07-01T12:00:00Z"))).toBe("mes");
  });
});

describe("calcularSerieNegociosGanhos", () => {
  const INICIO = new Date("2026-01-10T12:00:00Z");
  const FIM = new Date("2026-01-12T12:00:00Z"); // período de 3 dias: 10, 11, 12 de janeiro

  it("bucket sem nenhum negócio ganho aparece com 0, não some", () => {
    const serie = calcularSerieNegociosGanhos([], INICIO, FIM);
    expect(serie).toEqual([
      { chave: "2026-01-10", rotulo: "10 de jan", ganhos: 0, mrrGanho: 0 },
      { chave: "2026-01-11", rotulo: "11 de jan", ganhos: 0, mrrGanho: 0 },
      { chave: "2026-01-12", rotulo: "12 de jan", ganhos: 0, mrrGanho: 0 },
    ]);
  });

  it("negócio ganho exatamente no início do período é incluído", () => {
    const serie = calcularSerieNegociosGanhos(
      [{ resultado: "ganho", fechadoEm: "2026-01-10", mrr: 500 }],
      INICIO,
      FIM
    );
    expect(serie.find((p) => p.chave === "2026-01-10")).toEqual({
      chave: "2026-01-10",
      rotulo: "10 de jan",
      ganhos: 1,
      mrrGanho: 500,
    });
  });

  it("negócio ganho exatamente no fim do período é incluído", () => {
    const serie = calcularSerieNegociosGanhos(
      [{ resultado: "ganho", fechadoEm: "2026-01-12", mrr: 700 }],
      INICIO,
      FIM
    );
    expect(serie.find((p) => p.chave === "2026-01-12")?.ganhos).toBe(1);
  });

  it("negócio ganho fora do período (antes ou depois) não conta", () => {
    const serie = calcularSerieNegociosGanhos(
      [
        { resultado: "ganho", fechadoEm: "2026-01-09", mrr: 500 },
        { resultado: "ganho", fechadoEm: "2026-01-13", mrr: 500 },
      ],
      INICIO,
      FIM
    );
    const totalGanhos = serie.reduce((soma, p) => soma + p.ganhos, 0);
    expect(totalGanhos).toBe(0);
  });

  it("negócio perdido não conta, mesmo com fechadoEm dentro do período", () => {
    const serie = calcularSerieNegociosGanhos(
      [{ resultado: "perdido", fechadoEm: "2026-01-11", mrr: 500 }],
      INICIO,
      FIM
    );
    expect(serie.reduce((soma, p) => soma + p.ganhos, 0)).toBe(0);
  });

  it("negócio ganho sem fechadoEm não conta", () => {
    const serie = calcularSerieNegociosGanhos(
      [{ resultado: "ganho", fechadoEm: null, mrr: 500 }],
      INICIO,
      FIM
    );
    expect(serie.reduce((soma, p) => soma + p.ganhos, 0)).toBe(0);
  });

  it("bucket mensal: negócio ganho em fevereiro cai no bucket de fevereiro, não janeiro nem março", () => {
    const inicio = new Date("2026-01-01T12:00:00Z");
    const fim = new Date("2026-07-01T12:00:00Z"); // 181 dias -> granularidade "mes"
    const serie = calcularSerieNegociosGanhos(
      [{ resultado: "ganho", fechadoEm: "2026-02-15", mrr: 1000 }],
      inicio,
      fim
    );
    expect(serie.find((p) => p.chave === "2026-02")).toMatchObject({ ganhos: 1, mrrGanho: 1000 });
    expect(serie.find((p) => p.chave === "2026-01")).toMatchObject({ ganhos: 0 });
    expect(serie.find((p) => p.chave === "2026-03")).toMatchObject({ ganhos: 0 });
  });
});

describe("calcularSerieContasCriadas", () => {
  const INICIO = new Date("2026-01-10T12:00:00Z");
  const FIM = new Date("2026-01-12T12:00:00Z");

  it("conta criada dentro do período cai no bucket certo", () => {
    const serie = calcularSerieContasCriadas([{ criadoEm: "2026-01-11T09:00:00Z" }], INICIO, FIM);
    expect(serie.find((p) => p.chave === "2026-01-11")?.contas).toBe(1);
  });

  it("conta criada fora do período não conta", () => {
    const serie = calcularSerieContasCriadas([{ criadoEm: "2026-01-20T09:00:00Z" }], INICIO, FIM);
    expect(serie.reduce((soma, p) => soma + p.contas, 0)).toBe(0);
  });
});

describe("calcularSerieImplantacoesConcluidas", () => {
  const INICIO = new Date("2026-01-10T12:00:00Z");
  const FIM = new Date("2026-01-12T12:00:00Z");

  it("implantação concluída dentro do período conta", () => {
    const serie = calcularSerieImplantacoesConcluidas([{ concluidaEm: "2026-01-11T09:00:00Z" }], INICIO, FIM);
    expect(serie.find((p) => p.chave === "2026-01-11")?.concluidas).toBe(1);
  });

  it("implantação ainda aberta (concluidaEm null) não conta", () => {
    const serie = calcularSerieImplantacoesConcluidas([{ concluidaEm: null }], INICIO, FIM);
    expect(serie.reduce((soma, p) => soma + p.concluidas, 0)).toBe(0);
  });
});

describe("calcularOrigemReceitaNoPeriodo", () => {
  const INICIO = new Date("2026-01-10T12:00:00Z");
  const FIM = new Date("2026-01-12T12:00:00Z");
  const contas = [
    { id: "c1", origem: "Indicação" },
    { id: "c2", origem: "indicação" }, // grafia diferente, mesma origem normalizada
    { id: "c3", origem: null },
  ];

  it("agrupa por origem normalizada (trim + lowercase), exibindo a grafia da primeira ocorrência", () => {
    const origens = calcularOrigemReceitaNoPeriodo(
      [
        { contaId: "c1", resultado: "ganho", mrr: 1000, criadoEm: "2026-01-11T09:00:00Z" },
        { contaId: "c2", resultado: null, mrr: null, criadoEm: "2026-01-11T09:00:00Z" },
      ],
      contas,
      INICIO,
      FIM
    );
    expect(origens).toEqual([{ origem: "Indicação", leads: 2, ganhos: 1, mrr: 1000 }]);
  });

  it("negócio criado fora do período não entra no agrupamento", () => {
    const origens = calcularOrigemReceitaNoPeriodo(
      [{ contaId: "c1", resultado: "ganho", mrr: 1000, criadoEm: "2026-01-20T09:00:00Z" }],
      contas,
      INICIO,
      FIM
    );
    expect(origens).toEqual([]);
  });

  it("conta sem origem agrupa em 'Sem origem'", () => {
    const origens = calcularOrigemReceitaNoPeriodo(
      [{ contaId: "c3", resultado: null, mrr: null, criadoEm: "2026-01-11T09:00:00Z" }],
      contas,
      INICIO,
      FIM
    );
    expect(origens).toEqual([{ origem: "Sem origem", leads: 1, ganhos: 0, mrr: 0 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/painel-historico.test.ts`
Expected: FAIL — `src/lib/painel-historico.ts` não existe ainda (erro de import/módulo não encontrado).

- [ ] **Step 3: Write minimal implementation**

Crie `src/lib/painel-historico.ts`:

```ts
import { addDaysToDateStr, startOfWeekInAppTz, todayInAppTz, yearMonthInAppTz } from "./timezone";
import { formatDate } from "./format";

/**
 * Agregação por período do Painel (Fase 4E) — separado de `painel.ts`
 * (que calcula só o instantâneo de HOJE) porque aqui a entrada é sempre um
 * intervalo de datas, não "agora". Módulo puro, sem Supabase, sem DOM —
 * roda tanto no servidor quanto no cliente (é chamado direto de
 * `PainelHistoricoClient.tsx`, sem round-trip ao servidor a cada troca de
 * período).
 */

export type Granularidade = "dia" | "semana" | "mes";

/** ≤31 dias → dia · 32–180 dias → semana · >180 dias → mês. */
export function granularidadeParaPeriodo(inicio: Date, fim: Date): Granularidade {
  const dias = Math.round((fim.getTime() - inicio.getTime()) / 86_400_000);
  if (dias <= 31) return "dia";
  if (dias <= 180) return "semana";
  return "mes";
}

export type BucketSerie = { chave: string; rotulo: string };

function gerarBucketsDiarios(inicio: Date, fim: Date): BucketSerie[] {
  const buckets: BucketSerie[] = [];
  const fimStr = todayInAppTz(fim);
  let cursor = todayInAppTz(inicio);
  while (cursor <= fimStr) {
    buckets.push({ chave: cursor, rotulo: formatDate(cursor) });
    cursor = addDaysToDateStr(cursor, 1);
  }
  return buckets;
}

function gerarBucketsSemanais(inicio: Date, fim: Date): BucketSerie[] {
  const buckets: BucketSerie[] = [];
  const fimStr = todayInAppTz(fim);
  let cursor = todayInAppTz(startOfWeekInAppTz(inicio));
  while (cursor <= fimStr) {
    buckets.push({ chave: cursor, rotulo: formatDate(cursor) });
    cursor = addDaysToDateStr(cursor, 7);
  }
  return buckets;
}

const MESES_ABREVIADOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function gerarBucketsMensais(inicio: Date, fim: Date): BucketSerie[] {
  const buckets: BucketSerie[] = [];
  let { year, month0 } = yearMonthInAppTz(inicio);
  const fimYm = yearMonthInAppTz(fim);
  const indiceFim = fimYm.year * 12 + fimYm.month0;

  while (year * 12 + month0 <= indiceFim) {
    const chave = `${year}-${String(month0 + 1).padStart(2, "0")}`;
    const rotulo = `${MESES_ABREVIADOS[month0]}/${String(year).slice(2)}`;
    buckets.push({ chave, rotulo });
    month0 += 1;
    if (month0 > 11) {
      month0 = 0;
      year += 1;
    }
  }
  return buckets;
}

function gerarBuckets(inicio: Date, fim: Date, granularidade: Granularidade): BucketSerie[] {
  if (granularidade === "dia") return gerarBucketsDiarios(inicio, fim);
  if (granularidade === "semana") return gerarBucketsSemanais(inicio, fim);
  return gerarBucketsMensais(inicio, fim);
}

/** `dataStr` de 10 caracteres é uma coluna `date` (ex: `fechado_em`) — sem hora,
 * fixada ao meio-dia UTC pra nunca cair no dia anterior em São Paulo (mesmo
 * truque de `formatDate` em `src/lib/format.ts`). Qualquer outro tamanho é um
 * `timestamptz` de verdade (ex: `criado_em`, `concluida_em`). */
function chaveDoBucket(dataStr: string, granularidade: Granularidade): string {
  const data = new Date(dataStr.length === 10 ? `${dataStr}T12:00:00Z` : dataStr);
  if (granularidade === "dia") return todayInAppTz(data);
  if (granularidade === "semana") return todayInAppTz(startOfWeekInAppTz(data));
  const { year, month0 } = yearMonthInAppTz(data);
  return `${year}-${String(month0 + 1).padStart(2, "0")}`;
}

export type PontoNegociosGanhos = BucketSerie & { ganhos: number; mrrGanho: number };

export function calcularSerieNegociosGanhos(
  negocios: Array<{ resultado: "ganho" | "perdido" | null; fechadoEm: string | null; mrr: number | null }>,
  inicio: Date,
  fim: Date
): PontoNegociosGanhos[] {
  const granularidade = granularidadeParaPeriodo(inicio, fim);
  const buckets = gerarBuckets(inicio, fim, granularidade);
  const porChave = new Map(buckets.map((b) => [b.chave, { ganhos: 0, mrrGanho: 0 }]));
  const inicioStr = todayInAppTz(inicio);
  const fimStr = todayInAppTz(fim);

  for (const n of negocios) {
    if (n.resultado !== "ganho" || !n.fechadoEm) continue;
    if (n.fechadoEm < inicioStr || n.fechadoEm > fimStr) continue;
    const acumulado = porChave.get(chaveDoBucket(n.fechadoEm, granularidade));
    if (!acumulado) continue;
    acumulado.ganhos += 1;
    acumulado.mrrGanho += n.mrr ?? 0;
  }

  return buckets.map((b) => ({ ...b, ...porChave.get(b.chave)! }));
}

export type PontoContasCriadas = BucketSerie & { contas: number };

export function calcularSerieContasCriadas(
  contas: Array<{ criadoEm: string }>,
  inicio: Date,
  fim: Date
): PontoContasCriadas[] {
  const granularidade = granularidadeParaPeriodo(inicio, fim);
  const buckets = gerarBuckets(inicio, fim, granularidade);
  const porChave = new Map(buckets.map((b) => [b.chave, { contas: 0 }]));
  const inicioStr = todayInAppTz(inicio);
  const fimStr = todayInAppTz(fim);

  for (const c of contas) {
    const diaStr = todayInAppTz(new Date(c.criadoEm));
    if (diaStr < inicioStr || diaStr > fimStr) continue;
    const acumulado = porChave.get(chaveDoBucket(c.criadoEm, granularidade));
    if (!acumulado) continue;
    acumulado.contas += 1;
  }

  return buckets.map((b) => ({ ...b, ...porChave.get(b.chave)! }));
}

export type PontoImplantacoesConcluidas = BucketSerie & { concluidas: number };

export function calcularSerieImplantacoesConcluidas(
  implantacoes: Array<{ concluidaEm: string | null }>,
  inicio: Date,
  fim: Date
): PontoImplantacoesConcluidas[] {
  const granularidade = granularidadeParaPeriodo(inicio, fim);
  const buckets = gerarBuckets(inicio, fim, granularidade);
  const porChave = new Map(buckets.map((b) => [b.chave, { concluidas: 0 }]));
  const inicioStr = todayInAppTz(inicio);
  const fimStr = todayInAppTz(fim);

  for (const i of implantacoes) {
    if (!i.concluidaEm) continue;
    const diaStr = todayInAppTz(new Date(i.concluidaEm));
    if (diaStr < inicioStr || diaStr > fimStr) continue;
    const acumulado = porChave.get(chaveDoBucket(i.concluidaEm, granularidade));
    if (!acumulado) continue;
    acumulado.concluidas += 1;
  }

  return buckets.map((b) => ({ ...b, ...porChave.get(b.chave)! }));
}

export type OrigemReceitaPeriodo = { origem: string; leads: number; ganhos: number; mrr: number };

export function calcularOrigemReceitaNoPeriodo(
  negocios: Array<{ contaId: string; resultado: "ganho" | "perdido" | null; mrr: number | null; criadoEm: string }>,
  contas: Array<{ id: string; origem: string | null }>,
  inicio: Date,
  fim: Date
): OrigemReceitaPeriodo[] {
  const contaPorId = new Map(contas.map((c) => [c.id, c]));
  const inicioStr = todayInAppTz(inicio);
  const fimStr = todayInAppTz(fim);
  const gruposPorChave = new Map<string, OrigemReceitaPeriodo>();

  for (const n of negocios) {
    const diaStr = todayInAppTz(new Date(n.criadoEm));
    if (diaStr < inicioStr || diaStr > fimStr) continue;

    const conta = contaPorId.get(n.contaId);
    const origemBruta = conta?.origem?.trim();
    const chave = origemBruta ? origemBruta.toLowerCase() : "sem-origem";
    const rotulo = origemBruta ? origemBruta : "Sem origem";

    let grupo = gruposPorChave.get(chave);
    if (!grupo) {
      grupo = { origem: rotulo, leads: 0, ganhos: 0, mrr: 0 };
      gruposPorChave.set(chave, grupo);
    }
    grupo.leads += 1;
    if (n.resultado === "ganho") {
      grupo.ganhos += 1;
      grupo.mrr += n.mrr ?? 0;
    }
  }

  return Array.from(gruposPorChave.values()).sort((a, b) => b.mrr - a.mrr);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/painel-historico.test.ts`
Expected: PASS — todos os `it(...)` verdes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/painel-historico.ts src/lib/painel-historico.test.ts
git commit -m "feat: agregação pura por período do Painel (Fase 4E, Task 1)"
```

---

### Task 2: Estender a leitura de dados com as datas de evento

**Files:**
- Modify: `src/lib/painel.ts`
- Modify: `src/lib/data/painel.ts`
- Modify: `src/lib/painel.test.ts`

**Interfaces:**
- Consumes: nada de novo — só estende os tipos e a consulta já existentes.
- Produces: `NegocioParaPainel` ganha `criadoEm: string` e `fechadoEm: string | null`; `ContaParaPainel` ganha `criadoEm: string`. `listDadosDoPainel()` passa a popular esses campos. A Task 5 consome `dados.negocios`/`dados.contas` (já com os campos novos) pra passar pra `PainelHistoricoClient`.

- [ ] **Step 1: Estender os tipos em `src/lib/painel.ts`**

Em `src/lib/painel.ts`, altere:

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
```

para:

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
  /** Usado pela Fase 4E (`painel-historico.ts`) pra agrupar negócios ganhos por período. */
  criadoEm: string;
  fechadoEm: string | null;
};
```

E:

```ts
export type ContaParaPainel = {
  id: string;
  fase: "prospect" | "implantacao" | "cliente" | "perdido" | "churn";
  origem: string | null;
};
```

para:

```ts
export type ContaParaPainel = {
  id: string;
  fase: "prospect" | "implantacao" | "cliente" | "perdido" | "churn";
  origem: string | null;
  /** Usado pela Fase 4E (`painel-historico.ts`) pra agrupar novas contas por período. */
  criadoEm: string;
};
```

- [ ] **Step 2: Atualizar as fábricas de teste em `src/lib/painel.test.ts`**

Em `src/lib/painel.test.ts`, altere as duas fábricas (adicionando os campos novos com um valor padrão fixo, fora de qualquer período que os testes existentes usem):

```ts
function negocio(over: Partial<NegocioParaPainel> = {}): NegocioParaPainel {
  return {
    id: "negocio-1",
    contaId: "conta-1",
    resultado: null,
    mrr: 1000,
    setup: 500,
    proximoPasso: "Ligar para a sócia financeira",
    proximoPassoEm: "2026-08-20",
    mexidoEm: "2026-08-14T12:00:00Z",
    criadoEm: "2026-08-01T12:00:00Z",
    fechadoEm: null,
    ...over,
  };
}

function conta(over: Partial<ContaParaPainel> = {}): ContaParaPainel {
  return {
    id: "conta-1",
    fase: "prospect",
    origem: null,
    criadoEm: "2026-08-01T12:00:00Z",
    ...over,
  };
}
```

- [ ] **Step 3: Rodar a suíte existente e confirmar que nada quebrou**

Run: `npx vitest run src/lib/painel.test.ts`
Expected: PASS — os testes existentes de `calcularMetricasPainel` continuam verdes (esses campos não são usados por essa função).

- [ ] **Step 4: Estender a consulta em `src/lib/data/painel.ts`**

Em `src/lib/data/painel.ts`, altere o `Promise.all`:

```ts
  const [negociosRes, contasRes, implantacoesRes] = await Promise.all([
    supabase
      .from("negocios")
      .select("id, conta_id, resultado, mrr, setup, proximo_passo, proximo_passo_em, mexido_em")
      .order("criado_em", { ascending: true }),
    supabase.from("contas").select("id, fase, origem"),
    supabase.from("implantacoes").select("negocio_id, concluida_em"),
  ]);
```

para:

```ts
  const [negociosRes, contasRes, implantacoesRes] = await Promise.all([
    supabase
      .from("negocios")
      .select(
        "id, conta_id, resultado, mrr, setup, proximo_passo, proximo_passo_em, mexido_em, criado_em, fechado_em"
      )
      .order("criado_em", { ascending: true }),
    supabase.from("contas").select("id, fase, origem, criado_em"),
    supabase.from("implantacoes").select("negocio_id, concluida_em"),
  ]);
```

E o mapeamento:

```ts
  const negocios: NegocioParaPainel[] = (negociosRes.data ?? []).map((n) => ({
    id: n.id,
    contaId: n.conta_id,
    resultado: n.resultado,
    mrr: n.mrr === null ? null : Number(n.mrr),
    setup: n.setup === null ? null : Number(n.setup),
    proximoPasso: n.proximo_passo,
    proximoPassoEm: n.proximo_passo_em,
    mexidoEm: n.mexido_em,
  }));

  const contas: ContaParaPainel[] = (contasRes.data ?? []).map((c) => ({
    id: c.id,
    fase: c.fase,
    origem: c.origem,
  }));
```

para:

```ts
  const negocios: NegocioParaPainel[] = (negociosRes.data ?? []).map((n) => ({
    id: n.id,
    contaId: n.conta_id,
    resultado: n.resultado,
    mrr: n.mrr === null ? null : Number(n.mrr),
    setup: n.setup === null ? null : Number(n.setup),
    proximoPasso: n.proximo_passo,
    proximoPassoEm: n.proximo_passo_em,
    mexidoEm: n.mexido_em,
    criadoEm: n.criado_em,
    fechadoEm: n.fechado_em,
  }));

  const contas: ContaParaPainel[] = (contasRes.data ?? []).map((c) => ({
    id: c.id,
    fase: c.fase,
    origem: c.origem,
    criadoEm: c.criado_em,
  }));
```

- [ ] **Step 5: Verificar tipos e testes**

Run: `npx tsc --noEmit && npm test`
Expected: ambos limpos — nenhum erro de tipo, todos os testes (incluindo os novos da Task 1) passando.

- [ ] **Step 6: Commit**

```bash
git add src/lib/painel.ts src/lib/painel.test.ts src/lib/data/painel.ts
git commit -m "feat: inclui criado_em/fechado_em na leitura do Painel (Fase 4E, Task 2)"
```

---

### Task 3: Instalar recharts e portar o wrapper de gráfico

**Files:**
- Create: `src/components/ui/chart.tsx`
- Modify: `package.json` (via `npm install`)

**Interfaces:**
- Consumes: `recharts` (dependência nova).
- Produces: `ChartConfig`, `ChartContainer`, `ChartTooltip`, `ChartTooltipContent` de `src/components/ui/chart.tsx`, consumidos pela Task 4.

- [ ] **Step 1: Instalar a dependência**

Run: `npm install recharts`
Expected: `recharts` aparece em `package.json` → `dependencies`.

- [ ] **Step 2: Criar o wrapper adaptado**

Crie `src/components/ui/chart.tsx`:

```tsx
"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import clsx from "clsx";

/**
 * Wrapper fino sobre `recharts`, adaptado do componente de gráfico do
 * shadcn/ui (achado via busca de componentes prontos no 21st.dev) — mantém
 * só o que os gráficos do Painel usam: container responsivo com cor de
 * série por CSS var, e um tooltip simples. Removido do original: a
 * distinção light/dark (este projeto não tem modo escuro), `ChartLegend` e
 * o gerador de dado de exemplo (o Painel só mostra dado real, vindo do
 * Supabase).
 */

export type ChartConfig = {
  [chave: string]: { label: string; color: string };
};

type ChartContextValue = { config: ChartConfig };
const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChart(): ChartContextValue {
  const contexto = React.useContext(ChartContext);
  if (!contexto) throw new Error("useChart precisa estar dentro de <ChartContainer />");
  return contexto;
}

export function ChartContainer({
  config,
  className,
  children,
}: {
  config: ChartConfig;
  className?: string;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const id = React.useId();
  const chartId = `chart-${id.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div data-chart={chartId} className={clsx("aspect-auto w-full", className)}>
        <style
          dangerouslySetInnerHTML={{
            __html: `[data-chart=${chartId}] {\n${Object.entries(config)
              .map(([chave, item]) => `  --color-${chave}: ${item.color};`)
              .join("\n")}\n}`,
          }}
        />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

type ItemTooltip = {
  dataKey?: string | number;
  name?: string | number;
  value?: number;
  color?: string;
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: readonly ItemTooltip[];
  label?: string;
  formatter?: (value: number) => string;
}) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] shadow-lg">
      {label && <div className="mb-1 font-medium">{label}</div>}
      <div className="grid gap-1">
        {payload.map((item, index) => {
          const chave = String(item.dataKey ?? item.name ?? index);
          const itemConfig = config[chave];
          return (
            <div key={chave} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
              <span className="text-muted">{itemConfig?.label ?? chave}</span>
              <span className="ml-auto font-mono font-medium">
                {formatter && item.value !== undefined ? formatter(item.value) : item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: limpo — `recharts` já traz seus próprios tipos, nenhum `@types/` adicional é necessário.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/ui/chart.tsx
git commit -m "feat: instala recharts e porta wrapper de gráfico do 21st.dev (Fase 4E, Task 3)"
```

---

### Task 4: Componente do painel histórico (filtro de período + 4 gráficos)

**Files:**
- Create: `src/components/painel/PainelHistoricoClient.tsx`

**Interfaces:**
- Consumes: `NegocioParaPainel`, `ContaParaPainel`, `ImplantacaoParaPainel` de `src/lib/painel.ts` (Task 2); `granularidadeParaPeriodo`, `calcularSerieNegociosGanhos`, `calcularSerieContasCriadas`, `calcularSerieImplantacoesConcluidas`, `calcularOrigemReceitaNoPeriodo` de `src/lib/painel-historico.ts` (Task 1); `ChartConfig`, `ChartContainer`, `ChartTooltip`, `ChartTooltipContent` de `src/components/ui/chart.tsx` (Task 3); `todayInAppTz`, `addDaysToDateStr`, `monthStartInAppTz`, `yearMonthInAppTz` de `src/lib/timezone.ts`; `formatCurrency`, `formatCurrencyCompact` de `src/lib/format.ts`; `Card` de `src/components/ui/Card.tsx`; `Input` de `src/components/ui/Field.tsx`.
- Produces: componente `PainelHistoricoClient({ negocios, contas, implantacoes })`, consumido pela Task 5 em `page.tsx`.

- [ ] **Step 1: Criar o componente**

Crie `src/components/painel/PainelHistoricoClient.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import { todayInAppTz, addDaysToDateStr, monthStartInAppTz, yearMonthInAppTz } from "@/lib/timezone";
import {
  calcularSerieNegociosGanhos,
  calcularSerieContasCriadas,
  calcularSerieImplantacoesConcluidas,
  calcularOrigemReceitaNoPeriodo,
} from "@/lib/painel-historico";
import type { NegocioParaPainel, ContaParaPainel, ImplantacaoParaPainel } from "@/lib/painel";

type Preset = "7d" | "30d" | "90d" | "ano" | "personalizado";

const PRESETS: { valor: Preset; rotulo: string }[] = [
  { valor: "7d", rotulo: "7 dias" },
  { valor: "30d", rotulo: "30 dias" },
  { valor: "90d", rotulo: "90 dias" },
  { valor: "ano", rotulo: "Este ano" },
  { valor: "personalizado", rotulo: "Personalizado" },
];

function periodoPreset(preset: Preset, hoje: Date): { inicio: Date; fim: Date } {
  if (preset === "7d") return { inicio: new Date(hoje.getTime() - 6 * 86_400_000), fim: hoje };
  if (preset === "30d") return { inicio: new Date(hoje.getTime() - 29 * 86_400_000), fim: hoje };
  if (preset === "90d") return { inicio: new Date(hoje.getTime() - 89 * 86_400_000), fim: hoje };
  const { year } = yearMonthInAppTz(hoje);
  return { inicio: monthStartInAppTz(year, 0), fim: hoje };
}

export function PainelHistoricoClient({
  negocios,
  contas,
  implantacoes,
}: {
  negocios: NegocioParaPainel[];
  contas: ContaParaPainel[];
  implantacoes: ImplantacaoParaPainel[];
}) {
  const hoje = useMemo(() => new Date(), []);
  const [preset, setPreset] = useState<Preset>("30d");
  const [deCustom, setDeCustom] = useState(() => addDaysToDateStr(todayInAppTz(hoje), -29));
  const [ateCustom, setAteCustom] = useState(() => todayInAppTz(hoje));

  const periodo = useMemo(() => {
    if (preset === "personalizado") {
      return { inicio: new Date(`${deCustom}T12:00:00Z`), fim: new Date(`${ateCustom}T12:00:00Z`) };
    }
    return periodoPreset(preset, hoje);
  }, [preset, deCustom, ateCustom, hoje]);

  const rangeCustomInvalido = preset === "personalizado" && (!deCustom || !ateCustom || deCustom > ateCustom);

  const serieGanhos = useMemo(
    () => calcularSerieNegociosGanhos(negocios, periodo.inicio, periodo.fim),
    [negocios, periodo]
  );
  const serieContas = useMemo(
    () => calcularSerieContasCriadas(contas, periodo.inicio, periodo.fim),
    [contas, periodo]
  );
  const serieImplantacoes = useMemo(
    () => calcularSerieImplantacoesConcluidas(implantacoes, periodo.inicio, periodo.fim),
    [implantacoes, periodo]
  );
  const origemPeriodo = useMemo(
    () => calcularOrigemReceitaNoPeriodo(negocios, contas, periodo.inicio, periodo.fim),
    [negocios, contas, periodo]
  );

  const configGanhos: ChartConfig = { mrrGanho: { label: "Mensalidade conquistada", color: "var(--color-accent)" } };
  const configContas: ChartConfig = { contas: { label: "Novas contas", color: "var(--color-accent)" } };
  const configImplantacoes: ChartConfig = {
    concluidas: { label: "Implantações concluídas", color: "var(--color-amber)" },
  };
  const configOrigem: ChartConfig = { mrr: { label: "Mensalidade", color: "var(--color-accent)" } };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-border">
          {PRESETS.map((p) => (
            <button
              key={p.valor}
              type="button"
              onClick={() => setPreset(p.valor)}
              className={clsx(
                "px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                preset === p.valor ? "bg-accent text-bone" : "bg-surface text-muted hover:text-ink"
              )}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        {preset === "personalizado" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={deCustom} max={ateCustom} onChange={(e) => setDeCustom(e.target.value)} />
            <span className="text-muted">até</span>
            <Input
              type="date"
              value={ateCustom}
              min={deCustom}
              max={todayInAppTz(hoje)}
              onChange={(e) => setAteCustom(e.target.value)}
            />
            {rangeCustomInvalido && <span className="text-[12px] text-red">período inválido</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="flex flex-col gap-2 p-4">
          <span className="text-[13px] font-medium">Mensalidade conquistada por período</span>
          <ChartContainer config={configGanhos} className="h-[220px]">
            <AreaChart data={serieGanhos}>
              <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--color-border)" />
              <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent formatter={formatCurrency} />} />
              <Area
                type="monotone"
                dataKey="mrrGanho"
                stroke="var(--color-accent)"
                fill="var(--color-accent-tint)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </Card>

        <Card className="flex flex-col gap-2 p-4">
          <span className="text-[13px] font-medium">Novas contas por período</span>
          <ChartContainer config={configContas} className="h-[220px]">
            <BarChart data={serieContas}>
              <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--color-border)" />
              <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="contas" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </Card>

        <Card className="flex flex-col gap-2 p-4">
          <span className="text-[13px] font-medium">Origem → receita no período selecionado</span>
          {origemPeriodo.length === 0 ? (
            <div className="text-[12.5px] text-faint">Nenhum negócio criado nesse período.</div>
          ) : (
            <ChartContainer config={configOrigem} className="h-[220px]">
              <BarChart data={origemPeriodo} layout="vertical">
                <CartesianGrid horizontal={false} strokeDasharray="4 4" stroke="var(--color-border)" />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="origem" tickLine={false} axisLine={false} fontSize={11} width={90} />
                <ChartTooltip content={<ChartTooltipContent formatter={formatCurrencyCompact} />} />
                <Bar dataKey="mrr" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </Card>

        <Card className="flex flex-col gap-2 p-4">
          <span className="text-[13px] font-medium">Implantações concluídas por período</span>
          <ChartContainer config={configImplantacoes} className="h-[220px]">
            <BarChart data={serieImplantacoes}>
              <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--color-border)" />
              <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="concluidas" fill="var(--color-amber)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: limpo. Se o TypeScript reclamar da assinatura de `formatter` em `ChartTooltipContent` (recharts pode tipar `value` como `number | string | Array<...>` dependendo da versão instalada), ajuste a assinatura de `formatter` em `src/components/ui/chart.tsx` (Task 3) para aceitar o tipo exato que o `payload` do recharts entrega nessa versão — não silencie com `any`.

- [ ] **Step 3: Commit**

```bash
git add src/components/painel/PainelHistoricoClient.tsx
git commit -m "feat: componente PainelHistoricoClient com filtro de período e 4 gráficos (Fase 4E, Task 4)"
```

---

### Task 5: Integrar no `/painel`

**Files:**
- Modify: `src/app/(app)/painel/page.tsx`

**Interfaces:**
- Consumes: `PainelHistoricoClient` de `src/components/painel/PainelHistoricoClient.tsx` (Task 4); `dados.negocios`, `dados.contas`, `dados.implantacoes` já devolvidos por `listDadosDoPainel()` (Task 2, já com `criadoEm`/`fechadoEm`).
- Produces: `/painel` renderiza a seção histórica abaixo da tabela "Origem → receita" existente.

- [ ] **Step 1: Importar e renderizar o componente**

Em `src/app/(app)/painel/page.tsx`, adicione o import:

```ts
import { PainelHistoricoClient } from "@/components/painel/PainelHistoricoClient";
```

E, logo depois do bloco que fecha a tabela "Origem → receita" (o `</div>` que fecha `<div className="flex-1 overflow-y-auto rounded-xl border border-border bg-surface p-4 scrollbar-thin">`, antes do `</PageBody>` final), adicione:

```tsx
      <PainelHistoricoClient negocios={dados.negocios} contas={dados.contas} implantacoes={dados.implantacoes} />
```

- [ ] **Step 2: Verificação completa**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: os quatro comandos limpos — suíte inteira passando (Task 1 acrescentou testes novos, nenhum teste existente muda de comportamento), sem erro de tipo, sem erro de lint, build de produção com sucesso incluindo a rota `/painel`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/painel/page.tsx"
git commit -m "feat: integra o painel histórico na tela /painel (Fase 4E, Task 5)"
```

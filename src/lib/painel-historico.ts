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

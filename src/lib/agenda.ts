import { APP_TIMEZONE, todayInAppTz } from "./timezone";

/**
 * A grade de um mês, com dias suficientes para as semanas fecharem.
 *
 * `chave` é "YYYY-MM-DD" no FUSO DO APP, e é por ela que as reuniões são
 * agrupadas. Essa é a parte que erra fácil: uma reunião às 23h de São Paulo é
 * 02h do dia seguinte em UTC, e agrupar pelo dia UTC — que é o que
 * `Date.getDate()` faz sobre um instante, se o servidor rodar em UTC — a
 * colocaria no quadrado errado do calendário. A Vercel roda em UTC.
 */
export type DiaDaGrade = {
  /** "YYYY-MM-DD" no fuso do app. */
  chave: string;
  /** O número que aparece no quadrado. */
  numero: number;
  /** Falso para os dias do mês anterior e do seguinte que fecham a semana. */
  doMes: boolean;
};

/** Domingo a sábado, como o calendário brasileiro. */
export const DIAS_DA_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

function chaveDeData(d: Date): string {
  // `en-CA` devolve exatamente "YYYY-MM-DD", que é o formato que o resto do
  // app já usa para dia sem hora (`due_date`, `todayInAppTz`).
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(d);
}

/**
 * O dia do app em que este instante cai. É a ponte entre `acontece_em`
 * (timestamptz) e o quadrado do calendário.
 */
export function diaDaReuniao(aconteceEm: string): string {
  return chaveDeData(new Date(aconteceEm));
}

/**
 * Monta a grade de `ano`/`mes0` (mês zero-indexado, como `Date`).
 *
 * Os dias são construídos com `Date.UTC` ao meio-dia, e não à meia-noite: ao
 * meio-dia UTC, nenhum fuso do mundo escorrega para o dia anterior ou
 * seguinte, então o número do quadrado nunca diverge da chave. À meia-noite,
 * `2026-08-01T00:00:00Z` já é 31 de julho em São Paulo.
 */
export function gradeDoMes(ano: number, mes0: number): DiaDaGrade[] {
  const primeiro = new Date(Date.UTC(ano, mes0, 1, 12));
  const diaDaSemanaDoPrimeiro = primeiro.getUTCDay();

  // Quantos dias do mês anterior entram para a primeira semana começar no
  // domingo.
  const inicio = new Date(Date.UTC(ano, mes0, 1 - diaDaSemanaDoPrimeiro, 12));

  const dias: DiaDaGrade[] = [];
  const cursor = new Date(inicio);
  // Seis semanas cobrem qualquer mês, inclusive fevereiro começando no sábado
  // e meses de 31 dias começando no sábado. Grade de altura fixa: sem ela, a
  // tela pula de tamanho ao trocar de mês.
  for (let i = 0; i < 42; i++) {
    dias.push({
      chave: chaveDeData(cursor),
      numero: cursor.getUTCDate(),
      doMes: cursor.getUTCMonth() === mes0 && cursor.getUTCFullYear() === ano,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dias;
}

/** Agrupa por dia do app. A ordem dentro de cada dia é a que entrou. */
export function agruparPorDia<T extends { aconteceEm: string }>(
  itens: T[]
): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const item of itens) {
    const chave = diaDaReuniao(item.aconteceEm);
    const lista = mapa.get(chave);
    if (lista) lista.push(item);
    else mapa.set(chave, [item]);
  }
  return mapa;
}

/** "agosto de 2026" — o rótulo do cabeçalho da grade. */
export function rotuloDoMes(ano: number, mes0: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(ano, mes0, 15, 12)));
}

/** "domingo, 30 de agosto" — o cabeçalho da lista do dia escolhido. */
export function rotuloDoDia(chave: string): string {
  // A chave é dia puro, sem hora: fixar meio-dia UTC e formatar em UTC evita
  // que a conversão de fuso mova o dia. Mesmo cuidado de `formatDate` para
  // valores "YYYY-MM-DD" em src/lib/format.ts.
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${chave}T12:00:00Z`));
}

/** O dia de hoje no fuso do app, como chave da grade. */
export function hojeComoChave(agora: Date = new Date()): string {
  return todayInAppTz(agora);
}

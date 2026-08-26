import { APP_TIMEZONE } from "./timezone";

export type ReuniaoParaLista = {
  id: string;
  titulo: string;
  aconteceEm: string;
  duracaoMin: number | null;
  temAta: boolean;
};

/**
 * Uma reunião é "próxima" enquanto não terminou, não enquanto não começou.
 *
 * O corte pelo INÍCIO joga a reunião das 14h para o histórico às 14h01 —
 * exatamente quando ela está acontecendo e é a coisa mais relevante da tela.
 * Quem abre o CRM no meio de uma reunião para anotar a ata a encontraria em
 * "Anteriores", que é onde ninguém procuraria.
 *
 * Sem duração registrada, a reunião conta como terminada no próprio horário:
 * não dá para inventar quanto ela dura, e supor uma hora atrasaria o
 * histórico de toda reunião relâmpago.
 */
export function jaTerminou(
  aconteceEm: string,
  duracaoMin: number | null,
  agora: Date = new Date()
): boolean {
  const inicio = new Date(aconteceEm).getTime();
  const fim = inicio + (duracaoMin ?? 0) * 60_000;
  return fim <= agora.getTime();
}

/**
 * Separa a lista em duas, preservando a ordem que o banco entregou dentro de
 * cada metade.
 *
 * As PRÓXIMAS vão da mais perto para a mais longe — a primeira linha é a
 * próxima coisa a acontecer. As ANTERIORES vão da mais recente para a mais
 * antiga: procurar uma ata começa quase sempre pela última reunião.
 *
 * A consulta pede tudo ordenado por `acontece_em` DESC (é o índice), então as
 * anteriores já chegam certas e as próximas precisam ser invertidas. Fazer
 * duas consultas ordenadas de formas opostas custaria duas idas ao banco para
 * uma tela que cabe inteira numa.
 */
export function separarPorTempo<T extends { aconteceEm: string; duracaoMin: number | null }>(
  reunioes: T[],
  agora: Date = new Date()
): { proximas: T[]; anteriores: T[] } {
  const proximas: T[] = [];
  const anteriores: T[] = [];
  for (const r of reunioes) {
    if (jaTerminou(r.aconteceEm, r.duracaoMin, agora)) anteriores.push(r);
    else proximas.push(r);
  }
  return { proximas: proximas.reverse(), anteriores };
}

/**
 * "qui, 28 ago · 14:00". Um formatador só para as duas listas e a gaveta —
 * `formatDate` (src/lib/format.ts) não serve aqui porque não mostra hora, e
 * reunião sem hora não diz nada.
 *
 * Fuso fixado em `APP_TIMEZONE` pelo mesmo motivo de todo o resto do app: o
 * valor é um instante real, e quem lê está em São Paulo.
 */
export function formatarQuando(aconteceEm: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  })
    .format(new Date(aconteceEm))
    .replace(/\./g, "");
}

/** "45 min", "1h30", "2h". Nulo vira "—" em quem exibe, não aqui. */
export function formatarDuracao(min: number): string {
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  const resto = min % 60;
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`;
}

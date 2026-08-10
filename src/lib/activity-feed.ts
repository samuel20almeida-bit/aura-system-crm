// Módulo puro: sem React, sem DOM, sem Supabase. Roda em Node — é o que
// permite testar a frase e o tempo relativo sem navegador. Um import daqui
// para dentro de código de cliente ou de Server Action deve continuar
// funcionando sem trazer nenhuma dessas dependências.
import { APP_TIMEZONE, todayInAppTz } from "./timezone";

export type ActivityAuthor = { id: string; full_name: string; initials: string } | null;

/** O formato que `getRecentActivity` devolve, por linha. */
export type ActivityRow = {
  id: string;
  verb: string;
  detail: string | null;
  created_at: string;
  user_id: string | null;
  user: ActivityAuthor;
};

export type DescribedActivity = {
  who: string;
  text: string;
  when: string;
};

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/**
 * Quem agiu. `user_id` nulo existe em linhas antigas do banco (autor perdido)
 * e vira "Alguém", nunca string vazia — o mesmo vale se a linha tem `user_id`
 * mas o join com `profiles` não trouxe ninguém (perfil apagado).
 */
function describeWho(row: ActivityRow, currentUserId: string): string {
  if (row.user_id !== null && row.user_id === currentUserId) return "Você";
  if (!row.user) return "Alguém";
  return firstName(row.user.full_name);
}

/** `verb` + `detail`, espaço único, sem sobra quando `detail` é nulo. */
function describeText(row: ActivityRow): string {
  return row.detail ? `${row.verb} ${row.detail}` : row.verb;
}

/** "10 ago" — dia e mês no fuso de operação da Aura, não em UTC cru. */
function formatFullDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: APP_TIMEZONE,
  })
    .format(date)
    .replace(".", "");
}

/**
 * Dias corridos no calendário de São Paulo entre duas datas — não horas
 * decorridas divididas por 24. Uma escrita às 23h55 de ontem, vista às 00h05
 * de hoje, é "ontem": só um dia de calendário separa as duas, mesmo com 10
 * minutos de diferença real. É por isso que a decisão passa pelos helpers de
 * `timezone.ts` em vez de aritmética direta sobre milissegundos.
 */
function calendarDaysBetween(earlier: Date, later: Date): number {
  const [ey, em, ed] = todayInAppTz(earlier).split("-").map(Number);
  const [ly, lm, ld] = todayInAppTz(later).split("-").map(Number);
  return Math.round((Date.UTC(ly, lm - 1, ld) - Date.UTC(ey, em - 1, ed)) / 86_400_000);
}

/**
 * Tempo relativo em pt-BR: "agora", "há N min", "há N h" enquanto o intervalo
 * cabe dentro do mesmo dia de relógio; "ontem", "há N dias" ou a data cheia
 * depois disso, decidido pelo calendário de São Paulo.
 *
 * Recebe `now` explícito (default `new Date()`) para que os testes controlem
 * o instante sem depender do relógio real, e para que o mesmo cálculo sirva
 * tanto ao servidor (que grava o resultado no HTML) quanto ao cliente (que o
 * repete a cada 60s com o próprio relógio).
 */
export function formatActivityWhen(createdAt: string, now: Date = new Date()): string {
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours} h`;

  const dayDiff = calendarDaysBetween(created, now);
  if (dayDiff <= 1) return "ontem";
  if (dayDiff < 7) return `há ${dayDiff} dias`;
  return formatFullDate(created);
}

/**
 * Monta a linha exibida a partir de uma linha crua de `activity_log`. Pura:
 * o mesmo `row` sempre produz o mesmo resultado, dado o mesmo `now`.
 */
export function describeActivity(
  row: ActivityRow,
  currentUserId: string,
  now: Date = new Date()
): DescribedActivity {
  return {
    who: describeWho(row, currentUserId),
    text: describeText(row),
    when: formatActivityWhen(row.created_at, now),
  };
}

// Aura Studio operates out of Brazil. America/Sao_Paulo has used a fixed
// UTC-3 offset with no daylight saving since 2019 — a hardcoded offset is
// accurate today and simpler than pulling in full IANA tz data. If Brazil
// ever reinstates DST, this constant is the one place to update.
const OFFSET_MINUTES = -180;
export const APP_TIMEZONE = "America/Sao_Paulo";

/** A Date whose UTC-based getters/setters reflect America/Sao_Paulo wall-clock time. */
function shiftToAppTz(date: Date): Date {
  return new Date(date.getTime() + OFFSET_MINUTES * 60000);
}

function shiftFromAppTz(date: Date): Date {
  return new Date(date.getTime() - OFFSET_MINUTES * 60000);
}

/**
 * Calendar date in America/Sao_Paulo, as "YYYY-MM-DD", for `date` (default:
 * now). Parameterized so callers can ask "what day was this instant, in our
 * timezone" — not just "what day is it now" — without reaching for a raw
 * `new Date()` of their own.
 */
export function todayInAppTz(date: Date = new Date()): string {
  const d = shiftToAppTz(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

/**
 * Adds whole days to a plain calendar date ("YYYY-MM-DD") and returns another
 * plain calendar date. No clock and no offset involved: comparing due dates has
 * to stay on the calendar. `new Date(dueDate).getTime()` reads the string as
 * midnight UTC, which is 21h of the previous day in São Paulo — the very
 * contradiction Task 9 removed from TaskCard and TaskQuickItem.
 */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Start of the ISO week (Monday) containing `date`, in America/Sao_Paulo, as a real UTC instant. */
export function startOfWeekInAppTz(date: Date = new Date()): Date {
  const d = shiftToAppTz(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return shiftFromAppTz(d);
}

/** Real UTC instant for the 1st of `year`-`month0` (0-indexed) at midnight, America/Sao_Paulo. */
export function monthStartInAppTz(year: number, month0: number): Date {
  return shiftFromAppTz(new Date(Date.UTC(year, month0, 1)));
}

/** Start of the calendar month containing `date` (optionally offset by whole months), in America/Sao_Paulo. */
export function startOfMonthInAppTz(date: Date = new Date(), monthOffset = 0): Date {
  const d = shiftToAppTz(date);
  return monthStartInAppTz(d.getUTCFullYear(), d.getUTCMonth() + monthOffset);
}

/** {year, month0 (0-indexed)} for `date`'s calendar day in America/Sao_Paulo. */
export function yearMonthInAppTz(date: Date = new Date()): { year: number; month0: number } {
  const d = shiftToAppTz(date);
  return { year: d.getUTCFullYear(), month0: d.getUTCMonth() };
}

export function currentQuarterInAppTz(date: Date = new Date()): string {
  const d = shiftToAppTz(date);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
}

/** Current wall-clock hour (0-23) in America/Sao_Paulo — for time-of-day greetings etc. */
export function currentHourInAppTz(date: Date = new Date()): number {
  return shiftToAppTz(date).getUTCHours();
}

/** ISO-8601 week number (1-53) for `date`'s calendar day in America/Sao_Paulo. */
export function isoWeekInAppTz(date: Date = new Date()): number {
  const zoned = shiftToAppTz(date);
  const d = new Date(Date.UTC(zoned.getUTCFullYear(), zoned.getUTCMonth(), zoned.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function quarterRangeInAppTz(quarter: string): { start: Date; end: Date } {
  const [yearStr, qStr] = quarter.split("-Q");
  const year = Number(yearStr);
  const q = Number(qStr);
  const startMonth = (q - 1) * 3;
  return {
    start: shiftFromAppTz(new Date(Date.UTC(year, startMonth, 1))),
    end: shiftFromAppTz(new Date(Date.UTC(year, startMonth + 3, 1))),
  };
}

/**
 * Dias de CALENDÁRIO entre duas datas, contados em São Paulo — não horas
 * corridas divididas por 24. 23h de ontem para 1h de hoje é 1 dia, não 0.
 *
 * Vive aqui, e não dentro de quem usa, porque dois módulos já precisam dela
 * (o tempo relativo da atividade e a saúde do negócio) e duas implementações
 * do mesmo cálculo divergem — foi o que aconteceu com os dois formatadores de
 * tempo relativo na Fase 2.
 */
export function calendarDaysBetweenInAppTz(earlier: Date, later: Date): number {
  const [ey, em, ed] = todayInAppTz(earlier).split("-").map(Number);
  const [ly, lm, ld] = todayInAppTz(later).split("-").map(Number);
  return Math.round((Date.UTC(ly, lm - 1, ld) - Date.UTC(ey, em - 1, ed)) / 86_400_000);
}

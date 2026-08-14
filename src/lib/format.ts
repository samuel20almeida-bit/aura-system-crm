import { APP_TIMEZONE, todayInAppTz } from "./timezone";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyCompact(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })}k`;
  }
  return formatCurrency(value);
}

export function formatDate(value: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const isDateOnly = typeof value === "string" && value.length === 10;
  const date = typeof value === "string" ? new Date(value + (isDateOnly ? "T12:00:00Z" : "")) : value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    // Date-only values (e.g. due_date) have no real timezone — pin to noon UTC above and skip
    // zone conversion here so the calendar day never shifts. Timestamps (created_at etc.) are
    // real instants, so display them in the timezone Aura actually operates in.
    timeZone: isDateOnly ? "UTC" : APP_TIMEZONE,
    ...opts,
  }).format(date).replace(".", "");
}

export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return `${hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

// `formatRelative` vivia aqui e foi removida: era um segundo formatador
// relativo sobre o mesmo dado de `activity_log` que o painel da /início já
// formata, com texto divergente ("há 3h" contra "há 3 h") e contando os dias
// por horas corridas a partir de um `Date.now()` cru, sem passar pelo fuso.
// O formatador que ficou é `formatActivityWhen`, em `src/lib/activity-feed.ts`.

export function daysUntil(dateStr: string): number {
  const [ty, tm, td] = todayInAppTz().split("-").map(Number);
  const [dy, dm, dd] = dateStr.split("-").map(Number);
  const todayUtcMs = Date.UTC(ty, tm - 1, td);
  const targetUtcMs = Date.UTC(dy, dm - 1, dd);
  return Math.round((targetUtcMs - todayUtcMs) / 86400000);
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function slugPrefix(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z ]/g, "").trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return (parts[0].slice(0, 2) + parts[1][0]).toUpperCase();
}

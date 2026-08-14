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

/**
 * `verb` e `detail` viajam SEPARADOS de propósito. Colapsá-los numa string só
 * tira de quem desenha a linha a chance de destacar o detalhe — que é a parte
 * que o olho procura ("moveu Finalizar o CRM para **Em andamento**"). Juntar as
 * duas é trabalho de uma linha para o componente; separar de novo, depois de
 * concatenadas, é impossível sem adivinhar onde uma acaba.
 */
export type DescribedActivity = {
  who: string;
  verb: string;
  /** Nulo quando a linha não tem detalhe — o componente não desenha nada. */
  detail: string | null;
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

/**
 * "03 de ago" para o ano corrente, "03 de ago de 2025" para qualquer outro —
 * sempre no fuso de operação da Aura, não em UTC cru. O ano só aparece quando
 * muda porque, sem ele, uma linha de 370 dias atrás sai idêntica a uma de 5
 * dias: as duas viram "05 de ago" e não há como distinguir.
 */
function formatFullDate(date: Date, now: Date): string {
  const mesmoAno = todayInAppTz(date).slice(0, 4) === todayInAppTz(now).slice(0, 4);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    ...(mesmoAno ? {} : { year: "numeric" }),
    timeZone: APP_TIMEZONE,
  })
    .format(date)
    .replace(".", "");
}

/**
 * Dias de calendário em São Paulo entre duas datas — não horas decorridas
 * divididas por 24. Só quem chega aqui já passou de 24 h corridas (abaixo
 * disso o texto é "há N h"), então a diferença que este cálculo faz é sobre a
 * fronteira do dia: 26 h atrás pode ser "ontem" ou "há 2 dias" conforme a hora
 * do relógio de São Paulo, e é por isso que a decisão passa pelos helpers de
 * `timezone.ts` em vez de aritmética direta sobre milissegundos.
 */
function calendarDaysBetween(earlier: Date, later: Date): number {
  const [ey, em, ed] = todayInAppTz(earlier).split("-").map(Number);
  const [ly, lm, ld] = todayInAppTz(later).split("-").map(Number);
  return Math.round((Date.UTC(ly, lm - 1, ld) - Date.UTC(ey, em - 1, ed)) / 86_400_000);
}

/**
 * Tempo relativo em pt-BR: "agora", "há N min" e "há N h" nas primeiras 24 h
 * corridas; passado isso, "ontem", "há N dias" ou a data cheia, decidido pelo
 * calendário de São Paulo.
 *
 * É o único formatador relativo do sistema — a aba Histórico da tarefa mostra
 * as MESMAS linhas de `activity_log` que o painel da /início, e um segundo
 * formatador significava dois textos para o mesmo dado ("há 3 h" contra
 * "há 3h"), um deles ignorando o fuso.
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
  return formatFullDate(created, now);
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
    verb: row.verb,
    detail: row.detail,
    when: formatActivityWhen(row.created_at, now),
  };
}

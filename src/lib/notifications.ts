import { formatCurrency, formatDate } from "./format";
import { isInvoiceOverdue } from "./invoices";

export type AppNotification = {
  id: string;
  tone: "red" | "amber" | "neutral";
  title: string;
  detail: string;
  /** `null` quando o aviso não leva a lugar nenhum (ex.: falha ao consultar). */
  href: string | null;
};

export type NotificationInput = {
  /** Faturas não pagas — o atraso é derivado aqui, não pelo status guardado. */
  openInvoices: {
    id: string;
    clientId: string;
    clientName: string;
    amount: number;
    dueDate: string;
    status: string;
  }[];
  myOpenTasks: { id: string; title: string; dueDate: string | null }[];
  endingContracts: { id: string; clientId: string; clientName: string; endDate: string }[];
};

/**
 * Frase e cores do sino. Até a Task 5 da Fase 3A, o card "PRECISA DE VOCÊ" da
 * /início lia da mesma lista — enquanto tinham escopos diferentes, a /início
 * podia dizer "Tudo em dia por aqui." com seis tarefas atrasadas no sino, um
 * centímetro acima. O card saiu; `/hoje` é agora o lugar único para negócio +
 * tarefa, e o sino aponta pra lá. A frase e as cores continuam aqui porque o
 * sino ainda é a segunda apresentação de faturas/contratos/tarefas.
 */
export const ALL_CLEAR = "Tudo em dia por aqui.";

export const TONE_BG: Record<AppNotification["tone"], string> = {
  red: "bg-red",
  amber: "bg-amber",
  neutral: "bg-faint",
};

const TONE_ORDER: Record<AppNotification["tone"], number> = { red: 0, amber: 1, neutral: 2 };

export function buildNotifications(input: NotificationInput, today: string): AppNotification[] {
  const out: AppNotification[] = [];

  for (const invoice of input.openInvoices) {
    if (!isInvoiceOverdue(invoice.status, invoice.dueDate, today)) continue;
    out.push({
      id: `fatura-${invoice.id}`,
      tone: "red",
      title: `${invoice.clientName} · fatura vencida`,
      detail: `${formatCurrency(invoice.amount)} · venceu em ${formatDate(invoice.dueDate)}`,
      href: `/crm/${invoice.clientId}`,
    });
  }

  for (const task of input.myOpenTasks) {
    if (!task.dueDate) continue;
    if (task.dueDate < today) {
      out.push({
        id: `tarefa-${task.id}`,
        tone: "red",
        title: task.title,
        detail: "Atrasada",
        href: `/kanban?task=${task.id}`,
      });
    } else if (task.dueDate === today) {
      out.push({
        id: `tarefa-${task.id}`,
        tone: "amber",
        title: task.title,
        detail: "Vence hoje",
        href: `/kanban?task=${task.id}`,
      });
    }
  }

  for (const contract of input.endingContracts) {
    out.push({
      id: `contrato-${contract.id}`,
      tone: "neutral",
      title: `Contrato ${contract.clientName} termina em breve`,
      detail: `Até ${formatDate(contract.endDate)}`,
      href: `/crm/${contract.clientId}`,
    });
  }

  // Ordena por urgência (vermelho → âmbar → neutro). `sort` é estável, então a
  // ordem dentro de cada tom continua sendo a das queries (por data de vencimento).
  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

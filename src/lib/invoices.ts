/**
 * Regra única de "fatura vencida". Desde a Task 6 da Fase 3A (CRM antigo
 * aposentado, sem tela), o único consumidor é o sino de avisos
 * (`src/lib/data/notifications.ts`) — o contador da navegação parou de usar
 * esta função, e não há mais nenhuma tela exibindo a coluna de status.
 *
 * Nada no sistema promove `pending` para `overdue` quando a data passa — não há
 * trigger, cron nem Server Action. Por isso o atraso é sempre derivado da data
 * de vencimento, nunca do status guardado (que só serve para ANTECIPAR o
 * alerta: uma fatura marcada como atrasada antes do vencimento continua
 * valendo).
 */
export function isInvoiceOverdue(status: string, dueDate: string, today: string): boolean {
  if (status === "paid") return false;
  return status === "overdue" || dueDate < today;
}

/** Status que podem gerar alerta de atraso — tudo que não foi pago. */
export const UNPAID_INVOICE_STATUSES = ["pending", "overdue"] as const;

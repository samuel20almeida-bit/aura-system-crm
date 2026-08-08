/**
 * Regra única de "fatura vencida", compartilhada pelo sino de avisos, pelo
 * contador da navegação, pelo card "PRECISA DE VOCÊ" da /início e pelos KPIs
 * do CRM.
 *
 * Nada no sistema promove `pending` para `overdue` quando a data passa — não há
 * trigger, cron nem Server Action. O status guardado só muda quando um humano
 * escolhe "Atrasada" no CRM. Por isso o atraso é derivado da data de
 * vencimento, e o status marcado à mão só serve para ANTECIPAR o alerta (uma
 * fatura marcada como atrasada antes do vencimento continua valendo).
 *
 * A coluna de status exibida na tabela do CRM continua mostrando o valor
 * guardado: uma coisa é o que o usuário marcou, outra é o que o sistema alerta.
 */
export function isInvoiceOverdue(status: string, dueDate: string, today: string): boolean {
  if (status === "paid") return false;
  return status === "overdue" || dueDate < today;
}

/** Status que podem gerar alerta de atraso — tudo que não foi pago. */
export const UNPAID_INVOICE_STATUSES = ["pending", "overdue"] as const;

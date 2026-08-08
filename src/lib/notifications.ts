export type AppNotification = {
  id: string;
  tone: "red" | "amber" | "neutral";
  title: string;
  detail: string;
  href: string;
};

export type NotificationInput = {
  overdueInvoices: { id: string; clientId: string; clientName: string; amount: number; dueDate: string }[];
  myOpenTasks: { id: string; title: string; dueDate: string | null }[];
  endingContracts: { id: string; clientId: string; clientName: string; endDate: string }[];
  runningTimerStartedAt: string | null;
};

const EIGHT_HOURS_MS = 8 * 3600 * 1000;

function currency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

export function buildNotifications(input: NotificationInput, today: string): AppNotification[] {
  const out: AppNotification[] = [];

  for (const invoice of input.overdueInvoices) {
    out.push({
      id: `fatura-${invoice.id}`,
      tone: "red",
      title: `${invoice.clientName} · fatura vencida`,
      detail: `${currency(invoice.amount)} · venceu em ${invoice.dueDate}`,
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
      detail: `Até ${contract.endDate}`,
      href: `/crm/${contract.clientId}`,
    });
  }

  if (input.runningTimerStartedAt) {
    const elapsed = Date.now() - new Date(input.runningTimerStartedAt).getTime();
    if (elapsed > EIGHT_HOURS_MS) {
      out.push({
        id: "timer-esquecido",
        tone: "amber",
        title: "Timer rodando há mais de 8 horas",
        detail: "Provavelmente esquecido — confira antes que distorça a rentabilidade",
        href: "/horas",
      });
    }
  }

  return out;
}

export type AppNotification = {
  id: string;
  tone: "red" | "amber" | "neutral";
  title: string;
  detail: string;
  /** `null` quando o aviso não leva a lugar nenhum (ex.: falha ao consultar). */
  href: string | null;
};

export type NotificationInput = {
  myOpenTasks: { id: string; title: string; dueDate: string | null }[];
};

/**
 * Frase e cores do sino. Até a Task 1 da Fase 5F, o sino também consultava
 * `invoices` e `contracts` — tabelas que nenhuma tela alimenta desde que o CRM
 * antigo saiu, e cujos avisos já nasciam com `href: null` porque a tela de
 * destino não existe. Tarefa é a fonte única agora; a frase e as cores
 * continuam aqui porque o sino ainda é a segunda apresentação da tarefa,
 * depois de `/hoje`.
 */
export const ALL_CLEAR = "Tudo em dia por aqui.";

export const TONE_BG: Record<AppNotification["tone"], string> = {
  red: "bg-red",
  amber: "bg-amber",
  neutral: "bg-faint",
};

// `neutral` não é mais produzido por `buildNotifications`, mas fica no vocabulário: `TONE_BG` é a paleta do sino e a 5A vai mexer nela.
const TONE_ORDER: Record<AppNotification["tone"], number> = { red: 0, amber: 1, neutral: 2 };

export function buildNotifications(input: NotificationInput, today: string): AppNotification[] {
  const out: AppNotification[] = [];

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

  // Ordena por urgência (vermelho → âmbar → neutro). `sort` é estável, então a
  // ordem dentro de cada tom continua sendo a da query (por data de vencimento).
  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

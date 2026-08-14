import { calendarDaysBetweenInAppTz, todayInAppTz } from "./timezone";

/**
 * A regra que dá razão de existir ao CRM.
 *
 * O jeito de perder venda numa operação de dois sócios não é perder para o
 * concorrente — é **esquecer**. Um negócio sem próximo passo definido, ou parado
 * há tempo demais, é uma venda que já começou a morrer e ninguém percebeu.
 *
 * Vem do protótipo do Samuel, onde a condição é a assinatura visual da tela: o
 * ponto que pulsa em vermelho. Aqui ela é função pura, testada, e **derivada da
 * data** — nunca de um status que alguém precisa lembrar de marcar. É a mesma
 * disciplina de `isInvoiceOverdue` (`src/lib/invoices.ts`), e pelo mesmo motivo:
 * na Fase 1 a fatura vencida dependia de marcação manual e o sino dizia "tudo em
 * dia" com uma fatura 24 dias vencida.
 */
export type SaudeNegocio = "ok" | "atencao" | "podre";

/** Parado além disto, o negócio apodrece. Do protótipo: `d.dias > 7`. */
export const DIAS_ATE_PODRE = 7;
/** Parado além disto, ainda não é podre, mas já pede atenção. Do protótipo: `d.dias > 4`. */
export const DIAS_ATE_ATENCAO = 4;

export type NegocioParaSaude = {
  /** O que foi combinado como próximo movimento. Vazio ou nulo é o pior estado. */
  proximoPasso: string | null;
  /** Quando o próximo passo vence, em "YYYY-MM-DD". Nulo = passo sem data. */
  proximoPassoEm: string | null;
  /** Última vez que alguém mexeu no negócio, em ISO. É o relógio do apodrecimento. */
  mexidoEm: string;
};

/**
 * `agora` é o único parâmetro de tempo de propósito: derivar "hoje" dele aqui
 * dentro torna impossível chamar a função com um "hoje" que não corresponde ao
 * instante — que é o tipo de inconsistência que já produziu defeito neste
 * projeto quando duas fontes de tempo conviviam.
 */
export function saudeDoNegocio(negocio: NegocioParaSaude, agora: Date = new Date()): SaudeNegocio {
  // Sem próximo passo é podre na hora, sem olhar data nenhuma: não existe
  // "recém-mexido" que compense não saber qual é o movimento seguinte.
  if (!negocio.proximoPasso || negocio.proximoPasso.trim() === "") return "podre";

  const hoje = todayInAppTz(agora);

  // Passo vencido é passo que não aconteceu. Vencer HOJE ainda é ok — o dia não
  // acabou. Comparação de strings "YYYY-MM-DD" é segura e evita o fuso: às 23h
  // de São Paulo o UTC já virou o dia seguinte, e uma conta feita em UTC diria
  // que o passo de hoje venceu ontem.
  if (negocio.proximoPassoEm && negocio.proximoPassoEm < hoje) return "podre";

  const mexido = new Date(negocio.mexidoEm);
  // Data ilegível não pode ser confundida com "recém-mexido": no escuro, o
  // estado honesto é o que pede olhar.
  if (Number.isNaN(mexido.getTime())) return "podre";

  const diasParado = calendarDaysBetweenInAppTz(mexido, agora);
  if (diasParado > DIAS_ATE_PODRE) return "podre";
  if (diasParado > DIAS_ATE_ATENCAO) return "atencao";
  return "ok";
}

/** Quantos dias de calendário o negócio está parado — o "3d" do cartão. */
export function diasParado(mexidoEm: string, agora: Date = new Date()): number {
  const mexido = new Date(mexidoEm);
  if (Number.isNaN(mexido.getTime())) return 0;
  return Math.max(0, calendarDaysBetweenInAppTz(mexido, agora));
}

/**
 * O rótulo de vencimento do próximo passo, como no protótipo:
 * "atrasado 2d" · "hoje" · "amanhã" · "em 4d".
 */
export function rotuloVencimento(proximoPassoEm: string | null, agora: Date = new Date()): string | null {
  if (!proximoPassoEm) return null;
  const [y, m, d] = proximoPassoEm.split("-").map(Number);
  if (!y || !m || !d) return null;
  const [hy, hm, hd] = todayInAppTz(agora).split("-").map(Number);
  const dias = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd)) / 86_400_000);
  if (dias < 0) return `atrasado ${Math.abs(dias)}d`;
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  return `em ${dias}d`;
}

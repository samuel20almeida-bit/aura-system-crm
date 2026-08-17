import { saudeDaTarefa, type SaudeNegocio } from "./negocios";
import { addDaysToDateStr, todayInAppTz } from "./timezone";

export type EtapaEspera = "nos" | "cliente";

/**
 * A data em que o SLA da etapa atual vence, como "YYYY-MM-DD" — a mesma
 * forma de `proximo_passo_em`/`due_date`, para reusar `saudeDaTarefa` sem
 * adaptar a assinatura dela.
 */
export function vencimentoDaEtapa(etapaDesde: string, slaDias: number): string {
  return addDaysToDateStr(todayInAppTz(new Date(etapaDesde)), slaDias);
}

/**
 * Mesmo vocabulário de saúde do resto do sistema, calculado com a MESMA
 * regra de tarefa vencida (`saudeDaTarefa`) — a etapa também é "algo com
 * prazo", não uma família de regra nova.
 *
 * A única diferença: duas das seis etapas esperam o CLIENTE, não a gente
 * (`implantacao_etapas.espera`). Decisão registrada no spec da Fase 3: o
 * mesmo vermelho pulsando para as duas famílias faz o alerta perder valor
 * quando o atraso não é culpa nossa. Aqui o teto para `espera: "cliente"`
 * é "atencao" — nunca "podre".
 */
export function saudeDaImplantacao(
  vencimento: string,
  espera: EtapaEspera,
  agora: Date = new Date()
): SaudeNegocio {
  const saude = saudeDaTarefa(vencimento, agora);
  if (espera === "cliente" && saude === "podre") return "atencao";
  return saude;
}

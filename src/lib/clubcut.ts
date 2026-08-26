/**
 * A ponte com o ClubCut, em duas metades puras: o que CHEGA (validação do
 * envio diário do n8n) e o que a TELA LÊ (derivações sobre a janela de dias).
 *
 * Nenhuma das duas toca banco nem rede, e é de propósito: a rota de
 * sincronização é a única coisa do sistema que aceita escrita sem sessão de
 * usuário, então a regra que decide se um envio é válido precisa ser
 * testável sozinha, sem subir servidor.
 */

import { calendarDaysBetweenInAppTz } from "./timezone";

// ============================================================
// 1. O QUE CHEGA
// ============================================================

export type SalaoRecebido = {
  salon_id: string;
  nome: string;
  ativo: boolean;
};

export type UsoRecebido = {
  salon_id: string;
  dia: string;
  barbeiros: number;
  conversas: number;
  mensagens: number;
  agendamentos_agente: number;
  agendamentos_total: number;
  valor_gerado: number;
  custo_ia_usd: number | null;
  execucoes_erro: number;
};

export type Envio = { saloes: SalaoRecebido[]; uso: UsoRecebido[] };

/**
 * Tetos por envio. Não são performance: são o limite entre "o n8n mandou a
 * janela de ontem" e "alguém mandou um arquivo". Um envio diário de todos os
 * clientes cabe com folga em 200 salões × 90 dias.
 */
export const MAX_SALOES = 200;
export const MAX_USO = 18_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Data de calendário de verdade, não só o formato. `2026-02-30` casa com a
 * expressão e não existe; deixá-la passar viraria uma linha de uso num dia
 * que o Postgres recusa, e o erro apareceria como 500 em vez de 400.
 */
function diaValido(dia: string): boolean {
  if (!DIA.test(dia)) return false;
  const d = new Date(dia + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === dia;
}

function inteiroNaoNegativo(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function numeroNaoNegativo(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

const CONTADORES = [
  "barbeiros",
  "conversas",
  "mensagens",
  "agendamentos_agente",
  "agendamentos_total",
  "execucoes_erro",
] as const;

export function lerEnvio(bruto: unknown): { ok: true; envio: Envio } | { ok: false; erro: string } {
  if (!ehObjeto(bruto)) return { ok: false, erro: "o corpo precisa ser um objeto JSON" };
  if (!Array.isArray(bruto.saloes)) return { ok: false, erro: "`saloes` precisa ser uma lista" };
  if (!Array.isArray(bruto.uso)) return { ok: false, erro: "`uso` precisa ser uma lista" };
  if (bruto.saloes.length > MAX_SALOES) return { ok: false, erro: `no máximo ${MAX_SALOES} salões por envio` };
  if (bruto.uso.length > MAX_USO) return { ok: false, erro: `no máximo ${MAX_USO} linhas de uso por envio` };

  const saloes: SalaoRecebido[] = [];
  const conhecidos = new Set<string>();

  for (const [i, linha] of bruto.saloes.entries()) {
    if (!ehObjeto(linha)) return { ok: false, erro: `salões[${i}]: não é um objeto` };
    const { salon_id, nome, ativo } = linha;
    if (typeof salon_id !== "string" || !UUID.test(salon_id)) {
      return { ok: false, erro: `salões[${i}]: \`salon_id\` não é um uuid` };
    }
    if (typeof nome !== "string" || nome.trim() === "") {
      return { ok: false, erro: `salões[${i}]: \`nome\` vazio` };
    }
    if (ativo !== undefined && typeof ativo !== "boolean") {
      return { ok: false, erro: `salões[${i}]: \`ativo\` não é booleano` };
    }
    // Salão repetido no mesmo envio faria dois upserts na mesma chave dentro
    // de uma requisição só — o PostgREST recusa, e a mensagem dele não diz
    // qual linha. Recusar aqui diz.
    if (conhecidos.has(salon_id)) return { ok: false, erro: `salão repetido no envio: ${salon_id}` };
    conhecidos.add(salon_id);
    saloes.push({ salon_id, nome: nome.trim(), ativo: ativo ?? true });
  }

  const uso: UsoRecebido[] = [];
  const vistos = new Set<string>();

  for (const [i, linha] of bruto.uso.entries()) {
    if (!ehObjeto(linha)) return { ok: false, erro: `uso[${i}]: não é um objeto` };
    const { salon_id, dia, valor_gerado, custo_ia_usd } = linha;

    if (typeof salon_id !== "string" || !UUID.test(salon_id)) {
      return { ok: false, erro: `uso[${i}]: \`salon_id\` não é um uuid` };
    }
    // A chave estrangeira já garantiria isto, mas com um 500 e uma mensagem
    // do Postgres. Recusar antes devolve 400 dizendo qual salão faltou.
    if (!conhecidos.has(salon_id)) {
      return { ok: false, erro: `uso[${i}]: salão ${salon_id} não veio em \`saloes\`` };
    }
    if (typeof dia !== "string" || !diaValido(dia)) {
      return { ok: false, erro: `uso[${i}]: \`dia\` precisa ser uma data AAAA-MM-DD` };
    }
    const chave = `${salon_id}|${dia}`;
    if (vistos.has(chave)) return { ok: false, erro: `uso[${i}]: ${dia} repetido para o mesmo salão` };
    vistos.add(chave);

    const contadores: Record<string, number> = {};
    for (const campo of CONTADORES) {
      const v = linha[campo];
      if (!inteiroNaoNegativo(v)) {
        return { ok: false, erro: `uso[${i}]: \`${campo}\` precisa ser inteiro ≥ 0` };
      }
      contadores[campo] = v;
    }
    if (contadores.agendamentos_agente > contadores.agendamentos_total) {
      return { ok: false, erro: `uso[${i}]: agendamentos do agente não podem passar do total` };
    }
    if (!numeroNaoNegativo(valor_gerado)) {
      return { ok: false, erro: `uso[${i}]: \`valor_gerado\` precisa ser um número ≥ 0` };
    }
    // Nulo é resposta legítima e é a esperada hoje: o ClubCut ainda não mede
    // custo de IA. Ausente vale nulo — o n8n não precisa mandar a chave para
    // dizer "não sei".
    if (custo_ia_usd !== undefined && custo_ia_usd !== null && !numeroNaoNegativo(custo_ia_usd)) {
      return { ok: false, erro: `uso[${i}]: \`custo_ia_usd\` precisa ser um número ≥ 0 ou nulo` };
    }

    uso.push({
      salon_id,
      dia,
      barbeiros: contadores.barbeiros,
      conversas: contadores.conversas,
      mensagens: contadores.mensagens,
      agendamentos_agente: contadores.agendamentos_agente,
      agendamentos_total: contadores.agendamentos_total,
      valor_gerado,
      custo_ia_usd: custo_ia_usd ?? null,
      execucoes_erro: contadores.execucoes_erro,
    });
  }

  return { ok: true, envio: { saloes, uso } };
}

// ============================================================
// 2. O QUE A TELA LÊ
// ============================================================

export type LinhaDeUso = {
  salon_id: string;
  dia: string;
  barbeiros: number;
  conversas: number;
  mensagens: number;
  agendamentos_agente: number;
  agendamentos_total: number;
  valor_gerado: number;
  custo_ia_usd: number | null;
  execucoes_erro: number;
};

export type ResumoDoSalao = {
  salonId: string;
  /** Dias da janela que têm linha. Menos que a janela = sincronizador falhou em algum dia. */
  dias: number;
  ultimoDia: string | null;
  /**
   * O do dia mais recente, NÃO a soma. `barbeiros` é uma fotografia diária:
   * somar 30 dias de uma barbearia de 3 cadeiras daria 90 barbeiros, e a
   * faixa de preço passaria da primeira para a última.
   */
  barbeiros: number;
  conversas: number;
  mensagens: number;
  agendamentosAgente: number;
  agendamentosTotal: number;
  valorGerado: number;
  execucoesErro: number;
  /** Soma dos dias medidos. Nulo quando nenhum dia mediu — nunca zero. */
  custoIaUsd: number | null;
  /** Quantos dias da janela têm custo. Menor que `dias` = medição parcial. */
  diasComCusto: number;
};

/**
 * Agrupa a janela por salão. Recebe as linhas em qualquer ordem: quem decide
 * qual é o dia mais recente é a comparação de string ("2026-08-09" <
 * "2026-08-10" é verdade em ISO), não a ordem de chegada.
 */
export function resumirPorSalao(linhas: LinhaDeUso[]): Map<string, ResumoDoSalao> {
  const porSalao = new Map<string, ResumoDoSalao>();

  for (const l of linhas) {
    let r = porSalao.get(l.salon_id);
    if (!r) {
      r = {
        salonId: l.salon_id,
        dias: 0,
        ultimoDia: null,
        barbeiros: 0,
        conversas: 0,
        mensagens: 0,
        agendamentosAgente: 0,
        agendamentosTotal: 0,
        valorGerado: 0,
        execucoesErro: 0,
        custoIaUsd: null,
        diasComCusto: 0,
      };
      porSalao.set(l.salon_id, r);
    }

    r.dias += 1;
    r.conversas += l.conversas;
    r.mensagens += l.mensagens;
    r.agendamentosAgente += l.agendamentos_agente;
    r.agendamentosTotal += l.agendamentos_total;
    r.valorGerado += l.valor_gerado;
    r.execucoesErro += l.execucoes_erro;

    if (l.custo_ia_usd !== null) {
      r.custoIaUsd = (r.custoIaUsd ?? 0) + l.custo_ia_usd;
      r.diasComCusto += 1;
    }

    if (r.ultimoDia === null || l.dia > r.ultimoDia) {
      r.ultimoDia = l.dia;
      r.barbeiros = l.barbeiros;
    }
  }

  return porSalao;
}

/**
 * Quanto da operação passa pelo agente. Nulo quando não houve agendamento
 * nenhum na janela: 0/0 não é "0% de participação", é "não deu para saber", e
 * mostrar 0% acusaria o agente de um fracasso que não aconteceu.
 */
export function participacaoDoAgente(r: ResumoDoSalao): number | null {
  if (r.agendamentosTotal === 0) return null;
  return r.agendamentosAgente / r.agendamentosTotal;
}

export type Frescor = { dias: number; estado: "ok" | "atrasado" | "parado" };

/**
 * Há quanto tempo este salão foi sincronizado.
 *
 * Existe porque a falha silenciosa desta tela é sempre a mesma: o
 * sincronizador para, os números congelam, e um cliente parado fica
 * indistinguível de um cliente que não usa. "Parado" é a partir de uma
 * semana — abaixo disso um feriado ou uma falha isolada explicam.
 */
export function frescor(sincronizadoEm: string | null, agora: Date = new Date()): Frescor | null {
  if (!sincronizadoEm) return null;
  const quando = new Date(sincronizadoEm);
  if (Number.isNaN(quando.getTime())) return null;
  const dias = Math.max(0, calendarDaysBetweenInAppTz(quando, agora));
  return { dias, estado: dias <= 1 ? "ok" : dias < 7 ? "atrasado" : "parado" };
}

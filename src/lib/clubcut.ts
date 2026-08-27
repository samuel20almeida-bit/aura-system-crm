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

export type AssinaturaRecebida = {
  salon_id: string;
  plano: string | null;
  status: string;
  valor: number | null;
  proximo_vencimento: string | null;
  acesso_ate: string | null;
};

export type FaturaRecebida = {
  salon_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  motivo: string;
  valor: number;
  valor_gerado: number;
  agendamentos: number;
  vencimento: string | null;
  paga_em: string | null;
};

/**
 * `assinaturas` e `faturas` são OPCIONAIS. O workflow que só manda uso
 * continua válido — sem isso, publicar a rota nova quebraria o envio antigo
 * no intervalo entre um deploy e o outro.
 */
export type Envio = {
  saloes: SalaoRecebido[];
  uso: UsoRecebido[];
  assinaturas: AssinaturaRecebida[];
  faturas: FaturaRecebida[];
};

/**
 * Tetos por envio. Não são performance: são o limite entre "o n8n mandou a
 * janela de ontem" e "alguém mandou um arquivo". Um envio diário de todos os
 * clientes cabe com folga em 200 salões × 90 dias.
 */
export const MAX_SALOES = 200;
export const MAX_USO = 18_000;
export const MAX_FATURAS = 5_000;

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

/**
 * Data de calendário que pode não vir. Devolve a sentinela `INVALIDA` em vez
 * de `null` porque nulo aqui é resposta legítima ("assinatura em teste não
 * tem próximo vencimento") — usar nulo para as duas coisas engoliria um
 * campo mal formado em silêncio.
 */
const INVALIDA = Symbol("data inválida");

function dataOpcional(v: unknown): string | null | typeof INVALIDA {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || !diaValido(v)) return INVALIDA;
  return v;
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

  // ---- assinaturas (opcional) ----
  const assinaturas: AssinaturaRecebida[] = [];
  if (bruto.assinaturas !== undefined) {
    if (!Array.isArray(bruto.assinaturas)) {
      return { ok: false, erro: "`assinaturas` precisa ser uma lista" };
    }
    if (bruto.assinaturas.length > MAX_SALOES) {
      return { ok: false, erro: `no máximo ${MAX_SALOES} assinaturas por envio` };
    }
    const jaVistas = new Set<string>();
    for (const [i, linha] of bruto.assinaturas.entries()) {
      if (!ehObjeto(linha)) return { ok: false, erro: `assinaturas[${i}]: não é um objeto` };
      const { salon_id, plano, status, valor, proximo_vencimento, acesso_ate } = linha;
      if (typeof salon_id !== "string" || !conhecidos.has(salon_id)) {
        return { ok: false, erro: `assinaturas[${i}]: salão desconhecido` };
      }
      // Uma por salão — é a chave primária deste lado, e o ClubCut tem
      // `unique (salon_id)` no dele.
      if (jaVistas.has(salon_id)) {
        return { ok: false, erro: `assinaturas[${i}]: salão repetido` };
      }
      jaVistas.add(salon_id);
      if (typeof status !== "string" || status.trim() === "") {
        return { ok: false, erro: `assinaturas[${i}]: \`status\` vazio` };
      }
      if (plano !== undefined && plano !== null && typeof plano !== "string") {
        return { ok: false, erro: `assinaturas[${i}]: \`plano\` não é texto` };
      }
      if (valor !== undefined && valor !== null && !numeroNaoNegativo(valor)) {
        return { ok: false, erro: `assinaturas[${i}]: \`valor\` precisa ser um número ≥ 0 ou nulo` };
      }
      const venc = dataOpcional(proximo_vencimento);
      if (venc === INVALIDA) {
        return { ok: false, erro: `assinaturas[${i}]: \`proximo_vencimento\` não é uma data` };
      }
      const ate = dataOpcional(acesso_ate);
      if (ate === INVALIDA) {
        return { ok: false, erro: `assinaturas[${i}]: \`acesso_ate\` não é uma data` };
      }
      assinaturas.push({
        salon_id,
        plano: (plano as string | null | undefined) ?? null,
        status: status.trim(),
        valor: (valor as number | null | undefined) ?? null,
        proximo_vencimento: venc,
        acesso_ate: ate,
      });
    }
  }

  // ---- faturas (opcional) ----
  const faturas: FaturaRecebida[] = [];
  if (bruto.faturas !== undefined) {
    if (!Array.isArray(bruto.faturas)) return { ok: false, erro: "`faturas` precisa ser uma lista" };
    if (bruto.faturas.length > MAX_FATURAS) {
      return { ok: false, erro: `no máximo ${MAX_FATURAS} faturas por envio` };
    }
    const jaVistas = new Set<string>();
    for (const [i, linha] of bruto.faturas.entries()) {
      if (!ehObjeto(linha)) return { ok: false, erro: `faturas[${i}]: não é um objeto` };
      const { salon_id, periodo_inicio, periodo_fim, motivo, valor, valor_gerado, agendamentos, vencimento, paga_em } =
        linha;
      if (typeof salon_id !== "string" || !conhecidos.has(salon_id)) {
        return { ok: false, erro: `faturas[${i}]: salão desconhecido` };
      }
      if (typeof periodo_inicio !== "string" || !diaValido(periodo_inicio)) {
        return { ok: false, erro: `faturas[${i}]: \`periodo_inicio\` precisa ser uma data AAAA-MM-DD` };
      }
      if (typeof periodo_fim !== "string" || !diaValido(periodo_fim)) {
        return { ok: false, erro: `faturas[${i}]: \`periodo_fim\` precisa ser uma data AAAA-MM-DD` };
      }
      if (periodo_fim < periodo_inicio) {
        return { ok: false, erro: `faturas[${i}]: o período termina antes de começar` };
      }
      if (typeof motivo !== "string" || motivo.trim() === "") {
        return { ok: false, erro: `faturas[${i}]: \`motivo\` vazio` };
      }
      // A chave é a mesma do ClubCut. Repetida no envio, os dois upserts
      // brigariam pela mesma linha dentro de uma requisição só.
      const chave = `${salon_id}|${periodo_inicio}|${periodo_fim}|${motivo.trim()}`;
      if (jaVistas.has(chave)) return { ok: false, erro: `faturas[${i}]: fatura repetida no envio` };
      jaVistas.add(chave);
      if (!numeroNaoNegativo(valor)) {
        return { ok: false, erro: `faturas[${i}]: \`valor\` precisa ser um número ≥ 0` };
      }
      if (valor_gerado !== undefined && !numeroNaoNegativo(valor_gerado)) {
        return { ok: false, erro: `faturas[${i}]: \`valor_gerado\` precisa ser um número ≥ 0` };
      }
      if (agendamentos !== undefined && !inteiroNaoNegativo(agendamentos)) {
        return { ok: false, erro: `faturas[${i}]: \`agendamentos\` precisa ser inteiro ≥ 0` };
      }
      const venc = dataOpcional(vencimento);
      if (venc === INVALIDA) return { ok: false, erro: `faturas[${i}]: \`vencimento\` não é uma data` };
      if (paga_em !== undefined && paga_em !== null && typeof paga_em !== "string") {
        return { ok: false, erro: `faturas[${i}]: \`paga_em\` não é um instante` };
      }
      faturas.push({
        salon_id,
        periodo_inicio,
        periodo_fim,
        motivo: motivo.trim(),
        valor,
        valor_gerado: (valor_gerado as number | undefined) ?? 0,
        agendamentos: (agendamentos as number | undefined) ?? 0,
        vencimento: venc,
        paga_em: (paga_em as string | null | undefined) ?? null,
      });
    }
  }

  return { ok: true, envio: { saloes, uso, assinaturas, faturas } };
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

// ============================================================
// 3. COBRANÇA
// ============================================================

export type FaturaLida = {
  salon_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  motivo: string;
  valor: number;
  valor_gerado: number;
  agendamentos: number;
  vencimento: string | null;
  paga_em: string | null;
};

export type ResumoDeCobranca = {
  /** Somado só o que fechou dentro da janela da tela. */
  cobrado: number;
  /** Tudo sem baixa, de qualquer período. Dívida não expira com a janela. */
  emAberto: number;
  /** Quantas das em aberto já passaram do vencimento. */
  vencidas: number;
  ultimoPeriodoFim: string | null;
};

export function resumirCobranca(
  faturas: FaturaLida[],
  desde: string,
  hoje: string
): Map<string, ResumoDeCobranca> {
  const porSalao = new Map<string, ResumoDeCobranca>();

  for (const f of faturas) {
    let r = porSalao.get(f.salon_id);
    if (!r) {
      r = { cobrado: 0, emAberto: 0, vencidas: 0, ultimoPeriodoFim: null };
      porSalao.set(f.salon_id, r);
    }

    if (f.periodo_fim >= desde) r.cobrado += f.valor;

    if (f.paga_em === null) {
      r.emAberto += f.valor;
      // Sem vencimento não dá para dizer que está vencida — e boleto gerado
      // à mão às vezes não tem. Fica em aberto, fora da contagem.
      if (f.vencimento !== null && f.vencimento < hoje) r.vencidas += 1;
    }

    if (r.ultimoPeriodoFim === null || f.periodo_fim > r.ultimoPeriodoFim) {
      r.ultimoPeriodoFim = f.periodo_fim;
    }
  }

  return porSalao;
}

export type Assinatura = {
  salon_id: string;
  plano: string | null;
  status: string;
  valor: number | null;
  proximo_vencimento: string | null;
  acesso_ate: string | null;
};

export type Situacao = {
  rotulo: string;
  tom: "accent" | "amber" | "red" | "neutral";
};

/**
 * Como a assinatura deve ser lida na tela.
 *
 * O caso que motiva esta função é o teste VENCIDO: status continua `trial`,
 * `acesso_ate` já passou, e o cliente segue sendo atendido de graça porque
 * não existe corte automático. Sem tratar isso à parte, ele apareceria com a
 * mesma cara de um teste em dia — e é exatamente a linha que alguém precisa
 * ver para ir cobrar.
 */
export function situacaoDaAssinatura(a: Assinatura | null, hoje: string): Situacao {
  if (!a) return { rotulo: "sem assinatura", tom: "neutral" };

  const acessoVencido = a.acesso_ate !== null && a.acesso_ate < hoje;

  switch (a.status) {
    case "active":
      return { rotulo: "ativa", tom: "accent" };
    case "trial":
      return acessoVencido
        ? { rotulo: "teste vencido", tom: "red" }
        : { rotulo: "em teste", tom: "amber" };
    case "atrasada":
      return { rotulo: "atrasada", tom: "red" };
    case "cancelada":
      return { rotulo: "cancelada", tom: "red" };
    default:
      // Status que o ClubCut criou depois desta função. Mostrar o texto cru é
      // melhor que esconder: quem lê descobre que existe algo novo.
      return { rotulo: a.status, tom: "neutral" };
  }
}

import { saudeDoNegocio } from "./negocios";

/**
 * O Painel (Fase 3D, versão reduzida): agrega três listas cruas — negócios,
 * contas, implantações — em métricas de HOJE, sem histórico. Não existe
 * `assinaturas` (Fase 3C foi pulada), então não há "evolução do MRR" aqui, só
 * o snapshot honesto do estado atual do funil e da carteira. Ver
 * `docs/superpowers/plans/2026-08-17-fase-3d-painel.md` para o porquê de cada corte.
 */
export type NegocioParaPainel = {
  id: string;
  contaId: string;
  resultado: "ganho" | "perdido" | null;
  mrr: number | null;
  setup: number | null;
  proximoPasso: string | null;
  proximoPassoEm: string | null;
  mexidoEm: string;
};

export type ContaParaPainel = {
  id: string;
  fase: "prospect" | "implantacao" | "cliente" | "perdido" | "churn";
  origem: string | null;
};

export type ImplantacaoParaPainel = {
  negocioId: string;
  concluidaEm: string | null;
};

export type OrigemReceita = { origem: string; leads: number; ganhos: number; mrr: number };

export type MetricasPainel = {
  mrrAtivo: number;
  clientesAtivos: number;
  pipelineMrr: number;
  pipelineContagem: number;
  ticketMedio: number | null;
  apodrecendoContagem: number;
  apodrecendoMrr: number;
  mrrEsperandoGoLive: number;
  /** Razão 0–1, quem exibe formata em %. `null` = denominador zero, não zero. */
  setupNaReceita: number | null;
  /** Ordenado por `mrr` descendente. */
  origemReceita: OrigemReceita[];
};

/**
 * `agora` é opcional só para poder repassar direto a `saudeDoNegocio`, que já
 * tem o mesmo parâmetro com o mesmo motivo (ver `negocios.ts`): um "agora"
 * fixado no teste, não redescoberto a cada chamada.
 */
export function calcularMetricasPainel(
  negocios: NegocioParaPainel[],
  contas: ContaParaPainel[],
  implantacoes: ImplantacaoParaPainel[],
  agora: Date = new Date()
): MetricasPainel {
  const contaPorId = new Map(contas.map((c) => [c.id, c]));
  // Implantação "aberta" = ainda não concluída. É o único sinal que existe
  // hoje de "receita ainda não rodando" — ver a nota da Task 1 no plano sobre
  // por que não fixar uma posição de etapa em código.
  const negocioIdsComImplantacaoAberta = new Set(
    implantacoes.filter((i) => i.concluidaEm === null).map((i) => i.negocioId)
  );

  const negociosAbertos = negocios.filter((n) => n.resultado === null);
  const pipelineMrr = negociosAbertos.reduce((soma, n) => soma + (n.mrr ?? 0), 0);
  const pipelineContagem = negociosAbertos.length;
  // Razão indefinida com zero negócio aberto, não zero disfarçado.
  const ticketMedio = pipelineContagem > 0 ? Math.round(pipelineMrr / pipelineContagem) : null;

  // Apodrecendo reusa saudeDoNegocio — a mesma regra do Pipeline, não uma
  // segunda cópia que pode divergir dela.
  let apodrecendoContagem = 0;
  let apodrecendoMrr = 0;
  for (const n of negociosAbertos) {
    const saude = saudeDoNegocio(
      { proximoPasso: n.proximoPasso, proximoPassoEm: n.proximoPassoEm, mexidoEm: n.mexidoEm },
      agora
    );
    if (saude === "podre") {
      apodrecendoContagem += 1;
      apodrecendoMrr += n.mrr ?? 0;
    }
  }

  const negociosGanhos = negocios.filter((n) => n.resultado === "ganho");

  // mrrAtivo: ganho não basta — a conta precisa ter virado cliente de fato
  // (implantação concluída). Um ganho cuja conta ainda está em "implantacao"
  // entra em mrrEsperandoGoLive, não aqui.
  let mrrAtivo = 0;
  for (const n of negociosGanhos) {
    const conta = contaPorId.get(n.contaId);
    if (conta?.fase === "cliente") mrrAtivo += n.mrr ?? 0;
  }
  // Clientes ativos conta CONTAS, não negócios — uma conta é uma conta, mesmo
  // que tenha mais de um negócio ganho associado.
  const clientesAtivos = contas.filter((c) => c.fase === "cliente").length;

  let mrrEsperandoGoLive = 0;
  for (const n of negociosGanhos) {
    if (negocioIdsComImplantacaoAberta.has(n.id)) mrrEsperandoGoLive += n.mrr ?? 0;
  }

  // Setup na receita: só entre os ganhos, e só desde o início (não mensal —
  // isso é o que a leitura mensal completa, Fase 3C/3D, traria).
  let somaSetup = 0;
  let somaMrrGanho = 0;
  for (const n of negociosGanhos) {
    somaSetup += n.setup ?? 0;
    somaMrrGanho += n.mrr ?? 0;
  }
  const denominadorSetup = somaSetup + somaMrrGanho;
  const setupNaReceita = denominadorSetup > 0 ? somaSetup / denominadorSetup : null;

  // Origem → receita: agrupa TODOS os negócios (abertos, ganhos, perdidos)
  // pela origem normalizada da conta. Normaliza para agrupar, mas exibe a
  // grafia da primeira ocorrência vista — contas.origem é texto livre sem
  // normalização no banco.
  const gruposPorChave = new Map<string, OrigemReceita>();
  for (const n of negocios) {
    const conta = contaPorId.get(n.contaId);
    const origemBruta = conta?.origem?.trim();
    const chave = origemBruta ? origemBruta.toLowerCase() : "sem-origem";
    const rotulo = origemBruta ? origemBruta : "Sem origem";

    let grupo = gruposPorChave.get(chave);
    if (!grupo) {
      grupo = { origem: rotulo, leads: 0, ganhos: 0, mrr: 0 };
      gruposPorChave.set(chave, grupo);
    }
    grupo.leads += 1;
    if (n.resultado === "ganho") {
      grupo.ganhos += 1;
      grupo.mrr += n.mrr ?? 0;
    }
  }
  const origemReceita = Array.from(gruposPorChave.values()).sort((a, b) => b.mrr - a.mrr);

  return {
    mrrAtivo,
    clientesAtivos,
    pipelineMrr,
    pipelineContagem,
    ticketMedio,
    apodrecendoContagem,
    apodrecendoMrr,
    mrrEsperandoGoLive,
    setupNaReceita,
    origemReceita,
  };
}

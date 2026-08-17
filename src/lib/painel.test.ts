import { describe, it, expect } from "vitest";
import { saudeDoNegocio } from "./negocios";
import {
  calcularMetricasPainel,
  type ContaParaPainel,
  type ImplantacaoParaPainel,
  type NegocioParaPainel,
} from "./painel";

// Mesmo instante fixo usado em negocios.test.ts, para poder cruzar as duas
// suítes sem reintroduzir uma segunda fonte de "agora".
const AGORA = new Date("2026-08-14T15:00:00Z");

function negocio(over: Partial<NegocioParaPainel> = {}): NegocioParaPainel {
  return {
    id: "negocio-1",
    contaId: "conta-1",
    resultado: null,
    mrr: 1000,
    setup: 500,
    proximoPasso: "Ligar para a sócia financeira",
    proximoPassoEm: "2026-08-20",
    mexidoEm: "2026-08-14T12:00:00Z",
    ...over,
  };
}

function conta(over: Partial<ContaParaPainel> = {}): ContaParaPainel {
  return {
    id: "conta-1",
    fase: "prospect",
    origem: null,
    ...over,
  };
}

function implantacao(over: Partial<ImplantacaoParaPainel> = {}): ImplantacaoParaPainel {
  return {
    negocioId: "negocio-1",
    concluidaEm: null,
    ...over,
  };
}

describe("calcularMetricasPainel — caso vazio", () => {
  it("três arrays vazios não lança e devolve tudo zerado/null", () => {
    const metricas = calcularMetricasPainel([], [], [], AGORA);
    expect(metricas).toEqual({
      mrrAtivo: 0,
      clientesAtivos: 0,
      pipelineMrr: 0,
      pipelineContagem: 0,
      ticketMedio: null,
      apodrecendoContagem: 0,
      apodrecendoMrr: 0,
      mrrEsperandoGoLive: 0,
      setupNaReceita: null,
      origemReceita: [],
    });
  });
});

describe("calcularMetricasPainel — mrrAtivo e clientesAtivos", () => {
  it("soma só ganhos cuja conta já está em fase cliente", () => {
    const negocios = [negocio({ id: "n1", contaId: "c1", resultado: "ganho", mrr: 1000 })];
    const contas = [conta({ id: "c1", fase: "cliente" })];
    const metricas = calcularMetricasPainel(negocios, contas, [], AGORA);
    expect(metricas.mrrAtivo).toBe(1000);
    expect(metricas.clientesAtivos).toBe(1);
  });

  it("ignora ganho cuja conta ainda está em implantacao — não virou cliente de verdade", () => {
    const negocios = [negocio({ id: "n1", contaId: "c1", resultado: "ganho", mrr: 1000 })];
    const contas = [conta({ id: "c1", fase: "implantacao" })];
    const metricas = calcularMetricasPainel(negocios, contas, [], AGORA);
    expect(metricas.mrrAtivo).toBe(0);
  });

  it("clientesAtivos conta contas, não negócios — duas contas cliente com um negócio ganho cada", () => {
    const negocios = [
      negocio({ id: "n1", contaId: "c1", resultado: "ganho", mrr: 500 }),
      negocio({ id: "n2", contaId: "c2", resultado: "ganho", mrr: 700 }),
    ];
    const contas = [conta({ id: "c1", fase: "cliente" }), conta({ id: "c2", fase: "cliente" })];
    const metricas = calcularMetricasPainel(negocios, contas, [], AGORA);
    expect(metricas.clientesAtivos).toBe(2);
    expect(metricas.mrrAtivo).toBe(1200);
  });

  it("negócio cuja conta não é encontrada no Map não lança e não entra em mrrAtivo", () => {
    const negocios = [negocio({ id: "n1", contaId: "conta-fantasma", resultado: "ganho", mrr: 1000 })];
    expect(() => calcularMetricasPainel(negocios, [], [], AGORA)).not.toThrow();
    const metricas = calcularMetricasPainel(negocios, [], [], AGORA);
    expect(metricas.mrrAtivo).toBe(0);
  });
});

describe("calcularMetricasPainel — pipeline e ticket médio", () => {
  it("pipelineMrr e pipelineContagem somam só negócios abertos (resultado null)", () => {
    const negocios = [
      negocio({ id: "n1", resultado: null, mrr: 1000 }),
      negocio({ id: "n2", resultado: null, mrr: 500 }),
      negocio({ id: "n3", resultado: "ganho", mrr: 2000 }),
      negocio({ id: "n4", resultado: "perdido", mrr: 300 }),
    ];
    const metricas = calcularMetricasPainel(negocios, [], [], AGORA);
    expect(metricas.pipelineMrr).toBe(1500);
    expect(metricas.pipelineContagem).toBe(2);
    expect(metricas.ticketMedio).toBe(750);
  });

  it("ticketMedio é null com zero negócio aberto — razão indefinida, não zero", () => {
    const negocios = [negocio({ id: "n1", resultado: "ganho", mrr: 1000 })];
    const metricas = calcularMetricasPainel(negocios, [], [], AGORA);
    expect(metricas.pipelineContagem).toBe(0);
    expect(metricas.ticketMedio).toBeNull();
  });
});

describe("calcularMetricasPainel — apodrecendo", () => {
  it("apodrecendoContagem/Mrr refletem exatamente o que saudeDoNegocio diria isoladamente", () => {
    const podre = negocio({ id: "n1", resultado: null, mrr: 1000, proximoPasso: null });
    const ok = negocio({ id: "n2", resultado: null, mrr: 500, proximoPassoEm: "2026-08-25" });
    // Confere que o fixture realmente cruza com a regra real, não com uma
    // suposição sobre ela.
    expect(saudeDoNegocio(podre, AGORA)).toBe("podre");
    expect(saudeDoNegocio(ok, AGORA)).not.toBe("podre");

    const metricas = calcularMetricasPainel([podre, ok], [], [], AGORA);
    expect(metricas.apodrecendoContagem).toBe(1);
    expect(metricas.apodrecendoMrr).toBe(1000);
  });

  it("não considera negócio fechado para apodrecimento, mesmo que a saúde desse podre", () => {
    const negocios = [
      negocio({ id: "n1", resultado: "perdido", mrr: 1000, proximoPasso: null }),
    ];
    const metricas = calcularMetricasPainel(negocios, [], [], AGORA);
    expect(metricas.apodrecendoContagem).toBe(0);
    expect(metricas.apodrecendoMrr).toBe(0);
  });
});

describe("calcularMetricasPainel — mrrEsperandoGoLive", () => {
  it("soma mrr dos ganhos cuja implantação ainda não tem concluidaEm", () => {
    const negocios = [negocio({ id: "n1", resultado: "ganho", mrr: 1000 })];
    const implantacoes = [implantacao({ negocioId: "n1", concluidaEm: null })];
    const metricas = calcularMetricasPainel(negocios, [], implantacoes, AGORA);
    expect(metricas.mrrEsperandoGoLive).toBe(1000);
  });

  it("ignora implantação já concluída", () => {
    const negocios = [negocio({ id: "n1", resultado: "ganho", mrr: 1000 })];
    const implantacoes = [implantacao({ negocioId: "n1", concluidaEm: "2026-08-10" })];
    const metricas = calcularMetricasPainel(negocios, [], implantacoes, AGORA);
    expect(metricas.mrrEsperandoGoLive).toBe(0);
  });

  it("negócio ganho sem implantação nenhuma não entra em mrrEsperandoGoLive", () => {
    const negocios = [negocio({ id: "n1", resultado: "ganho", mrr: 1000 })];
    const metricas = calcularMetricasPainel(negocios, [], [], AGORA);
    expect(metricas.mrrEsperandoGoLive).toBe(0);
  });

  it("conta já cliente com implantação ainda aberta (janela entre as duas escritas de concluirImplantacao) não soma duas vezes", () => {
    // concluirImplantacao escreve contas.fase='cliente' ANTES de
    // implantacoes.concluida_em — se a segunda escrita falhar, existe um
    // instante real em que as duas condições são verdadeiras ao mesmo
    // tempo. Sem a checagem de fase aqui, o mesmo MRR apareceria em
    // mrrAtivo E em mrrEsperandoGoLive.
    const negocios = [negocio({ id: "n1", contaId: "c1", resultado: "ganho", mrr: 1000 })];
    const contas = [conta({ id: "c1", fase: "cliente" })];
    const implantacoes = [implantacao({ negocioId: "n1", concluidaEm: null })];
    const metricas = calcularMetricasPainel(negocios, contas, implantacoes, AGORA);
    expect(metricas.mrrAtivo).toBe(1000);
    expect(metricas.mrrEsperandoGoLive).toBe(0);
  });
});

describe("calcularMetricasPainel — setupNaReceita", () => {
  it("null com zero negócio ganho — denominador zero", () => {
    const negocios = [negocio({ id: "n1", resultado: null, mrr: 1000, setup: 500 })];
    const metricas = calcularMetricasPainel(negocios, [], [], AGORA);
    expect(metricas.setupNaReceita).toBeNull();
  });

  it("calcula soma(setup)/(soma(setup)+soma(mrr)) só sobre os ganhos", () => {
    const negocios = [
      negocio({ id: "n1", resultado: "ganho", mrr: 1000, setup: 500 }),
      negocio({ id: "n2", resultado: "ganho", mrr: 500, setup: 500 }),
      // Aberto: não deve contaminar o cálculo.
      negocio({ id: "n3", resultado: null, mrr: 9999, setup: 9999 }),
    ];
    const metricas = calcularMetricasPainel(negocios, [], [], AGORA);
    // soma setup = 1000, soma mrr = 1500, denominador = 2500 → 0.4
    expect(metricas.setupNaReceita).toBeCloseTo(0.4);
  });
});

describe("calcularMetricasPainel — origemReceita", () => {
  it("agrupa 'Instagram' e 'instagram' na mesma linha, com o rótulo da primeira grafia vista", () => {
    const negocios = [
      negocio({ id: "n1", contaId: "c1", resultado: "ganho", mrr: 1000 }),
      negocio({ id: "n2", contaId: "c2", resultado: null, mrr: 500 }),
    ];
    const contas = [conta({ id: "c1", origem: "Instagram" }), conta({ id: "c2", origem: "instagram" })];
    const metricas = calcularMetricasPainel(negocios, contas, [], AGORA);
    expect(metricas.origemReceita).toHaveLength(1);
    expect(metricas.origemReceita[0]).toEqual({ origem: "Instagram", leads: 2, ganhos: 1, mrr: 1000 });
  });

  it("negócio sem conta com origem preenchida cai em 'Sem origem'", () => {
    const negocios = [negocio({ id: "n1", contaId: "c1", resultado: null })];
    const contas = [conta({ id: "c1", origem: null })];
    const metricas = calcularMetricasPainel(negocios, contas, [], AGORA);
    expect(metricas.origemReceita).toEqual([{ origem: "Sem origem", leads: 1, ganhos: 0, mrr: 0 }]);
  });

  it("ordena por mrr descendente", () => {
    const negocios = [
      negocio({ id: "n1", contaId: "c1", resultado: "ganho", mrr: 300 }),
      negocio({ id: "n2", contaId: "c2", resultado: "ganho", mrr: 900 }),
    ];
    const contas = [conta({ id: "c1", origem: "Indicação" }), conta({ id: "c2", origem: "Google" })];
    const metricas = calcularMetricasPainel(negocios, contas, [], AGORA);
    expect(metricas.origemReceita.map((o) => o.origem)).toEqual(["Google", "Indicação"]);
  });

  it("agrupa TODOS os negócios, incluindo perdidos, mas só soma mrr dos ganhos", () => {
    const negocios = [
      negocio({ id: "n1", contaId: "c1", resultado: "perdido", mrr: 5000 }),
      negocio({ id: "n2", contaId: "c1", resultado: "ganho", mrr: 200 }),
    ];
    const contas = [conta({ id: "c1", origem: "Referência" })];
    const metricas = calcularMetricasPainel(negocios, contas, [], AGORA);
    expect(metricas.origemReceita).toEqual([{ origem: "Referência", leads: 2, ganhos: 1, mrr: 200 }]);
  });
});

import { describe, it, expect } from "vitest";
import {
  granularidadeParaPeriodo,
  calcularSerieNegociosGanhos,
  calcularSerieContasCriadas,
  calcularSerieImplantacoesConcluidas,
  calcularOrigemReceitaNoPeriodo,
} from "./painel-historico";

describe("granularidadeParaPeriodo", () => {
  it("30 e 31 dias agrupam por dia", () => {
    const inicio = new Date("2026-01-01T12:00:00Z");
    expect(granularidadeParaPeriodo(inicio, new Date("2026-01-31T12:00:00Z"))).toBe("dia");
    expect(granularidadeParaPeriodo(inicio, new Date("2026-02-01T12:00:00Z"))).toBe("dia");
  });

  it("32 e 180 dias agrupam por semana", () => {
    const inicio = new Date("2026-01-01T12:00:00Z");
    expect(granularidadeParaPeriodo(inicio, new Date("2026-02-02T12:00:00Z"))).toBe("semana");
    expect(granularidadeParaPeriodo(inicio, new Date("2026-06-30T12:00:00Z"))).toBe("semana");
  });

  it("181 dias agrupa por mês", () => {
    const inicio = new Date("2026-01-01T12:00:00Z");
    expect(granularidadeParaPeriodo(inicio, new Date("2026-07-01T12:00:00Z"))).toBe("mes");
  });
});

describe("calcularSerieNegociosGanhos", () => {
  const INICIO = new Date("2026-01-10T12:00:00Z");
  const FIM = new Date("2026-01-12T12:00:00Z"); // período de 3 dias: 10, 11, 12 de janeiro

  it("bucket sem nenhum negócio ganho aparece com 0, não some", () => {
    const serie = calcularSerieNegociosGanhos([], INICIO, FIM);
    expect(serie).toEqual([
      { chave: "2026-01-10", rotulo: "10 de jan", ganhos: 0, mrrGanho: 0 },
      { chave: "2026-01-11", rotulo: "11 de jan", ganhos: 0, mrrGanho: 0 },
      { chave: "2026-01-12", rotulo: "12 de jan", ganhos: 0, mrrGanho: 0 },
    ]);
  });

  it("negócio ganho exatamente no início do período é incluído", () => {
    const serie = calcularSerieNegociosGanhos(
      [{ resultado: "ganho", fechadoEm: "2026-01-10", mrr: 500 }],
      INICIO,
      FIM
    );
    expect(serie.find((p) => p.chave === "2026-01-10")).toEqual({
      chave: "2026-01-10",
      rotulo: "10 de jan",
      ganhos: 1,
      mrrGanho: 500,
    });
  });

  it("negócio ganho exatamente no fim do período é incluído", () => {
    const serie = calcularSerieNegociosGanhos(
      [{ resultado: "ganho", fechadoEm: "2026-01-12", mrr: 700 }],
      INICIO,
      FIM
    );
    expect(serie.find((p) => p.chave === "2026-01-12")?.ganhos).toBe(1);
  });

  it("negócio ganho fora do período (antes ou depois) não conta", () => {
    const serie = calcularSerieNegociosGanhos(
      [
        { resultado: "ganho", fechadoEm: "2026-01-09", mrr: 500 },
        { resultado: "ganho", fechadoEm: "2026-01-13", mrr: 500 },
      ],
      INICIO,
      FIM
    );
    const totalGanhos = serie.reduce((soma, p) => soma + p.ganhos, 0);
    expect(totalGanhos).toBe(0);
  });

  it("negócio perdido não conta, mesmo com fechadoEm dentro do período", () => {
    const serie = calcularSerieNegociosGanhos(
      [{ resultado: "perdido", fechadoEm: "2026-01-11", mrr: 500 }],
      INICIO,
      FIM
    );
    expect(serie.reduce((soma, p) => soma + p.ganhos, 0)).toBe(0);
  });

  it("negócio ganho sem fechadoEm não conta", () => {
    const serie = calcularSerieNegociosGanhos(
      [{ resultado: "ganho", fechadoEm: null, mrr: 500 }],
      INICIO,
      FIM
    );
    expect(serie.reduce((soma, p) => soma + p.ganhos, 0)).toBe(0);
  });

  it("bucket mensal: negócio ganho em fevereiro cai no bucket de fevereiro, não janeiro nem março", () => {
    const inicio = new Date("2026-01-01T12:00:00Z");
    const fim = new Date("2026-07-01T12:00:00Z"); // 181 dias -> granularidade "mes"
    const serie = calcularSerieNegociosGanhos(
      [{ resultado: "ganho", fechadoEm: "2026-02-15", mrr: 1000 }],
      inicio,
      fim
    );
    expect(serie.find((p) => p.chave === "2026-02")).toMatchObject({ ganhos: 1, mrrGanho: 1000 });
    expect(serie.find((p) => p.chave === "2026-01")).toMatchObject({ ganhos: 0 });
    expect(serie.find((p) => p.chave === "2026-03")).toMatchObject({ ganhos: 0 });
  });
});

describe("calcularSerieContasCriadas", () => {
  const INICIO = new Date("2026-01-10T12:00:00Z");
  const FIM = new Date("2026-01-12T12:00:00Z");

  it("conta criada dentro do período cai no bucket certo", () => {
    const serie = calcularSerieContasCriadas([{ criadoEm: "2026-01-11T09:00:00Z" }], INICIO, FIM);
    expect(serie.find((p) => p.chave === "2026-01-11")?.contas).toBe(1);
  });

  it("conta criada fora do período não conta", () => {
    const serie = calcularSerieContasCriadas([{ criadoEm: "2026-01-20T09:00:00Z" }], INICIO, FIM);
    expect(serie.reduce((soma, p) => soma + p.contas, 0)).toBe(0);
  });
});

describe("calcularSerieImplantacoesConcluidas", () => {
  const INICIO = new Date("2026-01-10T12:00:00Z");
  const FIM = new Date("2026-01-12T12:00:00Z");

  it("implantação concluída dentro do período conta", () => {
    const serie = calcularSerieImplantacoesConcluidas([{ concluidaEm: "2026-01-11T09:00:00Z" }], INICIO, FIM);
    expect(serie.find((p) => p.chave === "2026-01-11")?.concluidas).toBe(1);
  });

  it("implantação ainda aberta (concluidaEm null) não conta", () => {
    const serie = calcularSerieImplantacoesConcluidas([{ concluidaEm: null }], INICIO, FIM);
    expect(serie.reduce((soma, p) => soma + p.concluidas, 0)).toBe(0);
  });
});

describe("calcularOrigemReceitaNoPeriodo", () => {
  const INICIO = new Date("2026-01-10T12:00:00Z");
  const FIM = new Date("2026-01-12T12:00:00Z");
  const contas = [
    { id: "c1", origem: "Indicação" },
    { id: "c2", origem: "indicação" }, // grafia diferente, mesma origem normalizada
    { id: "c3", origem: null },
  ];

  it("agrupa por origem normalizada (trim + lowercase), exibindo a grafia da primeira ocorrência", () => {
    const origens = calcularOrigemReceitaNoPeriodo(
      [
        { contaId: "c1", resultado: "ganho", mrr: 1000, criadoEm: "2026-01-11T09:00:00Z" },
        { contaId: "c2", resultado: null, mrr: null, criadoEm: "2026-01-11T09:00:00Z" },
      ],
      contas,
      INICIO,
      FIM
    );
    expect(origens).toEqual([{ origem: "Indicação", leads: 2, ganhos: 1, mrr: 1000 }]);
  });

  it("negócio criado fora do período não entra no agrupamento", () => {
    const origens = calcularOrigemReceitaNoPeriodo(
      [{ contaId: "c1", resultado: "ganho", mrr: 1000, criadoEm: "2026-01-20T09:00:00Z" }],
      contas,
      INICIO,
      FIM
    );
    expect(origens).toEqual([]);
  });

  it("conta sem origem agrupa em 'Sem origem'", () => {
    const origens = calcularOrigemReceitaNoPeriodo(
      [{ contaId: "c3", resultado: null, mrr: null, criadoEm: "2026-01-11T09:00:00Z" }],
      contas,
      INICIO,
      FIM
    );
    expect(origens).toEqual([{ origem: "Sem origem", leads: 1, ganhos: 0, mrr: 0 }]);
  });
});

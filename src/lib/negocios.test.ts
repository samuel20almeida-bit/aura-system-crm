import { describe, it, expect } from "vitest";
import { diasParado, rotuloVencimento, saudeDaTarefa, saudeDoNegocio } from "./negocios";

// São Paulo é UTC-3 o ano todo. 15:00Z = 12:00 em SP, bem longe da virada.
const MEIO_DIA = new Date("2026-08-14T15:00:00Z");
// 02:00Z do dia 15 = 23:00 do dia 14 em SP. É aqui que uma conta feita em UTC
// erra o dia, e é onde o fuso mordeu três vezes na Fase 1.
const ONZE_DA_NOITE = new Date("2026-08-15T02:00:00Z");

function negocio(over: Partial<Parameters<typeof saudeDoNegocio>[0]> = {}) {
  return {
    proximoPasso: "Ligar para a sócia financeira",
    proximoPassoEm: "2026-08-20",
    mexidoEm: "2026-08-14T12:00:00Z",
    ...over,
  };
}

describe("saudeDoNegocio", () => {
  it("apodrece sem próximo passo, por mais recente que seja o toque", () => {
    expect(saudeDoNegocio(negocio({ proximoPasso: null, mexidoEm: MEIO_DIA.toISOString() }), MEIO_DIA)).toBe("podre");
  });

  it("trata próximo passo só com espaços como se não existisse", () => {
    expect(saudeDoNegocio(negocio({ proximoPasso: "   " }), MEIO_DIA)).toBe("podre");
  });

  it("apodrece com o próximo passo vencido ontem", () => {
    expect(saudeDoNegocio(negocio({ proximoPassoEm: "2026-08-13" }), MEIO_DIA)).toBe("podre");
  });

  it("não apodrece com o próximo passo vencendo hoje — o dia não acabou", () => {
    expect(saudeDoNegocio(negocio({ proximoPassoEm: "2026-08-14" }), MEIO_DIA)).toBe("ok");
  });

  it("às 23h de São Paulo, o passo de hoje ainda é hoje", () => {
    // O UTC já virou para 15/08. Uma comparação em UTC diria "venceu ontem".
    expect(saudeDoNegocio(negocio({ proximoPassoEm: "2026-08-14" }), ONZE_DA_NOITE)).toBe("ok");
  });

  it("apodrece parado há 8 dias, mesmo com passo definido e data futura", () => {
    expect(saudeDoNegocio(negocio({ mexidoEm: "2026-08-06T12:00:00Z" }), MEIO_DIA)).toBe("podre");
  });

  it("na fronteira de 7 dias parados ainda não apodreceu", () => {
    expect(saudeDoNegocio(negocio({ mexidoEm: "2026-08-07T12:00:00Z" }), MEIO_DIA)).toBe("atencao");
  });

  it("pede atenção parado há 5 dias", () => {
    expect(saudeDoNegocio(negocio({ mexidoEm: "2026-08-09T12:00:00Z" }), MEIO_DIA)).toBe("atencao");
  });

  it("na fronteira de 4 dias parados ainda está ok", () => {
    expect(saudeDoNegocio(negocio({ mexidoEm: "2026-08-10T12:00:00Z" }), MEIO_DIA)).toBe("ok");
  });

  it("está ok parado há 3 dias com passo e data futura", () => {
    expect(saudeDoNegocio(negocio({ mexidoEm: "2026-08-11T12:00:00Z" }), MEIO_DIA)).toBe("ok");
  });

  it("conta dias por calendário, não por horas corridas", () => {
    // 22h do dia 13 em SP para 12h do dia 14 em SP são 14 horas, mas 1 dia.
    // Com contagem por horas, 5 dias de calendário poderiam virar 4 e esconder
    // um negócio que já pede atenção.
    expect(saudeDoNegocio(negocio({ mexidoEm: "2026-08-10T01:00:00Z" }), MEIO_DIA)).toBe("atencao");
  });

  it("apodrece com data de toque ilegível, em vez de fingir que é recente", () => {
    expect(saudeDoNegocio(negocio({ mexidoEm: "nao é data" }), MEIO_DIA)).toBe("podre");
  });

  it("passo sem data nenhuma não apodrece por vencimento, só por abandono", () => {
    expect(saudeDoNegocio(negocio({ proximoPassoEm: null }), MEIO_DIA)).toBe("ok");
    expect(saudeDoNegocio(negocio({ proximoPassoEm: null, mexidoEm: "2026-08-01T12:00:00Z" }), MEIO_DIA)).toBe("podre");
  });
});

describe("saudeDaTarefa", () => {
  it("apodrece com prazo vencido ontem", () => {
    expect(saudeDaTarefa("2026-08-13", MEIO_DIA)).toBe("podre");
  });

  it("pede atenção vencendo hoje", () => {
    expect(saudeDaTarefa("2026-08-14", MEIO_DIA)).toBe("atencao");
  });

  it("está ok vencendo no futuro", () => {
    expect(saudeDaTarefa("2026-08-20", MEIO_DIA)).toBe("ok");
  });

  it("está ok sem due_date — nenhuma tela do projeto trata isso como alarme", () => {
    expect(saudeDaTarefa(null, MEIO_DIA)).toBe("ok");
  });
});

describe("diasParado", () => {
  it("conta pelo calendário de São Paulo", () => {
    expect(diasParado("2026-08-11T12:00:00Z", MEIO_DIA)).toBe(3);
  });

  it("nunca devolve negativo, mesmo com toque no futuro", () => {
    expect(diasParado("2026-08-20T12:00:00Z", MEIO_DIA)).toBe(0);
  });

  it("devolve zero para data ilegível", () => {
    expect(diasParado("xx", MEIO_DIA)).toBe(0);
  });
});

describe("rotuloVencimento", () => {
  it("escreve os quatro casos do protótipo", () => {
    expect(rotuloVencimento("2026-08-12", MEIO_DIA)).toBe("atrasado 2d");
    expect(rotuloVencimento("2026-08-14", MEIO_DIA)).toBe("hoje");
    expect(rotuloVencimento("2026-08-15", MEIO_DIA)).toBe("amanhã");
    expect(rotuloVencimento("2026-08-18", MEIO_DIA)).toBe("em 4d");
  });

  it("às 23h de São Paulo continua dizendo hoje", () => {
    expect(rotuloVencimento("2026-08-14", ONZE_DA_NOITE)).toBe("hoje");
  });

  it("devolve nulo sem data", () => {
    expect(rotuloVencimento(null, MEIO_DIA)).toBeNull();
  });
});

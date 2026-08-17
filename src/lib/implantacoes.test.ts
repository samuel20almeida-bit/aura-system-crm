import { describe, it, expect } from "vitest";
import { saudeDaImplantacao, vencimentoDaEtapa } from "./implantacoes";

// São Paulo é UTC-3 o ano todo. 15:00Z = 12:00 em SP, bem longe da virada.
const MEIO_DIA = new Date("2026-08-14T15:00:00Z");

describe("vencimentoDaEtapa", () => {
  it("soma o SLA em dias corridos à data de início da etapa", () => {
    expect(vencimentoDaEtapa("2026-08-14T12:00:00Z", 2)).toBe("2026-08-16");
  });

  it("com SLA de 1 dia, vence no dia seguinte ao início da etapa", () => {
    expect(vencimentoDaEtapa("2026-08-14T12:00:00Z", 1)).toBe("2026-08-15");
  });

  it("com SLA de 7 dias (Acompanhamento D+7), vence uma semana depois", () => {
    expect(vencimentoDaEtapa("2026-08-01T12:00:00Z", 7)).toBe("2026-08-08");
  });
});

describe("saudeDaImplantacao — espera: 'nos'", () => {
  it("apodrece com vencimento ontem", () => {
    expect(saudeDaImplantacao("2026-08-13", "nos", MEIO_DIA)).toBe("podre");
  });

  it("pede atenção vencendo hoje", () => {
    expect(saudeDaImplantacao("2026-08-14", "nos", MEIO_DIA)).toBe("atencao");
  });

  it("está ok dentro do prazo", () => {
    expect(saudeDaImplantacao("2026-08-20", "nos", MEIO_DIA)).toBe("ok");
  });

  it("está ok com vencimento no futuro distante", () => {
    expect(saudeDaImplantacao("2026-12-25", "nos", MEIO_DIA)).toBe("ok");
  });
});

describe("saudeDaImplantacao — espera: 'cliente'", () => {
  // O teste mais importante do módulo: prova a regra do spec — atraso de
  // etapa que depende do cliente não pode soar tão grave quanto atraso
  // nosso. O teto é "atencao", nunca "podre".
  it("vencida ontem pede só atenção, nunca apodrece", () => {
    expect(saudeDaImplantacao("2026-08-13", "cliente", MEIO_DIA)).toBe("atencao");
  });

  it("está ok dentro do prazo — não vira 'melhor que ok' por esperar o cliente", () => {
    expect(saudeDaImplantacao("2026-08-20", "cliente", MEIO_DIA)).toBe("ok");
  });

  it("está ok com vencimento no futuro distante", () => {
    expect(saudeDaImplantacao("2026-12-25", "cliente", MEIO_DIA)).toBe("ok");
  });

  it("vencendo hoje pede atenção, igual à família 'nos'", () => {
    expect(saudeDaImplantacao("2026-08-14", "cliente", MEIO_DIA)).toBe("atencao");
  });
});

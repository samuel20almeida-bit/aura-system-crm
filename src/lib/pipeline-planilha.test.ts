import { describe, expect, it } from "vitest";
import {
  COLUNAS,
  abasDoPipeline,
  estaParado,
  linhasDaPlanilha,
  negociosParados,
  nomeDaPlanilha,
  type NegocioParaPlanilha,
} from "./pipeline-planilha";

const AGORA = new Date("2026-09-12T15:00:00Z");

function negocio(over: Partial<NegocioParaPlanilha> = {}): NegocioParaPlanilha {
  return {
    estagio: "lead",
    // Ontem: recém-mexido.
    mexido_em: "2026-09-11T12:00:00Z",
    proximo_passo: "Ligar",
    proximo_passo_em: "2026-09-15",
    setup: 1500,
    mrr: 299,
    conta: {
      nome: "Barbearia do Zé",
      nicho: "Barbearia",
      cidade: "Curitiba",
      uf: "PR",
      decisor_nome: "José",
      software_atual: null,
      origem: "Prospecção fria",
      email: "ze@barbearia.com.br",
      telefone: "41999998888",
      site: "barbeariadoze.com.br",
    },
    dono: { full_name: "Samuel" },
    ...over,
  };
}

describe("estaParado", () => {
  it("negócio recém-mexido e com passo futuro não está parado", () => {
    expect(estaParado(negocio(), AGORA)).toBe(false);
  });

  it("sem próximo passo está parado, mesmo mexido hoje", () => {
    expect(estaParado(negocio({ proximo_passo: null, mexido_em: "2026-09-12T14:00:00Z" }), AGORA)).toBe(true);
    expect(estaParado(negocio({ proximo_passo: "   " }), AGORA)).toBe(true);
  });

  it("próximo passo vencido está parado; vencendo hoje, ainda não", () => {
    expect(estaParado(negocio({ proximo_passo_em: "2026-09-11" }), AGORA)).toBe(true);
    expect(estaParado(negocio({ proximo_passo_em: "2026-09-12" }), AGORA)).toBe(false);
  });

  it("mais de 7 dias sem movimento está parado", () => {
    expect(estaParado(negocio({ mexido_em: "2026-09-04T12:00:00Z" }), AGORA)).toBe(true);
    expect(estaParado(negocio({ mexido_em: "2026-09-06T12:00:00Z" }), AGORA)).toBe(false);
  });

  it("usa o MESMO critério que o cabeçalho do Pipeline conta como apodrecendo", () => {
    // Se este teste quebrar, a planilha passou a discordar da tela — e quem
    // confia na planilha é o último a descobrir.
    const funil = [negocio(), negocio({ proximo_passo: null }), negocio({ mexido_em: "2026-08-01T12:00:00Z" })];
    expect(funil.filter((n) => estaParado(n, AGORA))).toHaveLength(2);
  });
});

describe("negociosParados", () => {
  it("traz só os parados, do mais esquecido para o menos", () => {
    const parados = negociosParados(
      [
        negocio({ proximo_passo: null, mexido_em: "2026-09-05T12:00:00Z" }),
        negocio(),
        negocio({ proximo_passo: null, mexido_em: "2026-07-01T12:00:00Z" }),
        negocio({ proximo_passo: null, mexido_em: "2026-09-10T12:00:00Z" }),
      ],
      AGORA
    );
    expect(parados.map((n) => n.mexido_em)).toEqual([
      "2026-07-01T12:00:00Z",
      "2026-09-05T12:00:00Z",
      "2026-09-10T12:00:00Z",
    ]);
  });

  it("não muda a lista recebida", () => {
    const original = [negocio({ proximo_passo: null }), negocio()];
    const copia = [...original];
    negociosParados(original, AGORA);
    expect(original).toEqual(copia);
  });
});

describe("linhasDaPlanilha", () => {
  it("a primeira linha é o cabeçalho em negrito", () => {
    const [cabecalho] = linhasDaPlanilha([negocio()], AGORA);
    expect(cabecalho.every((c) => c.fontWeight === "bold")).toBe(true);
    expect(cabecalho[0].value).toBe("Empresa");
    expect(cabecalho.at(-1)!.value).toBe("Última movimentação");
  });

  it("empresa e contato na mesma linha", () => {
    const titulos = COLUNAS.map((c) => c.titulo);
    const [, linha] = linhasDaPlanilha([negocio()], AGORA);
    const valor = (titulo: string) => linha[titulos.indexOf(titulo)].value;
    expect(valor("Empresa")).toBe("Barbearia do Zé");
    expect(valor("Decisor")).toBe("José");
    expect(valor("E-mail")).toBe("ze@barbearia.com.br");
    expect(valor("Telefone")).toBe("41999998888");
  });

  it("dinheiro vai como NÚMERO, para somar e filtrar na planilha", () => {
    const titulos = COLUNAS.map((c) => c.titulo);
    const [, linha] = linhasDaPlanilha([negocio({ mrr: "299.50" })], AGORA);
    const celula = linha[titulos.indexOf("Mensalidade (R$)")];
    expect(celula.value).toBe(299.5);
    expect(celula.type).toBe(Number);
    expect(celula.format).toBe("#,##0.00");
  });

  it("data vai como Date, e ao meio-dia para não escorregar de fuso", () => {
    const titulos = COLUNAS.map((c) => c.titulo);
    const [, linha] = linhasDaPlanilha([negocio({ proximo_passo_em: "2026-09-15" })], AGORA);
    const celula = linha[titulos.indexOf("Próximo passo em")];
    expect(celula.type).toBe(Date);
    expect((celula.value as Date).toISOString()).toBe("2026-09-15T12:00:00.000Z");
  });

  it("campo vazio fica VAZIO, não vira zero nem 'null'", () => {
    const titulos = COLUNAS.map((c) => c.titulo);
    const [, linha] = linhasDaPlanilha([negocio({ setup: null, proximo_passo_em: null })], AGORA);
    expect(linha[titulos.indexOf("Setup (R$)")].value).toBeNull();
    expect(linha[titulos.indexOf("Próximo passo em")].value).toBeNull();
  });

  it("sobrevive a negócio sem conta e sem dono", () => {
    const [, linha] = linhasDaPlanilha([negocio({ conta: null, dono: null })], AGORA);
    expect(linha).toHaveLength(COLUNAS.length);
    expect(linha.every((c) => c.value !== undefined)).toBe(true);
  });

  it("traduz o estágio para caixa de frase", () => {
    const titulos = COLUNAS.map((c) => c.titulo);
    const [, linha] = linhasDaPlanilha([negocio({ estagio: "diagnostico" })], AGORA);
    expect(linha[titulos.indexOf("Estágio")].value).toBe("Diagnóstico");
  });

  it("só o cabeçalho quando não há negócio", () => {
    expect(linhasDaPlanilha([], AGORA)).toHaveLength(1);
  });
});

describe("abasDoPipeline", () => {
  it("duas abas, com os parados primeiro", () => {
    const funil = [negocio(), negocio({ proximo_passo: null }), negocio()];
    const abas = abasDoPipeline(funil, AGORA);
    expect(abas.map((a) => a.nome)).toEqual(["Parados", "Funil completo"]);
    // -1 do cabeçalho em cada.
    expect(abas[0].linhas).toHaveLength(1 + 1);
    expect(abas[1].linhas).toHaveLength(3 + 1);
  });

  it("as larguras acompanham a contagem de colunas nas duas abas", () => {
    for (const aba of abasDoPipeline([negocio()], AGORA)) {
      expect(aba.larguras).toHaveLength(COLUNAS.length);
    }
  });

  it("a aba de parados pode vir vazia sem quebrar", () => {
    const abas = abasDoPipeline([negocio()], AGORA);
    expect(abas[0].linhas).toHaveLength(1);
  });
});

describe("nomeDaPlanilha", () => {
  it("leva a data de São Paulo, não a de UTC", () => {
    // 02:00 UTC do dia 13 ainda é dia 12 em São Paulo.
    expect(nomeDaPlanilha(new Date("2026-09-13T02:00:00Z"))).toBe("pipeline-aura-2026-09-12.xlsx");
  });
});

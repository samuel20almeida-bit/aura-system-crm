import { describe, expect, it } from "vitest";
import { montarCsvDoPipeline, nomeDoArquivoDoPipeline } from "./pipeline-export";
import { BOM } from "./csv";

const AGORA = new Date("2026-09-10T15:00:00Z");

function negocio(over: Partial<Parameters<typeof montarCsvDoPipeline>[0][number]> = {}) {
  return {
    estagio: "lead" as const,
    mexido_em: "2026-09-09T12:00:00Z",
    proximo_passo: "Ligar",
    proximo_passo_em: "2026-09-12",
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

function linhas(csv: string) {
  return csv.replace(BOM, "").split("\r\n");
}

describe("montarCsvDoPipeline", () => {
  it("traz empresa e contato na MESMA linha", () => {
    const [cabecalho, primeira] = linhas(montarCsvDoPipeline([negocio()], AGORA));
    expect(cabecalho.split(";").slice(0, 8)).toEqual([
      "Empresa",
      "Nicho",
      "Cidade",
      "UF",
      "Decisor",
      "E-mail",
      "Telefone",
      "Site",
    ]);
    expect(primeira).toContain("Barbearia do Zé");
    expect(primeira).toContain("ze@barbearia.com.br");
    expect(primeira).toContain("41999998888");
  });

  it("uma linha por negócio, mais o cabeçalho", () => {
    expect(linhas(montarCsvDoPipeline([negocio(), negocio(), negocio()], AGORA))).toHaveLength(4);
  });

  it("traduz o estágio para caixa de frase", () => {
    const csv = montarCsvDoPipeline([negocio({ estagio: "diagnostico" })], AGORA);
    expect(csv).toContain("Diagnóstico");
    expect(csv).not.toContain("diagnostico");
  });

  it("deixa a célula vazia quando o campo é nulo, sem escrever 'null'", () => {
    const csv = montarCsvDoPipeline(
      [negocio({ conta: { ...negocio().conta!, cidade: null, uf: null, email: null } })],
      AGORA
    );
    expect(csv).not.toContain("null");
  });

  it("sobrevive a negócio sem conta e sem dono", () => {
    const csv = montarCsvDoPipeline([negocio({ conta: null, dono: null })], AGORA);
    expect(csv).not.toContain("undefined");
    expect(linhas(csv)).toHaveLength(2);
  });

  it("converte o numeric que vem do Postgres em texto", () => {
    // PostgREST devolve `numeric` como string; sem a conversão a célula sairia
    // "299.00" com ponto e o Excel pt-BR leria como texto.
    const csv = montarCsvDoPipeline([negocio({ mrr: "299.50", setup: "1500.00" })], AGORA);
    expect(csv).toContain("299,5");
    expect(csv).not.toContain("299.50");
  });

  it("traz a situação e os dias parados, que são derivados e não colunas do banco", () => {
    const [cabecalho, primeira] = linhas(
      montarCsvDoPipeline([negocio({ mexido_em: "2026-08-20T12:00:00Z", proximo_passo: null, proximo_passo_em: null })], AGORA)
    );
    expect(cabecalho.endsWith("Situação;Dias parado")).toBe(true);
    expect(primeira.endsWith(";21")).toBe(true);
  });

  it("escapa o nome que contém o separador", () => {
    const csv = montarCsvDoPipeline([negocio({ conta: { ...negocio().conta!, nome: "Alfa; Beta" } })], AGORA);
    expect(csv).toContain(`"Alfa; Beta"`);
  });

  it("devolve só o cabeçalho quando o funil está vazio", () => {
    expect(linhas(montarCsvDoPipeline([], AGORA))).toHaveLength(1);
  });
});

describe("nomeDoArquivoDoPipeline", () => {
  it("carrega a data de São Paulo, não a de UTC", () => {
    // 03:00 UTC do dia 11 ainda é dia 10 em São Paulo. Sem o fuso, o arquivo
    // exportado à noite levaria a data de amanhã.
    expect(nomeDoArquivoDoPipeline(new Date("2026-09-11T02:00:00Z"))).toBe("pipeline-aura-2026-09-10.csv");
  });
});

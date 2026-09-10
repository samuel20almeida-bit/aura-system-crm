import { describe, expect, it } from "vitest";
import { montarCsv, BOM } from "./csv";

describe("montarCsv", () => {
  const colunas = [
    { chave: "nome", titulo: "Nome" },
    { chave: "cidade", titulo: "Cidade" },
  ] as const;

  it("escreve o cabeçalho e uma linha por registro", () => {
    const csv = montarCsv(colunas, [
      { nome: "Barbearia do Zé", cidade: "Curitiba" },
      { nome: "Studio Alfa", cidade: "Pinhais" },
    ]);
    expect(csv).toBe(`${BOM}Nome;Cidade\r\nBarbearia do Zé;Curitiba\r\nStudio Alfa;Pinhais`);
  });

  it("começa com BOM, sem o qual o Excel pt-BR mostra acento quebrado", () => {
    expect(montarCsv(colunas, [])).toBe(`${BOM}Nome;Cidade`);
  });

  it("separa por ponto e vírgula, que é o que o Excel pt-BR espera", () => {
    expect(montarCsv(colunas, [{ nome: "A", cidade: "B" }])).toContain("A;B");
  });

  it("aspeia o valor que contém o separador", () => {
    const csv = montarCsv(colunas, [{ nome: "Alfa; Beta", cidade: "Curitiba" }]);
    expect(csv).toContain(`"Alfa; Beta";Curitiba`);
  });

  it("dobra as aspas de dentro do valor aspeado", () => {
    const csv = montarCsv(colunas, [{ nome: 'Barbearia "do Zé"', cidade: "Curitiba" }]);
    expect(csv).toContain(`"Barbearia ""do Zé""";Curitiba`);
  });

  it("aspeia o valor com quebra de linha, para a linha não virar duas", () => {
    const csv = montarCsv(colunas, [{ nome: "Alfa\nBeta", cidade: "Curitiba" }]);
    expect(csv).toContain(`"Alfa\nBeta";Curitiba`);
    // Uma linha de dados só: as duas quebras de \r\n do arquivo são o
    // cabeçalho; a de dentro do valor está protegida pelas aspas.
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("trata nulo e indefinido como célula vazia, não como a palavra 'null'", () => {
    const csv = montarCsv(colunas, [{ nome: null, cidade: undefined }]);
    expect(csv).toBe(`${BOM}Nome;Cidade\r\n;`);
  });

  it("escreve número decimal com vírgula, senão o Excel pt-BR lê como texto", () => {
    const csv = montarCsv([{ chave: "mrr", titulo: "Mensalidade" }] as const, [{ mrr: 299.5 }]);
    expect(csv).toBe(`${BOM}Mensalidade\r\n299,5`);
  });

  it("mantém o inteiro sem casa decimal inventada", () => {
    const csv = montarCsv([{ chave: "n", titulo: "N" }] as const, [{ n: 12 }]);
    expect(csv).toBe(`${BOM}N\r\n12`);
  });

  it("não deixa o valor virar fórmula ao abrir na planilha", () => {
    // Nome de conta é texto que qualquer um digita. Sem isto, uma conta
    // chamada `=1+1` vira uma fórmula executada ao abrir o arquivo — o
    // caminho clássico de injeção em CSV.
    for (const perigoso of ["=1+1", "+SOMA(A1)", "@import", "-cmd"]) {
      const csv = montarCsv([{ chave: "x", titulo: "X" }] as const, [{ x: perigoso }]);
      expect(csv).toBe(`${BOM}X\r\n'${perigoso}`);
    }
  });

  it("não confunde número negativo com fórmula", () => {
    // `-50` começa com `-`, mas é número: prefixar com apóstrofo o
    // transformaria em texto e quebraria a soma da planilha.
    const csv = montarCsv([{ chave: "x", titulo: "X" }] as const, [{ x: -50 }]);
    expect(csv).toBe(`${BOM}X\r\n-50`);
  });

  it("aceita coluna derivada por função, não só por chave", () => {
    const csv = montarCsv(
      [{ chave: "nome", titulo: "Nome" }, { titulo: "Cidade/UF", valor: (r: { cidade: string; uf: string }) => `${r.cidade}/${r.uf}` }],
      [{ nome: "Alfa", cidade: "Curitiba", uf: "PR" }]
    );
    expect(csv).toBe(`${BOM}Nome;Cidade/UF\r\nAlfa;Curitiba/PR`);
  });

  it("devolve só o cabeçalho quando não há registro", () => {
    expect(montarCsv(colunas, [])).not.toContain("\r\n");
  });
});

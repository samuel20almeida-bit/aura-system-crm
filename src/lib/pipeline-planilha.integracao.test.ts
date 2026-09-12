import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import writeXlsxFile from "write-excel-file/node";
import { abasDoPipeline, type NegocioParaPlanilha } from "./pipeline-planilha";

/**
 * Os outros testes conferem as LINHAS; este confere o ARQUIVO.
 *
 * Existe por um motivo concreto: os tipos publicados do `write-excel-file`
 * declaram o valor da célula sem `null`, e `baixar-planilha.ts` faz um cast
 * afirmando que a implementação aceita. Uma afirmação dessas não pode viver só
 * num comentário — aqui o .xlsx é gerado de verdade, descompactado, e o XML de
 * dentro é lido. Se a biblioteca mudar de comportamento numa atualização, é
 * este teste que cai, e não a planilha do Samuel.
 */

const AGORA = new Date("2026-09-12T15:00:00Z");

function negocio(over: Partial<NegocioParaPlanilha> = {}): NegocioParaPlanilha {
  return {
    estagio: "lead",
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

async function gerar(negocios: NegocioParaPlanilha[]) {
  const abas = abasDoPipeline(negocios, AGORA);
  const buffer = await writeXlsxFile(
    abas.map((aba) => ({
      data: aba.linhas as never,
      sheet: aba.nome,
      columns: aba.larguras.map((width) => ({ width })),
      stickyRowsCount: 1,
    }))
  ).toBuffer();

  const arquivos = unzipSync(new Uint8Array(buffer));
  const ler = (caminho: string) => strFromU8(arquivos[caminho]);
  return { arquivos, ler };
}

describe("a planilha gerada de verdade", () => {
  it("é um .xlsx válido, com as peças que o Excel exige", async () => {
    const { arquivos } = await gerar([negocio()]);
    expect(Object.keys(arquivos)).toEqual(
      expect.arrayContaining(["[Content_Types].xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"])
    );
  });

  it("tem as duas abas, com os parados primeiro", async () => {
    const { ler } = await gerar([negocio()]);
    const workbook = ler("xl/workbook.xml");
    // `name` não é o primeiro atributo de `<sheet>` — vem depois de `r:id` e
    // `sheetId`. Casar a tag inteira e extrair o atributo evita depender da ordem.
    const nomes = [...workbook.matchAll(/<sheet\b[^>]*\bname="([^"]+)"/g)].map((m) => m[1]);
    expect(nomes).toEqual(["Parados", "Funil completo"]);
  });

  it("célula de dinheiro vazia fica VAZIA no arquivo — não vira zero", async () => {
    // Este é o caso que o cast em `baixar-planilha.ts` afirma funcionar.
    const { ler, arquivos } = await gerar([negocio({ proximo_passo: null, setup: null, mrr: null })]);

    // A aba 1 é "Parados"; sem próximo passo, o negócio cai nela.
    const sheet = ler("xl/worksheets/sheet1.xml");
    // `[\s\S]` no lugar de `.` com a flag `s`: o alvo do TypeScript deste
    // projeto é anterior a es2018, onde aquela flag não existe.
    const linhas = [...sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((m) => m[1]);
    expect(linhas).toHaveLength(2); // cabeçalho + o negócio

    // Setup e Mensalidade são a 12ª e a 13ª coluna (L e M).
    const celulas = [...linhas[1].matchAll(/<c r="([A-Z]+)\d+"[^>]*?(\/>|>([\s\S]*?)<\/c>)/g)];
    const conteudo = (col: string) => celulas.find((c) => c[1] === col)?.[3] ?? "";
    expect(conteudo("L")).toBe("");
    expect(conteudo("M")).toBe("");
    // E, acima de tudo: nenhum zero apareceu no lugar do branco.
    expect(conteudo("L")).not.toContain("<v>0</v>");
    expect(conteudo("M")).not.toContain("<v>0</v>");

    expect(arquivos["xl/worksheets/sheet2.xml"]).toBeDefined();
  });

  it("dinheiro preenchido chega como número, e não como texto", async () => {
    const { ler } = await gerar([negocio({ proximo_passo: null, mrr: "299.50" })]);
    const sheet = ler("xl/worksheets/sheet1.xml");
    // Coluna M = Mensalidade. Sem `t="s"` (string compartilhada) e com <v>
    // numérico: é assim que a planilha soma a coluna.
    const celulaM = sheet.match(/<c r="M2"[^>]*>([\s\S]*?)<\/c>/);
    expect(celulaM?.[0]).not.toContain('t="s"');
    expect(celulaM?.[1]).toContain("<v>299.5</v>");
  });

  it("o acento sobrevive à ida e volta pelo arquivo", async () => {
    const { ler } = await gerar([negocio({ proximo_passo: null })]);
    const compartilhadas = ler("xl/sharedStrings.xml");
    expect(compartilhadas).toContain("Barbearia do Zé");
    expect(compartilhadas).toContain("Prospecção fria");
    // E os títulos com acento, que são os que todo mundo lê primeiro.
    expect(compartilhadas).toContain("Estágio");
    expect(compartilhadas).toContain("Última movimentação");
  });

  it("o cabeçalho fica congelado nas duas abas", async () => {
    const { ler } = await gerar([negocio()]);
    for (const aba of ["sheet1", "sheet2"]) {
      expect(ler(`xl/worksheets/${aba}.xml`)).toContain("ySplit");
    }
  });

  it("a aba de parados vazia continua gerando um arquivo abrível", async () => {
    // Funil inteiro saudável: "Parados" fica só com o cabeçalho.
    const { ler } = await gerar([negocio()]);
    const linhas = [...ler("xl/worksheets/sheet1.xml").matchAll(/<row[^>]*>/g)];
    expect(linhas).toHaveLength(1);
  });
});

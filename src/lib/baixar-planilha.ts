import type { SheetData } from "write-excel-file/browser";
import type { AbaDaPlanilha } from "./pipeline-planilha";

/**
 * Entrega o .xlsx ao navegador.
 *
 * O `import()` é DINÂMICO de propósito. A biblioteca pesa alguns milhares de
 * linhas para montar o zip e o XML do Excel, e ninguém que abre o Pipeline
 * para olhar o funil deveria pagar por ela. Assim o custo só aparece no clique
 * — e quem nunca exporta nunca baixa nada disso.
 *
 * Mora num arquivo separado de `pipeline-planilha.ts` para que aquele continue
 * sendo lógica pura, testável sem carregar biblioteca nenhuma.
 */
export async function baixarPlanilha(nomeDoArquivo: string, abas: AbaDaPlanilha[]) {
  // `import type`, acima, é apagado na compilação: o único caminho em tempo de
  // execução continua sendo este `import()`.
  const { default: writeXlsxFile } = await import("write-excel-file/browser");

  await writeXlsxFile(
    abas.map((aba) => ({
      // O CAST, e só ele.
      //
      // Os tipos publicados da biblioteca declaram o valor da célula como
      // `String | Date | Number | Boolean`, sem `null`. A implementação aceita
      // `null` e o trata como célula em branco — `isEmpty()` em
      // `sheet.xml/row.js` testa `undefined`, `null` e `""` antes de olhar o
      // tipo. Conferido no fonte e provado gerando um arquivo de verdade
      // (`pipeline-planilha.integracao.test.ts`).
      //
      // Trocar `null` por `undefined` faria o tipo fechar sem cast, mas
      // apagaria a distinção que o resto do projeto mantém entre "vazio" e
      // "não informado" — e é justamente ela que impede uma coluna de dinheiro
      // vazia de virar zero.
      data: aba.linhas as unknown as SheetData,
      sheet: aba.nome,
      columns: aba.larguras.map((width) => ({ width })),
      // Congela o cabeçalho: numa aba com centenas de linhas, rolar até o meio
      // e não saber mais qual coluna é qual é o defeito mais comum de planilha
      // exportada.
      stickyRowsCount: 1,
    })),
    { fontFamily: "Calibri", fontSize: 11 }
  ).toFile(nomeDoArquivo);
}

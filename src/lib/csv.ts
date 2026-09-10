/**
 * Montar CSV que o Excel em português abre CERTO.
 *
 * Três decisões que parecem detalhe e decidem se o arquivo é utilizável ou se
 * o Samuel vai reclamar que "abriu tudo numa coluna só":
 *
 * 1. O separador é `;`, e não vírgula. O Excel usa o separador de lista do
 *    sistema, que em pt-BR é ponto e vírgula. Com vírgula, a planilha inteira
 *    cai na coluna A.
 * 2. O arquivo começa com BOM. Sem ele o Excel assume a codificação do
 *    sistema (não UTF-8) e "Barbearia do Zé" vira "Barbearia do ZÃ©".
 * 3. Decimal com vírgula. Com ponto, `299.5` entra como texto e não soma.
 *
 * As três só valem juntas: vírgula decimal com separador vírgula seria
 * ambíguo, e é justamente por isso que o separador tem de ser `;`.
 */

/** Byte order mark. Ver o item 2 acima — é o que faz o acento chegar inteiro. */
export const BOM = "﻿";

export type Coluna<T> =
  | { titulo: string; chave: keyof T & string; valor?: never }
  | { titulo: string; valor: (registro: T) => unknown; chave?: never };

/**
 * O que uma planilha faz com um valor que começa com `=`, `+`, `-` ou `@`:
 * trata como fórmula e executa ao abrir. Como todo nome de conta aqui é texto
 * que alguém digitou, um registro chamado `=1+1` viraria código rodando na
 * máquina de quem abriu o export. O apóstrofo à frente é a defesa padrão —
 * a planilha o consome e mostra o texto original.
 *
 * Só vale para TEXTO. `-50` também começa com `-` e é número: prefixá-lo
 * transformaria a coluna de valores em coluna de texto, e a soma da planilha
 * pararia de funcionar.
 */
function protegerContraFormula(texto: string): string {
  return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
}

function celula(valor: unknown): string {
  if (valor === null || valor === undefined) return "";

  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) return "";
    // `String(299.5)` dá "299.5"; a planilha pt-BR quer "299,5". Inteiro não
    // ganha casa decimal inventada, por isso a troca é textual e não um
    // `toFixed`.
    return String(valor).replace(".", ",");
  }

  const texto = protegerContraFormula(String(valor));

  // Aspas só quando precisam: um arquivo com tudo aspeado é válido, mas fica
  // ilegível para quem abre no editor de texto para conferir.
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * `\r\n` entre as linhas porque é o que o RFC 4180 pede e o que o Excel
 * espera; a quebra de linha DENTRO de um valor continua sendo `\n` e fica
 * protegida pelas aspas.
 */
export function montarCsv<T>(colunas: readonly Coluna<T>[], registros: readonly T[]): string {
  const cabecalho = colunas.map((c) => celula(c.titulo)).join(";");

  const linhas = registros.map((registro) =>
    colunas
      .map((coluna) => celula(coluna.valor ? coluna.valor(registro) : registro[coluna.chave as keyof T]))
      .join(";")
  );

  return BOM + [cabecalho, ...linhas].join("\r\n");
}

/**
 * Data no formato que a planilha brasileira reconhece. Fora daqui o projeto
 * usa `formatDate`, que serve à tela; este serve ao arquivo.
 */
export function dataParaCsv(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Entrega o arquivo ao navegador. Vive aqui, junto de quem monta o conteúdo,
 * para que nenhuma tela precise reinventar o `Blob` e o link temporário.
 *
 * `text/csv;charset=utf-8` combinado com o BOM: o cabeçalho convence o
 * navegador, o BOM convence o Excel. Os dois são necessários.
 */
export function baixarCsv(nomeDoArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeDoArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Sem isto o blob fica na memória da aba até ela fechar. Numa tela que
  // exporta várias vezes por dia, é vazamento acumulado.
  URL.revokeObjectURL(url);
}

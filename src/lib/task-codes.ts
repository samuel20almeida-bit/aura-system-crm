const COM_ACENTO = "áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ";
const SEM_ACENTO = "aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC";

/**
 * O prefixo do código da tarefa, derivado do nome da conta: três primeiras
 * letras, sem acento, em maiúsculas.
 *
 * A MESMA REGRA existe em SQL, no backfill da migration 0020. Não dá para o
 * banco chamar esta função nem o contrário sem inventar infraestrutura; o que
 * evita divergência é o teste, que cobre os mesmos casos que o `translate` de
 * lá. Mudar a regra obriga a tocar os dois lugares.
 *
 * `"INT"` quando o nome não produz letra nenhuma — prefixo vazio geraria
 * códigos como "-01". É o mesmo destino que a leitura dá a `code_prefix` nulo.
 */
export function derivePrefixoDaConta(nome: string): string {
  let saida = "";
  for (const caractere of nome.trim()) {
    const posicao = COM_ACENTO.indexOf(caractere);
    saida += posicao === -1 ? caractere : SEM_ACENTO[posicao];
    if (saida.length === 3) break;
  }
  return saida === "" ? "INT" : saida.toUpperCase();
}

/** Maior sufixo numérico entre códigos no formato PREFIXO-NN. */
export function highestCodeNumber(codes: string[]): number {
  let max = 0;
  for (const code of codes) {
    const n = parseInt(code.split("-")[1] ?? "", 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max;
}

/** `count` códigos sequenciais a partir de `start`, com dois dígitos no mínimo. */
export function buildSequentialCodes(prefix: string, start: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(start + i).padStart(2, "0")}`);
}

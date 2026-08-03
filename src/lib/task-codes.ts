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

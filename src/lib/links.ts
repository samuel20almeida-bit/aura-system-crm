/**
 * Normaliza um endereço colado no campo de link de anexo.
 *
 * O Chrome mostra "figma.com/file/abc" na barra de endereços, sem o https://.
 * Colado cru, esse valor ia parar no href de um <a> e o navegador o resolvia
 * como caminho RELATIVO: o clique navegava para /kanban/figma.com/file/abc e
 * dava 404, sem erro em momento nenhum — nem ao anexar, nem ao clicar.
 *
 * Regras: sem esquema, assume https://. Com esquema, só http: e https: passam —
 * javascript:, data: e afins viram href executável ou inútil dentro do app.
 */
export type NormalizedLink = { ok: true; url: string } | { ok: false; message: string };

/** "figma.com" não casa; "https:", "mailto:" e "javascript:" casam. */
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export function normalizeLinkUrl(raw: string): NormalizedLink {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: "Cole um endereço antes de anexar." };
  }

  const candidate = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, message: "Endereço inválido — cole um link começando com https://" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, message: "Só dá para anexar links http:// ou https://" };
  }

  if (!parsed.hostname) {
    return { ok: false, message: "Endereço inválido — cole um link começando com https://" };
  }

  return { ok: true, url: parsed.toString() };
}

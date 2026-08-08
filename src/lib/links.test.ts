import { describe, it, expect } from "vitest";
import { normalizeLinkUrl } from "./links";

function url(raw: string) {
  const result = normalizeLinkUrl(raw);
  if (!result.ok) throw new Error(`esperava um link válido, veio: ${result.message}`);
  return result.url;
}

function rejection(raw: string) {
  const result = normalizeLinkUrl(raw);
  if (result.ok) throw new Error(`esperava recusa, veio: ${result.url}`);
  return result.message;
}

describe("normalizeLinkUrl", () => {
  it("prefixa https:// no que o Chrome mostra na barra de endereços", () => {
    // O caso real: colado cru, o <a href> resolvia isto como caminho relativo e
    // o clique ia para /kanban/figma.com/file/abc.
    expect(url("figma.com/file/abc")).toBe("https://figma.com/file/abc");
  });

  it("preserva um link que já veio com https://", () => {
    expect(url("https://figma.com/file/abc")).toBe("https://figma.com/file/abc");
  });

  it("aceita http:// sem promover para https", () => {
    expect(url("http://intranet.local/arquivo.pdf")).toBe("http://intranet.local/arquivo.pdf");
  });

  it("ignora espaços em volta", () => {
    expect(url("  drive.google.com/file/d/123  ")).toBe("https://drive.google.com/file/d/123");
  });

  it("preserva query e fragmento", () => {
    expect(url("figma.com/file/abc?node-id=1%3A2#comentario")).toBe(
      "https://figma.com/file/abc?node-id=1%3A2#comentario"
    );
  });

  it("recusa javascript: em vez de gravá-lo num href", () => {
    expect(rejection("javascript:alert(1)")).toBe("Só dá para anexar links http:// ou https://");
  });

  it("recusa data:", () => {
    expect(rejection("data:text/html,<h1>oi</h1>")).toBe("Só dá para anexar links http:// ou https://");
  });

  it("recusa mailto:", () => {
    expect(normalizeLinkUrl("mailto:alguem@exemplo.com").ok).toBe(false);
  });

  it("recusa campo vazio ou só espaços", () => {
    expect(rejection("")).toBe("Cole um endereço antes de anexar.");
    expect(rejection("   ")).toBe("Cole um endereço antes de anexar.");
  });

  it("recusa um endereço que nem parseia", () => {
    expect(rejection("https://")).toBe("Endereço inválido — cole um link começando com https://");
  });

  it("devolve mensagens em português", () => {
    for (const raw of ["", "javascript:alert(1)", "https://"]) {
      expect(rejection(raw)).toMatch(/[çãáéíó]|Cole|Só dá|inválido/);
    }
  });
});

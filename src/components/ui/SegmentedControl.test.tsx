import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SegmentedControl } from "./SegmentedControl";

/**
 * O que este teste protege é o estado anunciado, não a aparência.
 *
 * A marca visual do selecionado (`bg-ink`) e a marca acessível
 * (`aria-current` / `aria-pressed`) são escritas em lugares diferentes do
 * componente. Nada no portão liga uma à outra: dá para trocar a cor, inverter
 * a condição ou apagar o atributo e o app continua compilando, com a interface
 * idêntica para quem enxerga e muda para quem usa leitor de tela. Era
 * exatamente esse o estado dos seis controles escritos à mão que este
 * componente substitui — nenhum deles anunciava nada.
 *
 * Também fixa a regra de qual atributo sai em cada caso: seleção que mora na
 * URL é `aria-current="page"` (a opção é um link para outra página); seleção
 * que mora no estado local é `aria-pressed` (a opção é um botão que alterna).
 * Trocar um pelo outro é errado das duas formas, e é invisível sem teste.
 */
describe("SegmentedControl", () => {
  const comHref = [
    { valor: "todos", rotulo: "Todos", href: "/hoje" },
    { valor: "ana", rotulo: "Ana", href: "/hoje?dono=ana" },
  ];
  const semHref = [
    { valor: "board", rotulo: "Board" },
    { valor: "list", rotulo: "Lista" },
  ];

  it("dá nome ao grupo, para o leitor de tela não anunciar N botões soltos", () => {
    const html = renderToStaticMarkup(
      <SegmentedControl opcoes={semHref} valor="board" rotuloAcessivel="Modo de visualização" />
    );
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Modo de visualização"');
  });

  it('marca a opção da URL com aria-current="page", e só ela', () => {
    const html = renderToStaticMarkup(
      <SegmentedControl opcoes={comHref} valor="ana" rotuloAcessivel="Dono" />
    );
    expect(html.match(/aria-current="page"/g) ?? []).toHaveLength(1);
    // E tem de estar no <a> da Ana, não no dos Todos. A busca é pela tag
    // inteira: `aria-current` sai ANTES do `href` na marcação, então fatiar a
    // partir do href perderia o atributo que se quer conferir.
    const tags = html.match(/<a\b[^>]*>/g) ?? [];
    const ana = tags.find((t) => t.includes('href="/hoje?dono=ana"'));
    const todos = tags.find((t) => t.includes('href="/hoje"'));
    expect(ana).toContain('aria-current="page"');
    expect(todos).not.toContain("aria-current");
  });

  it("marca a opção de estado local com aria-pressed, e a não selecionada com false", () => {
    const html = renderToStaticMarkup(
      <SegmentedControl opcoes={semHref} valor="list" rotuloAcessivel="Modo" />
    );
    expect(html.match(/aria-pressed="true"/g) ?? []).toHaveLength(1);
    expect(html.match(/aria-pressed="false"/g) ?? []).toHaveLength(1);
  });

  it("não usa aria-current em opção sem href, nem aria-pressed em opção com href", () => {
    const comLink = renderToStaticMarkup(
      <SegmentedControl opcoes={comHref} valor="todos" rotuloAcessivel="Dono" />
    );
    const comBotao = renderToStaticMarkup(
      <SegmentedControl opcoes={semHref} valor="board" rotuloAcessivel="Modo" />
    );
    expect(comLink).not.toContain("aria-pressed");
    expect(comBotao).not.toContain("aria-current");
  });

  it("a marca visual acompanha a marca acessível", () => {
    const html = renderToStaticMarkup(
      <SegmentedControl opcoes={semHref} valor="list" rotuloAcessivel="Modo" />
    );
    // Um selecionado anunciado, um selecionado pintado. Se alguém mexer só num
    // dos dois lados, esta contagem deixa de bater.
    expect(html.match(/aria-pressed="true"/g) ?? []).toHaveLength(1);
    expect(html.match(/bg-ink/g) ?? []).toHaveLength(1);
  });

  it("a pílula não desenha divisória entre as opções", () => {
    const controle = renderToStaticMarkup(
      <SegmentedControl opcoes={semHref} valor="board" rotuloAcessivel="Modo" />
    );
    const pilula = renderToStaticMarkup(
      <SegmentedControl opcoes={semHref} valor="board" rotuloAcessivel="Modo" formato="pilula" />
    );
    expect(controle).toContain("border-r");
    expect(pilula).not.toContain("border-r");
    expect(pilula).toContain("rounded-full");
  });
});

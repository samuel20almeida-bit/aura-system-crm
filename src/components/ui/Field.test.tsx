import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Field, Input, Select, Textarea } from "./Field";

/**
 * O primeiro teste de componente do projeto, e ele existe por um motivo
 * estreito: a ligação entre rótulo e campo é feita por contexto, e nenhuma
 * ferramenta do portão a verifica. O TypeScript aceita um provedor sem
 * consumidor; o lint também. Se alguém desfizer a fiação, o app continua
 * compilando e a interface continua igual — só o clique no rótulo para de
 * focar o campo, e o leitor de tela volta a anunciar "caixa de edição" sem
 * dizer de quê. É exatamente o tipo de regressão silenciosa que o resto do
 * portão não pega.
 *
 * Não traz infraestrutura nova: renderiza com o `react-dom/server` que já é
 * dependência, sem DOM e sem biblioteca de teste de componente.
 */
function ids(html: string) {
  return {
    forId: html.match(/for="([^"]+)"/)?.[1],
    ctrlId: html.match(/id="([^"]+)"/)?.[1],
  };
}

describe("Field liga o rótulo ao campo", () => {
  it("liga um Input", () => {
    const { forId, ctrlId } = ids(
      renderToStaticMarkup(
        <Field label="NOME">
          <Input />
        </Field>
      )
    );
    expect(forId).toBeTruthy();
    expect(ctrlId).toBe(forId);
  });

  it("liga um Select", () => {
    const { forId, ctrlId } = ids(
      renderToStaticMarkup(
        <Field label="CONTA">
          <Select />
        </Field>
      )
    );
    expect(ctrlId).toBe(forId);
  });

  it("liga um Textarea", () => {
    const { forId, ctrlId } = ids(
      renderToStaticMarkup(
        <Field label="NOTAS">
          <Textarea />
        </Field>
      )
    );
    expect(ctrlId).toBe(forId);
  });

  it("um id passado por prop vence o do contexto", () => {
    const html = renderToStaticMarkup(
      <Field label="X">
        <Input id="meu-id" />
      </Field>
    );
    expect(html).toContain('id="meu-id"');
  });

  it("funciona com filho condicional", () => {
    // O caso real de CATEGORIA (CredentialModal) e ÁREA (NewTaskModal): o
    // filho alterna entre Input e Select. É por causa dele que a ligação usa
    // contexto em vez de clonar o filho — cloneElement exigiria filho único.
    const { forId, ctrlId } = ids(
      renderToStaticMarkup(<Field label="AREA">{false ? <Input /> : <Select />}</Field>)
    );
    expect(ctrlId).toBe(forId);
  });

  it("dois campos na mesma tela não repetem id", () => {
    const html = renderToStaticMarkup(
      <>
        <Field label="A">
          <Input />
        </Field>
        <Field label="B">
          <Input />
        </Field>
      </>
    );
    const todos = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(todos).size).toBe(todos.length);
  });
});

import { describe, it, expect } from "vitest";
import { moveItem, reorderWithin, findColumnIn, type Columns } from "./optimistic";

type Item = { id: string };
type Coluna3 = "todo" | "in_progress" | "done";
const COLS3: Coluna3[] = ["todo", "in_progress", "done"];

function makeColumns(): Columns<Item, Coluna3> {
  return {
    todo: [{ id: "a" }, { id: "b" }],
    in_progress: [{ id: "c" }],
    done: [],
  };
}

describe("reorderWithin", () => {
  it("move um item para a posição de outro", () => {
    const result = reorderWithin([{ id: "a" }, { id: "b" }, { id: "c" }], "c", "a");
    expect(result.map((i) => i.id)).toEqual(["c", "a", "b"]);
  });

  it("devolve a lista intacta quando o id não existe", () => {
    const items = [{ id: "a" }, { id: "b" }];
    expect(reorderWithin(items, "z", "a").map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("moveItem", () => {
  it("move entre colunas inserindo antes do item indicado", () => {
    const result = moveItem(makeColumns(), COLS3, "a", "in_progress", "c");
    expect(result.todo.map((i) => i.id)).toEqual(["b"]);
    expect(result.in_progress.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("acrescenta ao fim quando não há item de referência", () => {
    const result = moveItem(makeColumns(), COLS3, "a", "done", null);
    expect(result.done.map((i) => i.id)).toEqual(["a"]);
    expect(result.todo.map((i) => i.id)).toEqual(["b"]);
  });

  it("reordena dentro da mesma coluna", () => {
    const result = moveItem(makeColumns(), COLS3, "b", "todo", "a");
    expect(result.todo.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("devolve o estado intacto quando o item não existe", () => {
    const before = makeColumns();
    const result = moveItem(before, COLS3, "inexistente", "done", null);
    expect(result).toEqual(before);
  });
});

describe("findColumnIn", () => {
  it("encontra o item na coluna certa", () => {
    expect(findColumnIn(makeColumns(), COLS3, "a")).toBe("todo");
  });

  it("devolve null para id inexistente", () => {
    expect(findColumnIn(makeColumns(), COLS3, "inexistente")).toBeNull();
  });

  it("devolve a coluna correta quando o item está numa coluna que não é a primeira", () => {
    expect(findColumnIn(makeColumns(), COLS3, "c")).toBe("in_progress");
  });
});

// Prova de genericidade: um conjunto de colunas totalmente diferente do
// Kanban — cinco estágios de negócio, não três status de tarefa — usando as
// mesmas três funções sem nenhuma duplicação de módulo.
describe("genérico em qualquer conjunto de colunas (estágios do Pipeline)", () => {
  type Estagio = "lead" | "contato" | "qualificado" | "diagnostico" | "proposta";
  const ESTAGIOS: Estagio[] = ["lead", "contato", "qualificado", "diagnostico", "proposta"];

  function makePipeline(): Columns<Item, Estagio> {
    return {
      lead: [{ id: "d1" }],
      contato: [],
      qualificado: [{ id: "d2" }],
      diagnostico: [],
      proposta: [],
    };
  }

  it("move um negócio de lead para proposta, pulando três estágios", () => {
    const result = moveItem(makePipeline(), ESTAGIOS, "d1", "proposta", null);
    expect(result.lead).toEqual([]);
    expect(result.proposta.map((i) => i.id)).toEqual(["d1"]);
  });

  it("encontra o negócio no estágio certo", () => {
    expect(findColumnIn(makePipeline(), ESTAGIOS, "d2")).toBe("qualificado");
  });
});

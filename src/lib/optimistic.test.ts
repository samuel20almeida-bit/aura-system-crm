import { describe, it, expect } from "vitest";
import { moveItem, reorderWithin, type Columns } from "./optimistic";

type Item = { id: string };

function makeColumns(): Columns<Item> {
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
    const result = moveItem(makeColumns(), "a", "in_progress", "c");
    expect(result.todo.map((i) => i.id)).toEqual(["b"]);
    expect(result.in_progress.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("acrescenta ao fim quando não há item de referência", () => {
    const result = moveItem(makeColumns(), "a", "done", null);
    expect(result.done.map((i) => i.id)).toEqual(["a"]);
    expect(result.todo.map((i) => i.id)).toEqual(["b"]);
  });

  it("reordena dentro da mesma coluna", () => {
    const result = moveItem(makeColumns(), "b", "todo", "a");
    expect(result.todo.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("devolve o estado intacto quando o item não existe", () => {
    const before = makeColumns();
    const result = moveItem(before, "inexistente", "done", null);
    expect(result).toEqual(before);
  });
});

import { describe, it, expect } from "vitest";
import { addToast, removeToast, type Toast } from "./toast-store";

describe("toast-store", () => {
  it("coloca o aviso mais novo no topo", () => {
    const a = addToast([], { tone: "success", message: "primeiro" }, "1");
    const b = addToast(a, { tone: "error", message: "segundo" }, "2");
    expect(b.map((t) => t.message)).toEqual(["segundo", "primeiro"]);
  });

  it("mantém no máximo 3 avisos, descartando o mais antigo", () => {
    let list: Toast[] = [];
    for (const n of ["1", "2", "3", "4"]) {
      list = addToast(list, { tone: "info", message: n }, n);
    }
    expect(list.map((t) => t.message)).toEqual(["4", "3", "2"]);
  });

  it("remove pelo id", () => {
    const list = addToast(addToast([], { tone: "info", message: "a" }, "1"), { tone: "info", message: "b" }, "2");
    expect(removeToast(list, "1").map((t) => t.id)).toEqual(["2"]);
  });

  it("preserva a função de desfazer", () => {
    const undo = () => {};
    const list = addToast([], { tone: "success", message: "excluída", undo }, "1");
    expect(list[0].undo).toBe(undo);
  });
});

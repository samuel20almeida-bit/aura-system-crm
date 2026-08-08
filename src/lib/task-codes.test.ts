import { describe, it, expect } from "vitest";
import { buildSequentialCodes, highestCodeNumber } from "./task-codes";

describe("highestCodeNumber", () => {
  it("devolve 0 para lista vazia", () => {
    expect(highestCodeNumber([])).toBe(0);
  });

  it("pega o maior número, não a quantidade de itens", () => {
    // O bug original: com uma tarefa excluída, a contagem (2) ficava
    // menor que o maior sufixo (5), gerando código repetido.
    expect(highestCodeNumber(["NIM-01", "NIM-05"])).toBe(5);
  });

  it("ignora sufixos não numéricos", () => {
    expect(highestCodeNumber(["NIM-01", "NIM-abc", "NIM-03"])).toBe(3);
  });

  it("lida com números de dois ou mais dígitos", () => {
    expect(highestCodeNumber(["INT-09", "INT-10", "INT-100"])).toBe(100);
  });
});

describe("buildSequentialCodes", () => {
  it("gera a quantidade pedida em sequência", () => {
    expect(buildSequentialCodes("NIM", 3, 3)).toEqual(["NIM-03", "NIM-04", "NIM-05"]);
  });

  it("preenche com zero à esquerda até dois dígitos", () => {
    expect(buildSequentialCodes("INT", 1, 1)).toEqual(["INT-01"]);
  });

  it("não trunca acima de 99", () => {
    expect(buildSequentialCodes("INT", 100, 1)).toEqual(["INT-100"]);
  });

  it("devolve lista vazia quando count é 0", () => {
    expect(buildSequentialCodes("NIM", 1, 0)).toEqual([]);
  });

  it("nunca repete um código já existente", () => {
    const existentes = ["NIM-01", "NIM-05"];
    const novos = buildSequentialCodes("NIM", highestCodeNumber(existentes) + 1, 3);
    expect(novos).toEqual(["NIM-06", "NIM-07", "NIM-08"]);
    expect(novos.some((c) => existentes.includes(c))).toBe(false);
  });
});

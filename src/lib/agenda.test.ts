import { describe, it, expect } from "vitest";
import {
  gradeDoMes,
  diaDaReuniao,
  agruparPorDia,
  rotuloDoMes,
  rotuloDoDia,
} from "./agenda";

/**
 * Estes testes existem por um motivo estreito: a grade e o agrupamento
 * trabalham com INSTANTES e desenham DIAS, e a conversão entre os dois é onde
 * um calendário erra sem avisar. A Vercel roda em UTC; São Paulo é UTC-3.
 * Uma reunião às 23h aparece no quadrado do dia seguinte se o fuso escapar, e
 * o único sintoma é a reunião estar no lugar errado — nada quebra.
 */
describe("diaDaReuniao", () => {
  it("usa o fuso do app, não o UTC", () => {
    // 02:00 UTC do dia 29 é 23:00 do dia 28 em São Paulo.
    expect(diaDaReuniao("2026-08-29T02:00:00Z")).toBe("2026-08-28");
  });

  it("meio-dia não é ambíguo em nenhum dos dois", () => {
    expect(diaDaReuniao("2026-08-28T15:00:00Z")).toBe("2026-08-28");
  });

  it("a virada do dia em São Paulo é às 03:00 UTC", () => {
    expect(diaDaReuniao("2026-08-28T02:59:00Z")).toBe("2026-08-27");
    expect(diaDaReuniao("2026-08-28T03:00:00Z")).toBe("2026-08-28");
  });
});

describe("gradeDoMes", () => {
  it("tem sempre 42 quadrados, para a tela não pular de tamanho", () => {
    expect(gradeDoMes(2026, 7)).toHaveLength(42);
    expect(gradeDoMes(2026, 1)).toHaveLength(42); // fevereiro
    expect(gradeDoMes(2024, 1)).toHaveLength(42); // fevereiro bissexto
  });

  it("começa num domingo", () => {
    for (const mes of [0, 1, 6, 7, 11]) {
      const grade = gradeDoMes(2026, mes);
      const primeiro = new Date(`${grade[0].chave}T12:00:00Z`);
      expect(primeiro.getUTCDay()).toBe(0);
    }
  });

  it("o número do quadrado bate com a chave — nenhum escorrega de dia", () => {
    // Este é o teste que pega o erro de construir os dias à meia-noite:
    // `2026-08-01T00:00:00Z` é 31 de julho em São Paulo, então a chave diria
    // "2026-07-31" enquanto o número diria 1.
    for (const mes of [0, 2, 7, 11]) {
      for (const dia of gradeDoMes(2026, mes)) {
        expect(Number(dia.chave.slice(8, 10))).toBe(dia.numero);
      }
    }
  });

  it("agosto de 2026 tem 31 dias marcados como do mês", () => {
    const grade = gradeDoMes(2026, 7);
    expect(grade.filter((d) => d.doMes)).toHaveLength(31);
  });

  it("fevereiro bissexto tem 29", () => {
    expect(gradeDoMes(2024, 1).filter((d) => d.doMes)).toHaveLength(29);
  });

  it("os dias de fora vêm antes e depois, nunca no meio", () => {
    const grade = gradeDoMes(2026, 7);
    const primeiroDoMes = grade.findIndex((d) => d.doMes);
    const ultimoDoMes = grade.length - 1 - [...grade].reverse().findIndex((d) => d.doMes);
    for (let i = primeiroDoMes; i <= ultimoDoMes; i++) {
      expect(grade[i].doMes).toBe(true);
    }
  });

  it("a virada de ano não quebra a sequência", () => {
    const dezembro = gradeDoMes(2026, 11);
    expect(dezembro.some((d) => d.chave.startsWith("2027-01"))).toBe(true);
    const janeiro = gradeDoMes(2027, 0);
    expect(janeiro.some((d) => d.chave.startsWith("2026-12"))).toBe(true);
  });
});

describe("agruparPorDia", () => {
  const reunioes = [
    { id: "a", aconteceEm: "2026-08-28T15:00:00Z" },
    { id: "b", aconteceEm: "2026-08-28T18:00:00Z" },
    { id: "c", aconteceEm: "2026-08-29T02:00:00Z" }, // 23h do dia 28 em SP
    { id: "d", aconteceEm: "2026-08-30T15:00:00Z" },
  ];

  it("junta no dia do app, não no dia UTC", () => {
    const mapa = agruparPorDia(reunioes);
    expect(mapa.get("2026-08-28")?.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(mapa.get("2026-08-30")?.map((r) => r.id)).toEqual(["d"]);
    expect(mapa.has("2026-08-29")).toBe(false);
  });

  it("não perde nem duplica nada", () => {
    const mapa = agruparPorDia(reunioes);
    const total = [...mapa.values()].reduce((s, l) => s + l.length, 0);
    expect(total).toBe(reunioes.length);
  });

  it("lista vazia devolve mapa vazio", () => {
    expect(agruparPorDia([]).size).toBe(0);
  });
});

describe("rótulos", () => {
  it("o mês vem por extenso e em português", () => {
    expect(rotuloDoMes(2026, 7)).toContain("agosto");
    expect(rotuloDoMes(2026, 7)).toContain("2026");
  });

  it("o dia não escorrega ao ser formatado", () => {
    // A chave é dia puro. Formatar em UTC a partir do meio-dia UTC preserva.
    expect(rotuloDoDia("2026-08-30")).toContain("30");
    expect(rotuloDoDia("2026-08-30")).toContain("agosto");
    expect(rotuloDoDia("2026-01-01")).toContain("1");
    expect(rotuloDoDia("2026-01-01")).toContain("janeiro");
  });
});

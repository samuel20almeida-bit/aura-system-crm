import { describe, it, expect } from "vitest";
import { addDaysToDateStr, currentQuarterInAppTz, todayInAppTz } from "./timezone";

describe("timezone (smoke)", () => {
  it("resolve o trimestre em BRT, não em UTC, na virada do ano", () => {
    // 2027-01-01 02:00 UTC == 2026-12-31 23:00 em Brasília
    expect(currentQuarterInAppTz(new Date("2027-01-01T02:00:00Z"))).toBe("2026-Q4");
  });

  it("todayInAppTz devolve uma data YYYY-MM-DD", () => {
    expect(todayInAppTz()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("addDaysToDateStr", () => {
  it("soma dias dentro do mesmo mês", () => {
    expect(addDaysToDateStr("2026-08-08", 7)).toBe("2026-08-15");
  });

  it("atravessa a virada de mês", () => {
    expect(addDaysToDateStr("2026-08-28", 7)).toBe("2026-09-04");
  });

  it("atravessa a virada de ano", () => {
    expect(addDaysToDateStr("2026-12-30", 7)).toBe("2027-01-06");
  });

  it("respeita o 29 de fevereiro de um ano bissexto", () => {
    expect(addDaysToDateStr("2028-02-27", 3)).toBe("2028-03-01");
    expect(addDaysToDateStr("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("aceita deslocamento negativo", () => {
    expect(addDaysToDateStr("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("não desloca o dia: a data devolvida é a mesma do calendário, não meia-noite UTC", () => {
    // É a garantia que faz o contador "vencendo esta semana" concordar com o
    // sino: nenhum horário entra na conta.
    expect(addDaysToDateStr("2026-08-08", 0)).toBe("2026-08-08");
  });
});

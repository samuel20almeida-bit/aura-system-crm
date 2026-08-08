import { describe, it, expect } from "vitest";
import { elapsedMinutes } from "./time-math";

describe("elapsedMinutes", () => {
  it("converte duas horas em 120 minutos", () => {
    expect(elapsedMinutes("2026-08-03T09:00:00Z", "2026-08-03T11:00:00Z")).toBe(120);
  });

  it("arredonda para o minuto mais próximo", () => {
    expect(elapsedMinutes("2026-08-03T09:00:00Z", "2026-08-03T09:01:40Z")).toBe(2);
  });

  it("nunca devolve menos de 1 minuto", () => {
    expect(elapsedMinutes("2026-08-03T09:00:00Z", "2026-08-03T09:00:05Z")).toBe(1);
  });

  it("nunca devolve valor negativo quando o fim antecede o início", () => {
    expect(elapsedMinutes("2026-08-03T11:00:00Z", "2026-08-03T09:00:00Z")).toBe(1);
  });

  it("aceita objetos Date", () => {
    expect(elapsedMinutes(new Date("2026-08-03T09:00:00Z"), new Date("2026-08-03T10:30:00Z"))).toBe(90);
  });
});

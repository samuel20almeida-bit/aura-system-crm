import { describe, it, expect } from "vitest";
import { currentQuarterInAppTz, todayInAppTz } from "./timezone";

describe("timezone (smoke)", () => {
  it("resolve o trimestre em BRT, não em UTC, na virada do ano", () => {
    // 2027-01-01 02:00 UTC == 2026-12-31 23:00 em Brasília
    expect(currentQuarterInAppTz(new Date("2027-01-01T02:00:00Z"))).toBe("2026-Q4");
  });

  it("todayInAppTz devolve uma data YYYY-MM-DD", () => {
    expect(todayInAppTz()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

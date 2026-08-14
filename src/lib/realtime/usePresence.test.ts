import { describe, it, expect } from "vitest";
import { moduleFromPath } from "./usePresence";

describe("moduleFromPath", () => {
  it("traduz uma rota de topo para o rótulo do menu", () => {
    expect(moduleFromPath("/kanban")).toBe("Kanban");
    expect(moduleFromPath("/inicio")).toBe("Início");
    expect(moduleFromPath("/metas")).toBe("Metas");
    expect(moduleFromPath("/crm")).toBe("CRM");
    expect(moduleFromPath("/playbooks")).toBe("Playbooks");
  });

  it("traduz uma rota com sub-recurso para o rótulo do item pai — /crm/[id] vira CRM", () => {
    expect(moduleFromPath("/crm/9c6e6b8e-0000-4000-8000-000000000000")).toBe("CRM");
  });

  it("não confunde um prefixo por acaso — /crmzada não é /crm", () => {
    expect(moduleFromPath("/crmzada")).toBeNull();
  });

  it("rota fora da navegação não tem módulo", () => {
    expect(moduleFromPath("/login")).toBeNull();
    expect(moduleFromPath("/")).toBeNull();
  });
});

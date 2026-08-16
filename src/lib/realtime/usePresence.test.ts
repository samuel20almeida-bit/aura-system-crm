import { describe, it, expect } from "vitest";
import { moduleFromPath } from "./usePresence";

describe("moduleFromPath", () => {
  it("traduz uma rota de topo para o rótulo do menu", () => {
    expect(moduleFromPath("/hoje")).toBe("Hoje");
    expect(moduleFromPath("/pipeline")).toBe("Pipeline");
    expect(moduleFromPath("/kanban")).toBe("Kanban");
    expect(moduleFromPath("/metas")).toBe("Metas");
    expect(moduleFromPath("/playbooks")).toBe("Playbooks");
  });

  it("traduz uma rota com sub-recurso para o rótulo do item pai — /kanban/[id] vira Kanban", () => {
    expect(moduleFromPath("/kanban/9c6e6b8e-0000-4000-8000-000000000000")).toBe("Kanban");
  });

  it("não confunde um prefixo por acaso — /kanbanzada não é /kanban", () => {
    expect(moduleFromPath("/kanbanzada")).toBeNull();
  });

  it("rota fora da navegação não tem módulo", () => {
    expect(moduleFromPath("/login")).toBeNull();
    expect(moduleFromPath("/")).toBeNull();
  });
});

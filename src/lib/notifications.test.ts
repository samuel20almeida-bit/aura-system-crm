import { describe, it, expect } from "vitest";
import { buildNotifications, type NotificationInput } from "./notifications";

const TODAY = "2026-08-03";

const EMPTY: NotificationInput = {
  myOpenTasks: [],
};

function build(input: Partial<NotificationInput>) {
  return buildNotifications({ ...EMPTY, ...input }, TODAY);
}

describe("buildNotifications", () => {
  it("separa tarefa atrasada de tarefa que vence hoje", () => {
    const result = build({
      myOpenTasks: [
        { id: "t1", title: "Atrasada", dueDate: "2026-08-01" },
        { id: "t2", title: "Hoje", dueDate: TODAY },
        { id: "t3", title: "Futura", dueDate: "2026-08-20" },
      ],
    });
    expect(result.map((n) => n.title)).toEqual(["Atrasada", "Hoje"]);
    expect(result[0].tone).toBe("red");
    expect(result[1].tone).toBe("amber");
  });

  it("pula tarefa sem prazo", () => {
    const result = build({
      myOpenTasks: [
        { id: "t1", title: "Sem prazo", dueDate: null },
        { id: "t2", title: "Atrasada", dueDate: "2026-08-01" },
      ],
    });
    expect(result.map((n) => n.title)).toEqual(["Atrasada"]);
  });

  it("leva ao Kanban, na tarefa", () => {
    const result = build({
      myOpenTasks: [{ id: "t1", title: "Atrasada", dueDate: "2026-08-01" }],
    });
    expect(result[0].href).toBe("/kanban?task=t1");
  });

  it("ordena o vermelho antes do âmbar", () => {
    const result = build({
      myOpenTasks: [
        { id: "t1", title: "Vence hoje", dueDate: TODAY },
        { id: "t2", title: "Atrasada", dueDate: "2026-08-01" },
      ],
    });
    expect(result.map((n) => n.tone)).toEqual(["red", "amber"]);
    expect(result.map((n) => n.id)).toEqual(["tarefa-t2", "tarefa-t1"]);
  });

  it("devolve lista vazia quando não há nada a fazer", () => {
    expect(build({})).toEqual([]);
  });
});

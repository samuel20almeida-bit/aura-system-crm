import { describe, it, expect } from "vitest";
import { buildNotifications } from "./notifications";

const TODAY = "2026-08-03";

describe("buildNotifications", () => {
  it("lista fatura vencida como urgente", () => {
    const result = buildNotifications(
      {
        overdueInvoices: [{ id: "i1", clientId: "c1", clientName: "Nimbus", amount: 4200, dueDate: "2026-07-15" }],
        myOpenTasks: [],
        endingContracts: [],
        runningTimerStartedAt: null,
      },
      TODAY
    );
    expect(result).toHaveLength(1);
    expect(result[0].tone).toBe("red");
    expect(result[0].href).toBe("/crm/c1");
  });

  it("separa tarefa atrasada de tarefa que vence hoje", () => {
    const result = buildNotifications(
      {
        overdueInvoices: [],
        myOpenTasks: [
          { id: "t1", title: "Atrasada", dueDate: "2026-08-01" },
          { id: "t2", title: "Hoje", dueDate: TODAY },
          { id: "t3", title: "Futura", dueDate: "2026-08-20" },
        ],
        endingContracts: [],
        runningTimerStartedAt: null,
      },
      TODAY
    );
    expect(result.map((n) => n.title)).toEqual(["Atrasada", "Hoje"]);
    expect(result[0].tone).toBe("red");
    expect(result[1].tone).toBe("amber");
  });

  it("avisa sobre timer rodando há mais de 8 horas", () => {
    const nineHoursAgo = new Date(Date.now() - 9 * 3600 * 1000).toISOString();
    const result = buildNotifications(
      { overdueInvoices: [], myOpenTasks: [], endingContracts: [], runningTimerStartedAt: nineHoursAgo },
      TODAY
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("timer-esquecido");
  });

  it("ignora timer recente", () => {
    const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    const result = buildNotifications(
      { overdueInvoices: [], myOpenTasks: [], endingContracts: [], runningTimerStartedAt: oneHourAgo },
      TODAY
    );
    expect(result).toHaveLength(0);
  });

  it("devolve lista vazia quando não há nada a fazer", () => {
    expect(
      buildNotifications(
        { overdueInvoices: [], myOpenTasks: [], endingContracts: [], runningTimerStartedAt: null },
        TODAY
      )
    ).toEqual([]);
  });
});

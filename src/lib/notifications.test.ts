import { describe, it, expect } from "vitest";
import { buildNotifications, type NotificationInput } from "./notifications";

const TODAY = "2026-08-03";

const EMPTY: NotificationInput = {
  openInvoices: [],
  myOpenTasks: [],
  endingContracts: [],
};

function build(input: Partial<NotificationInput>) {
  return buildNotifications({ ...EMPTY, ...input }, TODAY);
}

describe("buildNotifications", () => {
  it("lista fatura vencida como urgente", () => {
    const result = build({
      openInvoices: [
        { id: "i1", clientId: "c1", clientName: "Nimbus", amount: 4200, dueDate: "2026-07-15", status: "overdue" },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].tone).toBe("red");
    expect(result[0].href).toBe("/crm/c1");
    // Data formatada em pt-BR, nunca o ISO cru ("2026-07-15").
    // \s cobre o espaço não separável que o Intl põe depois de "R$".
    expect(result[0].detail).toMatch(/^R\$\s4\.200 · venceu em 15 de jul$/);
  });

  it("avisa sobre fatura ainda em 'pending' cuja data já passou", () => {
    // Ninguém promove pending → overdue: nem trigger, nem cron, nem action.
    // Se o aviso dependesse do status marcado à mão, o sino diria "tudo em dia".
    const result = build({
      openInvoices: [
        { id: "i1", clientId: "c1", clientName: "Nimbus", amount: 4200, dueDate: "2026-07-10", status: "pending" },
        { id: "i2", clientId: "c2", clientName: "Vértice", amount: 900, dueDate: "2026-08-20", status: "pending" },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("fatura-i1");
    expect(result[0].tone).toBe("red");
  });

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

  it("avisa sobre contrato terminando em breve", () => {
    const result = build({
      endingContracts: [{ id: "k1", clientId: "c9", clientName: "Nimbus", endDate: "2026-08-28" }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("contrato-k1");
    expect(result[0].tone).toBe("neutral");
    expect(result[0].title).toBe("Contrato Nimbus termina em breve");
    expect(result[0].detail).toBe("Até 28 de ago");
    expect(result[0].href).toBe("/crm/c9");
  });

  it("acumula fatura vencida e tarefa atrasada no mesmo dia, do mais urgente ao menos", () => {
    const result = build({
      openInvoices: [
        { id: "i1", clientId: "c1", clientName: "Nimbus", amount: 4200, dueDate: "2026-07-15", status: "pending" },
      ],
      myOpenTasks: [{ id: "t1", title: "Entregar relatório", dueDate: "2026-08-01" }],
      endingContracts: [{ id: "k1", clientId: "c9", clientName: "Vértice", endDate: "2026-08-28" }],
    });
    expect(result.map((n) => n.id)).toEqual(["fatura-i1", "tarefa-t1", "contrato-k1"]);
    expect(result.map((n) => n.tone)).toEqual(["red", "red", "neutral"]);
  });

  // Restaura a cobertura que se perdeu ao remover o cronômetro: o aviso de timer
  // esquecido era o único item âmbar deste cenário, e sem ele a ordenação por
  // tom passou a ser exercida só com vermelho e neutro — o meio da fileira
  // ficou sem teste. "Tarefa que vence hoje" é o âmbar que sobrou.
  it("ordena os três tons: vermelho, âmbar e neutro, nessa ordem", () => {
    const result = build({
      openInvoices: [
        { id: "i1", clientId: "c1", clientName: "Nimbus", amount: 4200, dueDate: "2026-07-15", status: "pending" },
      ],
      myOpenTasks: [{ id: "t1", title: "Revisar proposta", dueDate: TODAY }],
      endingContracts: [{ id: "k1", clientId: "c9", clientName: "Vértice", endDate: "2026-08-28" }],
    });
    expect(result.map((n) => n.tone)).toEqual(["red", "amber", "neutral"]);
    expect(result.map((n) => n.id)).toEqual(["fatura-i1", "tarefa-t1", "contrato-k1"]);
  });

  it("devolve lista vazia quando não há nada a fazer", () => {
    expect(build({})).toEqual([]);
  });
});

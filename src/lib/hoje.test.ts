import { describe, it, expect } from "vitest";
import {
  negocioParaItemHoje,
  ordenarPorUrgencia,
  saudeDaTarefa,
  tarefaParaItemHoje,
  type ItemHoje,
} from "./hoje";

// São Paulo é UTC-3 o ano todo. 15:00Z = 12:00 em SP, bem longe da virada.
const MEIO_DIA = new Date("2026-08-14T15:00:00Z");

function negocio(over: Partial<Parameters<typeof negocioParaItemHoje>[0]> = {}) {
  return negocioParaItemHoje(
    {
      id: "n1",
      proximoPasso: "Ligar para a sócia financeira",
      proximoPassoEm: "2026-08-20",
      mexidoEm: "2026-08-14T12:00:00Z",
      donoId: "u1",
      contaNome: "Nimbus",
      ...over,
    },
    MEIO_DIA
  );
}

function tarefa(over: Partial<Parameters<typeof tarefaParaItemHoje>[0]> = {}) {
  return tarefaParaItemHoje(
    {
      id: "t1",
      titulo: "Enviar proposta",
      dueDate: "2026-08-20",
      donoId: "u1",
      clienteNome: "Nimbus",
      ...over,
    },
    MEIO_DIA
  );
}

describe("saudeDaTarefa", () => {
  it("apodrece com prazo vencido ontem", () => {
    expect(saudeDaTarefa("2026-08-13", MEIO_DIA)).toBe("podre");
  });

  it("pede atenção vencendo hoje", () => {
    expect(saudeDaTarefa("2026-08-14", MEIO_DIA)).toBe("atencao");
  });

  it("está ok vencendo no futuro", () => {
    expect(saudeDaTarefa("2026-08-20", MEIO_DIA)).toBe("ok");
  });

  it("está ok sem due_date — nenhuma tela do projeto trata isso como alarme", () => {
    expect(saudeDaTarefa(null, MEIO_DIA)).toBe("ok");
  });
});

describe("negocioParaItemHoje", () => {
  it("apodrece sem próximo passo, reusando o comportamento já testado de saudeDoNegocio", () => {
    const item = negocio({ proximoPasso: null });
    expect(item.saude).toBe("podre");
    expect(item.texto).toBe("Sem próximo passo");
  });

  it("carrega o contexto e o dono do negócio", () => {
    const item = negocio();
    expect(item.contexto).toBe("Nimbus");
    expect(item.donoId).toBe("u1");
    expect(item.origem).toBe("negocio");
  });
});

describe("tarefaParaItemHoje", () => {
  it("usa 'Interno' quando a tarefa não tem cliente", () => {
    const item = tarefa({ clienteNome: null });
    expect(item.contexto).toBe("Interno");
    expect(item.origem).toBe("tarefa");
  });
});

describe("ordenarPorUrgencia", () => {
  it("negócio podre vem antes de tarefa em dia", () => {
    const podre = negocio({ proximoPasso: null });
    const emDia = tarefa({ dueDate: "2026-09-01" });
    expect(ordenarPorUrgencia([emDia, podre]).map((i) => i.origem)).toEqual(["negocio", "tarefa"]);
  });

  it("tarefa vencida vem antes de negócio 'atencao'", () => {
    const vencida = tarefa({ dueDate: "2026-08-01" });
    const atencao = negocio({ mexidoEm: "2026-08-09T12:00:00Z" });
    expect(atencao.saude).toBe("atencao");
    expect(ordenarPorUrgencia([atencao, vencida]).map((i) => i.id)).toEqual(["t1", "n1"]);
  });

  it("desempata por vencimento ascendente dentro da mesma saúde, nulos por último", () => {
    const semData = tarefa({ id: "t-sem-data", dueDate: null, donoId: null, clienteNome: null });
    const cedo = negocio({ id: "n-cedo", proximoPassoEm: "2026-08-16" });
    const tarde = tarefa({ id: "t-tarde", dueDate: "2026-08-25" });
    const resultado = ordenarPorUrgencia([semData, tarde, cedo]);
    expect(resultado.map((i) => i.id)).toEqual(["n-cedo", "t-tarde", "t-sem-data"]);
  });

  it("desempata por texto alfabético quando saúde e vencimento empatam", () => {
    const zebra = tarefa({ id: "t-zebra", titulo: "Zebra", dueDate: "2026-08-20" });
    const abelha = negocio({ id: "n-abelha", proximoPasso: "Abelha", proximoPassoEm: "2026-08-20" });
    expect(ordenarPorUrgencia([zebra, abelha]).map((i) => i.id)).toEqual(["n-abelha", "t-zebra"]);
  });

  it("não muta o array recebido", () => {
    const itens: ItemHoje[] = [tarefa({ id: "b", dueDate: "2026-08-20" }), negocio({ id: "a", proximoPassoEm: "2026-08-10" })];
    const original = [...itens];
    ordenarPorUrgencia(itens);
    expect(itens).toEqual(original);
  });
});

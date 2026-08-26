import { describe, expect, it } from "vitest";
import {
  frescor,
  lerEnvio,
  participacaoDoAgente,
  resumirPorSalao,
  type LinhaDeUso,
} from "./clubcut";

const SALAO = "11111111-1111-4111-8111-111111111111";
const OUTRO = "22222222-2222-4222-8222-222222222222";

function usoValido(over: Record<string, unknown> = {}) {
  return {
    salon_id: SALAO,
    dia: "2026-08-25",
    barbeiros: 3,
    conversas: 12,
    mensagens: 40,
    agendamentos_agente: 2,
    agendamentos_total: 9,
    valor_gerado: 405,
    execucoes_erro: 0,
    ...over,
  };
}

function envioValido(over: Record<string, unknown> = {}) {
  return {
    saloes: [{ salon_id: SALAO, nome: "El Guardians", ativo: true }],
    uso: [usoValido()],
    ...over,
  };
}

describe("lerEnvio", () => {
  it("aceita um envio bem formado e normaliza o que falta", () => {
    const r = lerEnvio(envioValido());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envio.saloes).toEqual([{ salon_id: SALAO, nome: "El Guardians", ativo: true }]);
    // A chave ausente vira nulo, não zero: é a diferença entre "não custou
    // nada" e "ninguém mediu".
    expect(r.envio.uso[0].custo_ia_usd).toBeNull();
  });

  it("assume ativo quando o campo não vem", () => {
    const r = lerEnvio({ saloes: [{ salon_id: SALAO, nome: "Curitiba" }], uso: [] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envio.saloes[0].ativo).toBe(true);
  });

  it("recusa corpo que não é objeto", () => {
    expect(lerEnvio([]).ok).toBe(false);
    expect(lerEnvio(null).ok).toBe(false);
    expect(lerEnvio("uso").ok).toBe(false);
  });

  it("recusa uso de um salão que não veio na lista de salões", () => {
    const r = lerEnvio(envioValido({ uso: [usoValido({ salon_id: OUTRO })] }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toContain(OUTRO);
  });

  it("recusa data que casa com o formato mas não existe", () => {
    const r = lerEnvio(envioValido({ uso: [usoValido({ dia: "2026-02-30" })] }));
    expect(r.ok).toBe(false);
  });

  it("recusa o mesmo dia duas vezes para o mesmo salão", () => {
    const r = lerEnvio(envioValido({ uso: [usoValido(), usoValido()] }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toContain("repetido");
  });

  it("aceita o mesmo dia para salões diferentes", () => {
    const r = lerEnvio({
      saloes: [
        { salon_id: SALAO, nome: "El Guardians", ativo: true },
        { salon_id: OUTRO, nome: "Curitiba", ativo: true },
      ],
      uso: [usoValido(), usoValido({ salon_id: OUTRO })],
    });
    expect(r.ok).toBe(true);
  });

  it("recusa contador negativo, fracionário ou ausente", () => {
    expect(lerEnvio(envioValido({ uso: [usoValido({ conversas: -1 })] })).ok).toBe(false);
    expect(lerEnvio(envioValido({ uso: [usoValido({ conversas: 1.5 })] })).ok).toBe(false);
    expect(lerEnvio(envioValido({ uso: [usoValido({ conversas: undefined })] })).ok).toBe(false);
    expect(lerEnvio(envioValido({ uso: [usoValido({ conversas: "12" })] })).ok).toBe(false);
  });

  it("recusa agendamento do agente maior que o total", () => {
    const r = lerEnvio(
      envioValido({ uso: [usoValido({ agendamentos_agente: 10, agendamentos_total: 9 })] })
    );
    expect(r.ok).toBe(false);
  });

  it("aceita custo medido e recusa custo negativo", () => {
    const bom = lerEnvio(envioValido({ uso: [usoValido({ custo_ia_usd: 0.42 })] }));
    expect(bom.ok).toBe(true);
    if (bom.ok) expect(bom.envio.uso[0].custo_ia_usd).toBe(0.42);
    expect(lerEnvio(envioValido({ uso: [usoValido({ custo_ia_usd: -1 })] })).ok).toBe(false);
  });

  it("recusa salão repetido no mesmo envio", () => {
    const r = lerEnvio({
      saloes: [
        { salon_id: SALAO, nome: "El Guardians" },
        { salon_id: SALAO, nome: "El Guardians (2)" },
      ],
      uso: [],
    });
    expect(r.ok).toBe(false);
  });

  it("recusa envio acima do teto", () => {
    const saloes = [{ salon_id: SALAO, nome: "El Guardians" }];
    const uso = Array.from({ length: 18_001 }, (_, i) => usoValido({ dia: `2026-08-${i}` }));
    const r = lerEnvio({ saloes, uso });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toContain("18000");
  });
});

function linha(over: Partial<LinhaDeUso> = {}): LinhaDeUso {
  return {
    salon_id: SALAO,
    dia: "2026-08-25",
    barbeiros: 3,
    conversas: 10,
    mensagens: 30,
    agendamentos_agente: 2,
    agendamentos_total: 8,
    valor_gerado: 100,
    custo_ia_usd: null,
    execucoes_erro: 0,
    ...over,
  };
}

describe("resumirPorSalao", () => {
  it("soma os contadores e conta os dias", () => {
    const r = resumirPorSalao([
      linha({ dia: "2026-08-24", conversas: 10, agendamentos_agente: 2, agendamentos_total: 8 }),
      linha({ dia: "2026-08-25", conversas: 5, agendamentos_agente: 1, agendamentos_total: 4 }),
    ]).get(SALAO)!;
    expect(r.dias).toBe(2);
    expect(r.conversas).toBe(15);
    expect(r.agendamentosAgente).toBe(3);
    expect(r.agendamentosTotal).toBe(12);
    expect(r.valorGerado).toBe(200);
  });

  it("NÃO soma barbeiros — usa o do dia mais recente", () => {
    const r = resumirPorSalao([
      linha({ dia: "2026-08-24", barbeiros: 3 }),
      linha({ dia: "2026-08-25", barbeiros: 4 }),
    ]).get(SALAO)!;
    expect(r.barbeiros).toBe(4);
    expect(r.ultimoDia).toBe("2026-08-25");
  });

  it("acha o dia mais recente mesmo com as linhas fora de ordem", () => {
    const r = resumirPorSalao([
      linha({ dia: "2026-08-25", barbeiros: 4 }),
      linha({ dia: "2026-08-09", barbeiros: 1 }),
      linha({ dia: "2026-08-10", barbeiros: 2 }),
    ]).get(SALAO)!;
    expect(r.barbeiros).toBe(4);
    expect(r.ultimoDia).toBe("2026-08-25");
  });

  it("separa os salões", () => {
    const m = resumirPorSalao([linha(), linha({ salon_id: OUTRO, conversas: 99 })]);
    expect(m.size).toBe(2);
    expect(m.get(OUTRO)!.conversas).toBe(99);
  });

  it("deixa o custo nulo quando nenhum dia mediu", () => {
    const r = resumirPorSalao([linha(), linha({ dia: "2026-08-24" })]).get(SALAO)!;
    expect(r.custoIaUsd).toBeNull();
    expect(r.diasComCusto).toBe(0);
  });

  it("soma só os dias medidos e diz quantos foram", () => {
    const r = resumirPorSalao([
      linha({ dia: "2026-08-24", custo_ia_usd: 0.2 }),
      linha({ dia: "2026-08-25", custo_ia_usd: null }),
      linha({ dia: "2026-08-26", custo_ia_usd: 0.3 }),
    ]).get(SALAO)!;
    expect(r.custoIaUsd).toBeCloseTo(0.5);
    expect(r.diasComCusto).toBe(2);
    expect(r.dias).toBe(3);
  });

  it("devolve mapa vazio sem linhas", () => {
    expect(resumirPorSalao([]).size).toBe(0);
  });
});

describe("participacaoDoAgente", () => {
  it("é a razão entre agendamentos do agente e o total", () => {
    const r = resumirPorSalao([linha({ agendamentos_agente: 2, agendamentos_total: 8 })]).get(SALAO)!;
    expect(participacaoDoAgente(r)).toBe(0.25);
  });

  it("é nula quando não houve agendamento nenhum", () => {
    const r = resumirPorSalao([linha({ agendamentos_agente: 0, agendamentos_total: 0 })]).get(SALAO)!;
    expect(participacaoDoAgente(r)).toBeNull();
  });
});

describe("frescor", () => {
  const agora = new Date("2026-08-26T15:00:00Z");

  it("é ok no mesmo dia e no dia anterior", () => {
    expect(frescor("2026-08-26T09:00:00Z", agora)).toEqual({ dias: 0, estado: "ok" });
    expect(frescor("2026-08-25T09:00:00Z", agora)).toEqual({ dias: 1, estado: "ok" });
  });

  it("é atrasado de dois a seis dias", () => {
    expect(frescor("2026-08-24T09:00:00Z", agora)!.estado).toBe("atrasado");
    expect(frescor("2026-08-20T09:00:00Z", agora)!.estado).toBe("atrasado");
  });

  it("é parado a partir de uma semana", () => {
    expect(frescor("2026-08-19T09:00:00Z", agora)).toEqual({ dias: 7, estado: "parado" });
  });

  it("é nulo quando nunca sincronizou ou a data não presta", () => {
    expect(frescor(null, agora)).toBeNull();
    expect(frescor("nunca", agora)).toBeNull();
  });
});

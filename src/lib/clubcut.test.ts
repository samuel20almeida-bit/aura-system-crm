import { describe, expect, it } from "vitest";
import {
  frescor,
  lerEnvio,
  participacaoDoAgente,
  resumirCobranca,
  resumirPorSalao,
  situacaoDaAssinatura,
  type FaturaLida,
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

describe("lerEnvio · assinaturas e faturas", () => {
  it("aceita envio sem as duas listas — o workflow antigo continua válido", () => {
    const r = lerEnvio(envioValido());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envio.assinaturas).toEqual([]);
    expect(r.envio.faturas).toEqual([]);
  });

  it("aceita uma assinatura completa", () => {
    const r = lerEnvio(
      envioValido({
        assinaturas: [
          {
            salon_id: SALAO,
            plano: "pro",
            status: "atrasada",
            valor: 299,
            proximo_vencimento: "2026-09-06",
            acesso_ate: "2026-09-13",
          },
        ],
      })
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envio.assinaturas[0].status).toBe("atrasada");
    expect(r.envio.assinaturas[0].acesso_ate).toBe("2026-09-13");
  });

  it("aceita assinatura em teste, sem vencimento", () => {
    const r = lerEnvio(
      envioValido({
        assinaturas: [{ salon_id: SALAO, status: "trial", proximo_vencimento: null }],
      })
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envio.assinaturas[0].proximo_vencimento).toBeNull();
    expect(r.envio.assinaturas[0].plano).toBeNull();
  });

  it("recusa data mal formada no lugar de ausente", () => {
    const r = lerEnvio(
      envioValido({ assinaturas: [{ salon_id: SALAO, status: "trial", acesso_ate: "13/09/2026" }] })
    );
    expect(r.ok).toBe(false);
  });

  it("recusa assinatura de salão que não veio no envio", () => {
    const r = lerEnvio(envioValido({ assinaturas: [{ salon_id: OUTRO, status: "active" }] }));
    expect(r.ok).toBe(false);
  });

  it("recusa duas assinaturas do mesmo salão", () => {
    const r = lerEnvio(
      envioValido({
        assinaturas: [
          { salon_id: SALAO, status: "active" },
          { salon_id: SALAO, status: "cancelada" },
        ],
      })
    );
    expect(r.ok).toBe(false);
  });

  it("aceita uma fatura e assume zero no que não veio", () => {
    const r = lerEnvio(
      envioValido({
        faturas: [
          {
            salon_id: SALAO,
            periodo_inicio: "2026-08-01",
            periodo_fim: "2026-08-31",
            motivo: "mensal",
            valor: 1.5,
          },
        ],
      })
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envio.faturas[0].valor_gerado).toBe(0);
    expect(r.envio.faturas[0].agendamentos).toBe(0);
    expect(r.envio.faturas[0].paga_em).toBeNull();
  });

  it("recusa período que termina antes de começar", () => {
    const r = lerEnvio(
      envioValido({
        faturas: [
          {
            salon_id: SALAO,
            periodo_inicio: "2026-08-31",
            periodo_fim: "2026-08-01",
            motivo: "mensal",
            valor: 1.5,
          },
        ],
      })
    );
    expect(r.ok).toBe(false);
  });

  it("aceita mensal e parcial do MESMO período — o motivo entra na chave", () => {
    const base = {
      salon_id: SALAO,
      periodo_inicio: "2026-08-01",
      periodo_fim: "2026-08-31",
      valor: 1.5,
    };
    const r = lerEnvio(
      envioValido({ faturas: [{ ...base, motivo: "mensal" }, { ...base, motivo: "cancelamento" }] })
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envio.faturas).toHaveLength(2);
  });

  it("recusa a mesma fatura duas vezes", () => {
    const f = {
      salon_id: SALAO,
      periodo_inicio: "2026-08-01",
      periodo_fim: "2026-08-31",
      motivo: "mensal",
      valor: 1.5,
    };
    const r = lerEnvio(envioValido({ faturas: [f, { ...f }] }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toContain("repetida");
  });

  it("recusa lista que não é lista", () => {
    expect(lerEnvio(envioValido({ assinaturas: {} })).ok).toBe(false);
    expect(lerEnvio(envioValido({ faturas: "nenhuma" })).ok).toBe(false);
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

function fatura(over: Partial<FaturaLida> = {}): FaturaLida {
  return {
    salon_id: SALAO,
    periodo_inicio: "2026-08-01",
    periodo_fim: "2026-08-31",
    motivo: "mensal",
    valor: 100,
    valor_gerado: 900,
    agendamentos: 12,
    vencimento: "2026-09-05",
    paga_em: null,
    ...over,
  };
}

describe("resumirCobranca", () => {
  const desde = "2026-08-01";
  const hoje = "2026-09-10";

  it("soma no cobrado só o que fechou dentro da janela", () => {
    const r = resumirCobranca(
      [
        fatura({ periodo_fim: "2026-08-31", valor: 100 }),
        fatura({ periodo_inicio: "2026-06-01", periodo_fim: "2026-06-30", valor: 80 }),
      ],
      desde,
      hoje
    ).get(SALAO)!;
    expect(r.cobrado).toBe(100);
  });

  it("conta a dívida antiga em aberto, mesmo fora da janela", () => {
    const r = resumirCobranca(
      [fatura({ periodo_inicio: "2026-06-01", periodo_fim: "2026-06-30", valor: 80, vencimento: "2026-07-05" })],
      desde,
      hoje
    ).get(SALAO)!;
    expect(r.cobrado).toBe(0);
    expect(r.emAberto).toBe(80);
    expect(r.vencidas).toBe(1);
  });

  it("fatura paga não entra em aberto nem em vencidas", () => {
    const r = resumirCobranca(
      [fatura({ vencimento: "2026-08-05", paga_em: "2026-08-04T10:00:00Z" })],
      desde,
      hoje
    ).get(SALAO)!;
    expect(r.emAberto).toBe(0);
    expect(r.vencidas).toBe(0);
  });

  it("em aberto sem vencimento não conta como vencida", () => {
    const r = resumirCobranca([fatura({ vencimento: null })], desde, hoje).get(SALAO)!;
    expect(r.emAberto).toBe(100);
    expect(r.vencidas).toBe(0);
  });

  it("em aberto ainda dentro do prazo não é vencida", () => {
    const r = resumirCobranca([fatura({ vencimento: "2026-09-20" })], desde, hoje).get(SALAO)!;
    expect(r.vencidas).toBe(0);
  });

  it("guarda o período mais recente", () => {
    const r = resumirCobranca(
      [
        fatura({ periodo_fim: "2026-07-31" }),
        fatura({ periodo_fim: "2026-08-31", motivo: "cancelamento" }),
      ],
      desde,
      hoje
    ).get(SALAO)!;
    expect(r.ultimoPeriodoFim).toBe("2026-08-31");
  });
});

describe("situacaoDaAssinatura", () => {
  const hoje = "2026-08-26";
  const base = {
    salon_id: SALAO,
    plano: "pro",
    valor: 299,
    proximo_vencimento: null,
    acesso_ate: null,
  };

  it("marca teste VENCIDO em vermelho — é cliente sendo servido de graça", () => {
    const s = situacaoDaAssinatura({ ...base, status: "trial", acesso_ate: "2026-08-12" }, hoje);
    expect(s).toEqual({ rotulo: "teste vencido", tom: "red" });
  });

  it("teste em dia é âmbar, não vermelho", () => {
    const s = situacaoDaAssinatura({ ...base, status: "trial", acesso_ate: "2026-09-30" }, hoje);
    expect(s.tom).toBe("amber");
  });

  it("ativa é verde, atrasada e cancelada são vermelhas", () => {
    expect(situacaoDaAssinatura({ ...base, status: "active" }, hoje).tom).toBe("accent");
    expect(situacaoDaAssinatura({ ...base, status: "atrasada" }, hoje).tom).toBe("red");
    expect(situacaoDaAssinatura({ ...base, status: "cancelada" }, hoje).tom).toBe("red");
  });

  it("status desconhecido aparece cru, em vez de sumir", () => {
    const s = situacaoDaAssinatura({ ...base, status: "suspensa_por_fraude" }, hoje);
    expect(s.rotulo).toBe("suspensa_por_fraude");
    expect(s.tom).toBe("neutral");
  });

  it("sem assinatura tem rótulo próprio", () => {
    expect(situacaoDaAssinatura(null, hoje).rotulo).toBe("sem assinatura");
  });
});

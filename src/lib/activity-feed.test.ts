import { describe, it, expect } from "vitest";
import { describeActivity, formatActivityWhen, type ActivityRow } from "./activity-feed";

const NOW = new Date("2026-08-10T15:00:00Z");

function row(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: "row-1",
    verb: "moveu Finalizar o CRM para",
    detail: "Em andamento",
    created_at: "2026-08-10T14:58:00Z",
    user_id: "user-samuel",
    user: { id: "user-samuel", full_name: "Samuel Almeida", initials: "SA" },
    ...overrides,
  };
}

describe("describeActivity — quem", () => {
  it("o próprio autor vira 'Você'", () => {
    expect(describeActivity(row({ user_id: "user-samuel" }), "user-samuel", NOW).who).toBe("Você");
  });

  it("outro autor vira o primeiro nome", () => {
    const outro = row({
      user_id: "user-saymon",
      user: { id: "user-saymon", full_name: "Saymon Costa", initials: "SC" },
    });
    expect(describeActivity(outro, "user-samuel", NOW).who).toBe("Saymon");
  });

  it("autor nulo vira 'Alguém'", () => {
    const semAutor = row({ user_id: null, user: null });
    expect(describeActivity(semAutor, "user-samuel", NOW).who).toBe("Alguém");
  });
});

describe("describeActivity — texto", () => {
  it("verbo e detalhe chegam separados, para o detalhe poder ser destacado", () => {
    const descrito = describeActivity(row(), "user-saymon", NOW);
    expect(descrito.verb).toBe("moveu Finalizar o CRM para");
    expect(descrito.detail).toBe("Em andamento");
  });

  it("detail nulo continua nulo — o componente não desenha nada, nem espaço", () => {
    const semDetalhe = row({ verb: "lançou", detail: null });
    const descrito = describeActivity(semDetalhe, "user-samuel", NOW);
    expect(descrito.verb).toBe("lançou");
    expect(descrito.detail).toBeNull();
  });
});

describe("formatActivityWhen", () => {
  it("abaixo de um minuto vira 'agora'", () => {
    const criadoAgora = new Date(NOW.getTime() - 30_000).toISOString();
    expect(formatActivityWhen(criadoAgora, NOW)).toBe("agora");
  });

  it("59 min diz 'há 59 min', 60 min vira 'há 1 h'", () => {
    const ha59min = new Date(NOW.getTime() - 59 * 60_000).toISOString();
    const ha60min = new Date(NOW.getTime() - 60 * 60_000).toISOString();
    expect(formatActivityWhen(ha59min, NOW)).toBe("há 59 min");
    expect(formatActivityWhen(ha60min, NOW)).toBe("há 1 h");
  });

  // A partir daqui a decisão deixa de ser "horas corridas" e passa a ser o
  // calendário de São Paulo — o ramo que motivou o parâmetro opcional de
  // `todayInAppTz` e que nenhum teste alcançava.
  it("23 h ainda é 'há 23 h'; 24 h já vira 'ontem'", () => {
    const ha23h = new Date(NOW.getTime() - 23 * 3_600_000).toISOString();
    const ha24h = new Date(NOW.getTime() - 24 * 3_600_000).toISOString();
    expect(formatActivityWhen(ha23h, NOW)).toBe("há 23 h");
    expect(formatActivityWhen(ha24h, NOW)).toBe("ontem");
  });

  it("a virada do dia segue o calendário de São Paulo, não o de UTC", () => {
    // 01:00Z do dia 9 ainda é 22:00 do dia 8 em São Paulo (UTC-3), e 23:00Z do
    // dia 10 é 20:00 do dia 10. Pelo calendário de SP são dois dias (08 -> 10);
    // pelo de UTC seria um só (09 -> 10), o que diria "ontem" para algo que
    // aconteceu anteontem à noite.
    const antesDaMeiaNoiteEmSp = "2026-08-09T01:00:00Z";
    const agora = new Date("2026-08-10T23:00:00Z");
    expect(formatActivityWhen(antesDaMeiaNoiteEmSp, agora)).toBe("há 2 dias");
  });

  it("6 dias ainda conta os dias; 7 dias vira a data cheia", () => {
    const ha6dias = new Date(NOW.getTime() - 6 * 86_400_000).toISOString();
    const ha7dias = new Date(NOW.getTime() - 7 * 86_400_000).toISOString();
    expect(formatActivityWhen(ha6dias, NOW)).toBe("há 6 dias");
    expect(formatActivityWhen(ha7dias, NOW)).toBe("03 de ago");
  });

  it("a data cheia ganha o ano quando ele não é o corrente", () => {
    // Sem o ano, 370 dias atrás sairia "05 de ago" — indistinguível de uma
    // linha de cinco dias atrás.
    const ha370dias = new Date(NOW.getTime() - 370 * 86_400_000).toISOString();
    expect(formatActivityWhen(ha370dias, NOW)).toBe("05 de ago de 2025");
  });
});

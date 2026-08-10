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
  it("detail nulo não deixa espaço sobrando", () => {
    const semDetalhe = row({ verb: "lançou", detail: null });
    const { text } = describeActivity(semDetalhe, "user-samuel", NOW);
    expect(text).toBe("lançou");
    expect(text.endsWith(" ")).toBe(false);
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
});

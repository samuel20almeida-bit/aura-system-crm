import { describe, it, expect } from "vitest";
import { jaTerminou, separarPorTempo, formatarQuando, formatarDuracao } from "./reunioes";

/**
 * O que estes testes protegem é o CORTE ENTRE PRÓXIMA E ANTERIOR, que é a
 * única regra da tela e a única que depende de relógio. Um erro aqui não
 * quebra nada visivelmente: a reunião só aparece na aba errada, e quem
 * procura a ata da reunião de ontem não a encontra.
 */
const AGORA = new Date("2026-08-28T17:00:00Z"); // 14:00 em São Paulo

describe("jaTerminou", () => {
  it("uma reunião que ainda vai começar não terminou", () => {
    expect(jaTerminou("2026-08-28T18:00:00Z", 60, AGORA)).toBe(false);
  });

  it("uma reunião EM ANDAMENTO ainda não terminou", () => {
    // Começou 14:00, dura 1h, agora são 14:00 — é a reunião de agora, e ela
    // tem de ficar em "Próximas", que é onde quem abre o CRM para anotar a
    // ata vai olhar. Cortar pelo início a mandaria para o histórico.
    expect(jaTerminou("2026-08-28T17:00:00Z", 60, AGORA)).toBe(false);
    expect(jaTerminou("2026-08-28T16:30:00Z", 60, AGORA)).toBe(false);
  });

  it("terminou no instante exato em que a duração se esgota", () => {
    expect(jaTerminou("2026-08-28T16:00:00Z", 60, AGORA)).toBe(true);
  });

  it("sem duração, conta como terminada no próprio horário", () => {
    // Supor uma hora atrasaria o histórico de toda reunião relâmpago.
    expect(jaTerminou("2026-08-28T17:00:00Z", null, AGORA)).toBe(true);
    expect(jaTerminou("2026-08-28T17:00:01Z", null, AGORA)).toBe(false);
  });
});

describe("separarPorTempo", () => {
  // Como o banco entrega: `acontece_em` DESC.
  const doBanco = [
    { id: "d+2", aconteceEm: "2026-08-30T17:00:00Z", duracaoMin: 30 },
    { id: "d+1", aconteceEm: "2026-08-29T17:00:00Z", duracaoMin: 30 },
    { id: "agora", aconteceEm: "2026-08-28T16:45:00Z", duracaoMin: 60 },
    { id: "ontem", aconteceEm: "2026-08-27T17:00:00Z", duracaoMin: 30 },
    { id: "semana passada", aconteceEm: "2026-08-21T17:00:00Z", duracaoMin: 30 },
  ];

  it("as próximas vêm da mais perto para a mais longe", () => {
    const { proximas } = separarPorTempo(doBanco, AGORA);
    expect(proximas.map((r) => r.id)).toEqual(["agora", "d+1", "d+2"]);
  });

  it("as anteriores vêm da mais recente para a mais antiga", () => {
    const { anteriores } = separarPorTempo(doBanco, AGORA);
    expect(anteriores.map((r) => r.id)).toEqual(["ontem", "semana passada"]);
  });

  it("a reunião em andamento fica nas próximas, não no histórico", () => {
    const { proximas, anteriores } = separarPorTempo(doBanco, AGORA);
    expect(proximas.map((r) => r.id)).toContain("agora");
    expect(anteriores.map((r) => r.id)).not.toContain("agora");
  });

  it("lista vazia devolve duas listas vazias, não quebra", () => {
    expect(separarPorTempo([], AGORA)).toEqual({ proximas: [], anteriores: [] });
  });

  it("não perde nem duplica nenhuma reunião", () => {
    const { proximas, anteriores } = separarPorTempo(doBanco, AGORA);
    expect(proximas.length + anteriores.length).toBe(doBanco.length);
    expect(new Set([...proximas, ...anteriores].map((r) => r.id)).size).toBe(doBanco.length);
  });
});

describe("formatarQuando", () => {
  it("mostra dia e hora no fuso do app, não em UTC", () => {
    // 17:00 UTC é 14:00 em São Paulo. Sem o fuso fixado, a tela mostraria
    // a hora do servidor da Vercel.
    expect(formatarQuando("2026-08-28T17:00:00Z")).toContain("14:00");
    expect(formatarQuando("2026-08-28T17:00:00Z")).toContain("28");
  });

  it("um horário perto da meia-noite não escorrega de dia", () => {
    // 02:00 UTC do dia 29 é 23:00 do dia 28 em São Paulo.
    const texto = formatarQuando("2026-08-29T02:00:00Z");
    expect(texto).toContain("28");
    expect(texto).toContain("23:00");
  });
});

describe("formatarDuracao", () => {
  it("abaixo de uma hora, minutos", () => {
    expect(formatarDuracao(30)).toBe("30 min");
    expect(formatarDuracao(59)).toBe("59 min");
  });

  it("hora cheia não mostra minutos", () => {
    expect(formatarDuracao(60)).toBe("1h");
    expect(formatarDuracao(120)).toBe("2h");
  });

  it("hora quebrada mostra os minutos com dois dígitos", () => {
    expect(formatarDuracao(90)).toBe("1h30");
    expect(formatarDuracao(65)).toBe("1h05");
  });
});

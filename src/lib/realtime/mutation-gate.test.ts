import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { beginMutation, isMutating, resetGateForTests } from "./mutation-gate";

describe("mutation-gate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetGateForTests();
  });

  afterEach(() => {
    resetGateForTests();
    vi.useRealTimers();
  });

  it("sem escritas em voo, o portão está aberto", () => {
    expect(isMutating()).toBe(false);
  });

  it("uma escrita em voo fecha o portão; liberada, ele reabre", () => {
    const end = beginMutation();
    expect(isMutating()).toBe(true);
    end();
    expect(isMutating()).toBe(false);
  });

  it("com duas escritas em voo, a primeira a terminar NÃO abre o portão", () => {
    const endArraste = beginMutation();
    const endComentario = beginMutation();
    expect(isMutating()).toBe(true);

    endComentario();
    // Um booleano abriria aqui e deixaria a atualização atropelar o arraste.
    expect(isMutating()).toBe(true);

    endArraste();
    expect(isMutating()).toBe(false);
  });

  it("liberar o mesmo retorno duas vezes não derruba o contador nem abre o portão cedo", () => {
    const endPrimeira = beginMutation();
    const endSegunda = beginMutation();

    endPrimeira();
    endPrimeira();
    expect(isMutating()).toBe(true);

    endSegunda();
    expect(isMutating()).toBe(false);

    // O contador não ficou negativo: a próxima escrita fecha o portão normalmente.
    const endTerceira = beginMutation();
    expect(isMutating()).toBe(true);
    endTerceira();
    expect(isMutating()).toBe(false);
  });

  it("uma escrita que nunca responde é solta sozinha pelo cão de guarda", () => {
    // Aba congelada ou wifi caindo: a promessa da Server Action nunca assenta e
    // o `finally` de quem chamou nunca roda. Sem o cão de guarda o contador
    // ficaria em 1 para sempre e nenhuma tela voltaria a se atualizar.
    beginMutation();
    expect(isMutating()).toBe(true);

    vi.advanceTimersByTime(14_999);
    expect(isMutating()).toBe(true);

    vi.advanceTimersByTime(1);
    expect(isMutating()).toBe(false);
  });

  it("o `end` de uma escrita já solta pelo cão de guarda não derruba o contador de outra", () => {
    const endTravada = beginMutation();
    vi.advanceTimersByTime(15_000);
    expect(isMutating()).toBe(false);

    const endNova = beginMutation();
    endTravada(); // chega atrasado, quando a promessa finalmente assenta
    expect(isMutating()).toBe(true);

    endNova();
    expect(isMutating()).toBe(false);
  });

  it("o `end` normal cancela o cão de guarda da própria escrita", () => {
    const endPrimeira = beginMutation();
    endPrimeira();

    vi.advanceTimersByTime(10_000);
    const endSegunda = beginMutation();

    // t = 15.001s: o cão de guarda da PRIMEIRA venceria agora se não tivesse
    // sido cancelado, e derrubaria o contador da segunda, que ainda está em voo.
    vi.advanceTimersByTime(5_001);
    expect(isMutating()).toBe(true);

    endSegunda();
    expect(isMutating()).toBe(false);
  });
});

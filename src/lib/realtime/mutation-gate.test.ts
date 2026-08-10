import { describe, it, expect, beforeEach } from "vitest";
import { beginMutation, isMutating, subscribeToGate, resetGateForTests } from "./mutation-gate";

describe("mutation-gate", () => {
  beforeEach(() => {
    resetGateForTests();
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

  it("avisa os inscritos ao fechar e ao abrir, e o retorno cancela a inscrição", () => {
    const estados: boolean[] = [];
    const cancelar = subscribeToGate(() => estados.push(isMutating()));

    const end = beginMutation();
    end();
    expect(estados).toEqual([true, false]);

    cancelar();
    const outra = beginMutation();
    outra();
    expect(estados).toEqual([true, false]);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createAutoSaver, type AutoSaveState } from "./autosave";

describe("createAutoSaver", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("não dispara antes do período de silêncio, dispara depois", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const states: AutoSaveState[] = [];
    const auto = createAutoSaver<string>(save, (s) => states.push(s));

    auto.onChange("a");
    await vi.advanceTimersByTimeAsync(799);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("a");
    expect(states).toContain("salvando");
    expect(states).toContain("salvo");
  });

  it("reinicia o debounce a cada mudança — só o último valor é salvo", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const auto = createAutoSaver<string>(save, () => {});

    auto.onChange("a");
    await vi.advanceTimersByTimeAsync(500);
    auto.onChange("b");
    await vi.advanceTimersByTimeAsync(500);
    expect(save).not.toHaveBeenCalled(); // só 500ms desde "b", precisa de 800

    await vi.advanceTimersByTimeAsync(300);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("b");
  });

  it("pula o save se o valor não mudou desde o último salvo com sucesso", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const states: AutoSaveState[] = [];
    const auto = createAutoSaver<string>(save, (s) => states.push(s));

    auto.onChange("a");
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);

    states.length = 0;
    auto.onChange("a"); // mesmo valor de novo
    await vi.advanceTimersByTimeAsync(800);
    // Com a checagem de conteúdo em `agendar()` (achados C2/I3), a segunda
    // chamada nem chega a `tentar()` — é filtrada antes, então `onStateChange`
    // não dispara nenhuma vez aqui. O que importa (nenhum save duplicado)
    // continua garantido.
    expect(states).toEqual([]);
    expect(save).toHaveBeenCalledTimes(1); // não chamou de novo
  });

  it("edição durante um save em voo dispara outro ciclo com o valor mais recente, sem esperar o debounce de novo", async () => {
    let resolvePrimeiro!: () => void;
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (resolvePrimeiro = resolve)))
      .mockResolvedValueOnce(undefined);
    const auto = createAutoSaver<string>(save, () => {});

    auto.onChange("a");
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1); // "a" está em voo, ainda não resolveu

    auto.onChange("b");
    await vi.advanceTimersByTimeAsync(800); // debounce venceria aqui, mas "a" ainda está em voo
    expect(save).toHaveBeenCalledTimes(1); // não iniciou um segundo save concorrente

    resolvePrimeiro();
    await vi.advanceTimersByTimeAsync(0); // sem timer novo pra avançar; só flush do microtask da resolução manual
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("b"); // o valor mais recente não se perdeu
  });

  it("erro no save não trava o módulo — chamado de novo, tenta de novo", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("falhou")).mockResolvedValueOnce(undefined);
    const states: AutoSaveState[] = [];
    const auto = createAutoSaver<string>(save, (s) => states.push(s));

    auto.onChange("a");
    await vi.advanceTimersByTimeAsync(800);
    expect(states).toContain("erro");

    auto.onChange("b");
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("b");
  });

  it("cancel() cancela um save agendado e não disparado", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const auto = createAutoSaver<string>(save, () => {});

    auto.onChange("a");
    auto.cancel();
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
  });

  it("isEqual customizado é respeitado", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const states: AutoSaveState[] = [];
    const auto = createAutoSaver<{ n: number }>(save, (s) => states.push(s), {
      isEqual: (a, b) => a.n === b.n,
    });

    auto.onChange({ n: 1 });
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);

    states.length = 0;
    auto.onChange({ n: 1 }); // objeto novo, mesmo conteúdo
    await vi.advanceTimersByTimeAsync(800);
    // Mesmo motivo do teste anterior: a checagem de conteúdo em `agendar()`
    // filtra a chamada repetida antes de chegar a `onStateChange`.
    expect(states).toEqual([]);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("reverter para o valor já salvo enquanto outro save está em voo não descarta a reversão", async () => {
    let resolvePrimeiro!: () => void;
    let resolveSegundo!: () => void;
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (resolvePrimeiro = resolve)))
      .mockImplementationOnce(() => new Promise<void>((resolve) => (resolveSegundo = resolve)))
      .mockResolvedValueOnce(undefined);
    const auto = createAutoSaver<string>(save, () => {});

    // "x" já confirmado como último salvo.
    auto.onChange("x");
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);
    resolvePrimeiro();
    await vi.advanceTimersByTimeAsync(0);

    // Edita pra "a" (entra em voo, não resolve ainda).
    auto.onChange("a");
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(2); // "a" disparou, mas ainda não resolveu

    // Enquanto "a" está em voo, reverte pra "x" — o mesmo valor que JÁ era
    // o último salvo antes de "a" começar.
    auto.onChange("x");
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(2); // ainda não pode disparar: "a" segue em voo

    // "a" assenta — a reversão pra "x" precisa disparar um terceiro save.
    resolveSegundo();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(3);
    expect(save).toHaveBeenLastCalledWith("x");
  });

  it("com initialValue, o primeiro onChange igual ao valor inicial não agenda nem dispara save", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const auto = createAutoSaver<string>(save, () => {}, { initialValue: "x" });

    auto.onChange("x"); // valor que já veio "do servidor", sem edição real
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
  });

  it("com initialValue, um onChange com valor DIFERENTE dispara save normalmente", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const auto = createAutoSaver<string>(save, () => {}, { initialValue: "x" });

    auto.onChange("y");
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("y");
  });

  it("um save que falha não é reagendado automaticamente por chamadas repetidas com o mesmo conteúdo (simula re-render do React após erro)", async () => {
    const save = vi.fn().mockRejectedValue(new Error("falha persistente"));
    const auto = createAutoSaver<string>(save, () => {});

    auto.onChange("a");
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);

    // Simula o componente React re-renderizando com o MESMO conteúdo (ex: o
    // próprio estado de erro do autosave mudou, disparando um re-render, que
    // reconstrói o objeto de valor sem nenhuma edição nova).
    auto.onChange("a");
    await vi.advanceTimersByTimeAsync(800);
    auto.onChange("a");
    await vi.advanceTimersByTimeAsync(800);

    expect(save).toHaveBeenCalledTimes(1); // não tentou de novo sozinho
  });

  it("o erro real chega em onStateChange, não um erro sintético", async () => {
    const erroReal = new Error("motivo específico da falha");
    const save = vi.fn().mockRejectedValueOnce(erroReal);
    let erroRecebido: unknown;
    const auto = createAutoSaver<string>(save, (s, erro) => {
      if (s === "erro") erroRecebido = erro;
    });

    auto.onChange("a");
    await vi.advanceTimersByTimeAsync(800);
    expect(erroRecebido).toBe(erroReal);
  });
});

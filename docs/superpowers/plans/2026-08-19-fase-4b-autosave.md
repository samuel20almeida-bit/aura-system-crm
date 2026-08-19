# Fase 4B — Salvar automaticamente na gaveta do Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** As duas seções editáveis da gaveta do Pipeline (`NegocioDrawer.tsx`) deixam de exigir um clique em "Salvar" — a edição vira automática (debounce), com um indicador discreto de estado. As ações de negócio consequentes (Ganhar, Perder) continuam exigindo confirmação explícita e esperando o servidor, mas passam a dizer qual ação está em andamento.

**Architecture:** Um módulo puro de orquestração de debounce+save (`src/lib/autosave.ts`, sem React, testado com Vitest e fake timers — mesmo padrão de `src/lib/realtime/mutation-gate.ts`), um hook React fino por cima (`src/lib/use-autosave.ts`, sem teste de renderização — não há infraestrutura de testing-library neste projeto), e a aplicação nas duas seções de `NegocioDrawer.tsx`.

**Tech Stack:** Next.js App Router (Client Component), React `useEffect`/`useRef`/`useState`, Vitest com `vi.useFakeTimers()`.

**Base:** `main` @ `9cab57b` (Fase 4A em produção). Branch nova: `feat/fase-4b-autosave`.

## Global Constraints

- **Idioma:** português do Brasil em toda string visível ao usuário.
- **Paleta/tipografia:** tokens já existentes. Sem cor nova. O indicador de estado usa o mesmo estilo `font-mono text-[11px] text-muted` já usado em vários lugares da gaveta (ex. "na etapa há Xd" do `ImplantacaoDrawer.tsx`).
- **Sem `motion-safe:`** — não gera CSS neste projeto.
- **Sem dado fictício, sem migration.** Esta fase não toca no banco — reusa `atualizarConta`/`atualizarNegocio`, já existentes.
- **Toda escrita passa por `beginMutation()`/`end()`** de `src/lib/realtime/mutation-gate.ts` — o autosave não é exceção.
- **Verificação por tarefa:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` limpos antes de cada commit. Hoje (antes desta fase): **148 testes**.
- **Sem navegador neste ambiente.** Nunca afirmar ter visto uma tela renderizar ou testado autosave de verdade digitando num campo — a verificação da Task 3 é estrutural, a da Task 1 é via Vitest com fake timers (isso sim testa o comportamento real do módulo puro).
- **Sem `@testing-library/react` neste projeto** — nenhum hook React é testado com renderização. O hook da Task 2 não ganha teste próprio; só precisa compilar e ser usado corretamente pela Task 3.

## Contexto que esta fase herda, e a decisão que a define

Escopo desta fase é mais estreito do que "autosave em tudo": existe exatamente **um** lugar no app com edição de texto/número presa atrás de um botão "Salvar" manual — as duas seções da gaveta do Pipeline (`NegocioDrawer.tsx`). Todo o resto já está diferente: dropdowns de estágio/etapa salvam na hora (`onChange`); os modais de criação ("Novo negócio", "Nova meta", "Novo playbook") são cadastro único, autosave não se aplica (não existe registro pra salvar incrementalmente); o campo de progresso da Meta já é otimista com submit por Enter/✓; o comentário do Kanban é uma ação de "enviar", não uma edição contínua. Nenhum desses entra nesta fase.

**Decisão já tomada com o usuário** (via pergunta direta nesta conversa): as ações **Ganhar**/**Perder** (`NegocioDrawer.tsx`) e **Concluir implantação** (`ImplantacaoDrawer.tsx`) **não** viram otimistas — são eventos de negócio difíceis de desfazer, e otimismo aqui arriscaria mostrar sucesso falso numa falha de rede (a gaveta fecharia e o negócio sumiria do quadro antes de o servidor confirmar). A única melhoria aprovada para essas ações é o texto do botão dizer qual ação está em andamento. `ImplantacaoDrawer.tsx` **já faz isso certo** (`{pendente ? "Concluindo…" : "Concluir implantação"}`) — não precisa de mudança. `NegocioDrawer.tsx` **não faz** — "Ganhar" e "Perder"/"Confirmar perda" só desabilitam (`disabled={pendente}`), sem dizer o quê. A Task 3 corrige isso.

## Task 1: o módulo puro de autosave

**Files:**
- Create: `src/lib/autosave.ts`
- Test: `src/lib/autosave.test.ts`

**Interfaces produzidas** (Tasks 2 e 3 dependem destas assinaturas exatas):
```ts
export type AutoSaveState = "idle" | "salvando" | "salvo" | "erro";

export type AutoSaveController<T> = {
  /** Chame a cada mudança de valor. Reinicia o temporizador de debounce. */
  onChange(value: T): void;
  /** Cancela qualquer salvamento AGENDADO (não cancela um save já em voo). Chamar ao desmontar. */
  cancel(): void;
};

export function createAutoSaver<T>(
  save: (value: T) => Promise<void>,
  onStateChange: (state: AutoSaveState) => void,
  options?: {
    delayMs?: number; // default 800
    isEqual?: (a: T, b: T) => boolean; // default Object.is
  }
): AutoSaveController<T>
```

**Comportamento exato:**
1. `onChange(v)` agenda um save via `setTimeout(delayMs)`. Chamar `onChange` de novo antes do temporizador disparar cancela o anterior e reagenda (debounce puro — mesmo `clearTimeout`+`setTimeout` de `mutation-gate.ts`).
2. Quando o temporizador dispara: se já existe um valor salvo com sucesso anteriormente E `isEqual(valorAtual, ultimoSalvo)` é `true`, **não chama `save`** — só emite `onStateChange("idle")`. Sem isso, editar um campo e depois desfazer manualmente dispararia uma escrita desnecessária no servidor.
3. Senão, e se **não** houver um save em voo no momento: emite `onStateChange("salvando")`, chama `await save(valorAtual)`.
   - Sucesso: guarda esse valor como "último salvo com sucesso", emite `onStateChange("salvo")`.
   - Falha: emite `onStateChange("erro")`. **Não guarda** o valor como salvo (uma tentativa futura idêntica ainda vai tentar de novo — nunca fica preso achando que algo que falhou foi salvo).
4. Se o temporizador disparar **enquanto já existe um save em voo** (o usuário editou de novo rápido o bastante para o debounce reiniciar e vencer antes do primeiro `await` assentar): não inicia um segundo save concorrente. Guarda o valor mais recente e, assim que o save em voo assentar (sucesso OU falha), dispara imediatamente mais um ciclo com esse valor mais recente — sem esperar `delayMs` de novo. **Nenhuma edição feita durante um save em andamento pode ser perdida.**
5. `cancel()` só cancela um temporizador de debounce **agendado e ainda não disparado**. Não cancela nem espera um save já em voo (a promise de uma Server Action não tem um jeito seguro de ser abortada, mesmo raciocínio do cão de guarda em `mutation-gate.ts`).

- [ ] **Step 1: Escrever os testes que falham primeiro**

```ts
// src/lib/autosave.test.ts
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
    expect(states).toEqual(["idle"]);
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
    expect(states).toEqual(["idle"]);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
```

**Nota sobre `vi.advanceTimersByTimeAsync` (não `vi.advanceTimersByTime`):** o `save` retorna uma Promise de verdade — `.then()`/`.catch()`/`.finally()` resolvem como microtasks, que fake timers comuns (`advanceTimersByTime`, síncrono) não esperam. `advanceTimersByTimeAsync` avança o relógio E aguarda os microtasks pendentes se resolverem antes de devolver o controle — é a primitiva correta do Vitest para testar debounce+Promise juntos. Usar a variante síncrona aqui produziria testes instáveis (passam ou falham dependendo de timing, não do comportamento).

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/lib/autosave.test.ts`
Expected: FAIL — `Cannot find module './autosave'` (o arquivo ainda não existe).

- [ ] **Step 3: Implementar `src/lib/autosave.ts`**

```ts
/**
 * Orquestração de debounce + salvamento assíncrono, sem React. Mesmo padrão de
 * `src/lib/realtime/mutation-gate.ts`: módulo puro, testável com fake timers,
 * sem depender de DOM nem de navegador.
 *
 * Existe porque a gaveta do Pipeline (`NegocioDrawer.tsx`) tinha edição de
 * texto/número presa atrás de um botão "Salvar" manual — a única tela do
 * sistema nesse estado. Isto vira o motor; quem usa (o hook React da Task 2)
 * decide o que fazer com cada estado.
 */

export type AutoSaveState = "idle" | "salvando" | "salvo" | "erro";

export type AutoSaveController<T> = {
  onChange(value: T): void;
  cancel(): void;
};

const NAO_HA_VALOR_SALVO = Symbol("nenhum valor salvo ainda");

export function createAutoSaver<T>(
  save: (value: T) => Promise<void>,
  onStateChange: (state: AutoSaveState) => void,
  options: { delayMs?: number; isEqual?: (a: T, b: T) => boolean } = {}
): AutoSaveController<T> {
  const delayMs = options.delayMs ?? 800;
  const isEqual = options.isEqual ?? Object.is;

  let ultimoSalvo: T | typeof NAO_HA_VALOR_SALVO = NAO_HA_VALOR_SALVO;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let salvando = false;
  let valorPendenteDuranteSave: T | null = null;
  let temPendenteDuranteSave = false;

  function agendar(value: T) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      tentar(value);
    }, delayMs);
  }

  function tentar(value: T) {
    if (ultimoSalvo !== NAO_HA_VALOR_SALVO && isEqual(value, ultimoSalvo)) {
      onStateChange("idle");
      return;
    }

    if (salvando) {
      // Um save já está em voo — guarda o valor mais recente e refaz assim
      // que ele assentar, sem esperar mais um período de debounce. Editar
      // durante o save não pode perder a edição.
      valorPendenteDuranteSave = value;
      temPendenteDuranteSave = true;
      return;
    }

    salvando = true;
    onStateChange("salvando");
    save(value)
      .then(() => {
        ultimoSalvo = value;
        onStateChange("salvo");
      })
      .catch(() => {
        onStateChange("erro");
      })
      .finally(() => {
        salvando = false;
        if (temPendenteDuranteSave) {
          const proximo = valorPendenteDuranteSave as T;
          temPendenteDuranteSave = false;
          valorPendenteDuranteSave = null;
          tentar(proximo);
        }
      });
  }

  return {
    onChange(value: T) {
      agendar(value);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/lib/autosave.test.ts`
Expected: PASS — 7/7 testes.

- [ ] **Step 5:** Rodar `npm test` (suíte inteira), `npx tsc --noEmit`, `npm run lint`, `npm run build` — os quatro limpos (148 + 7 = 155 testes). Commit.

## Task 2: o hook React fino

**Files:**
- Create: `src/lib/use-autosave.ts`

**Interfaces consumidas:** `createAutoSaver`, `AutoSaveState` (Task 1, `src/lib/autosave.ts`).

**Interfaces produzidas** (Task 3 depende desta assinatura exata):
```ts
export function useAutoSave<T>(options: {
  value: T;
  /** `false` = não salva (gate de validação do chamador). Volta ao normal quando virar `true` de novo. */
  enabled: boolean;
  onSave: (value: T) => Promise<void>;
  onError?: (error: unknown) => void;
  isEqual?: (a: T, b: T) => boolean;
  delayMs?: number;
}): AutoSaveState
```

Sem teste de renderização (sem `@testing-library/react` neste projeto) — a verificação desta task é `tsc`/`lint`/`build` limpos e o uso correto na Task 3.

**Ponto de atenção que precisa ser resolvido corretamente:** o `AutoSaveController` da Task 1 é criado **uma única vez** (via `useRef`, para sobreviver a re-renderizações sem recriar o temporizador de debounce em voo). Mas `onSave`, `onError` e `isEqual` são recriados a cada renderização do componente que usa o hook (são closures sobre estado local que muda a cada tecla digitada). Se o controller guardasse a referência da PRIMEIRA renderização para sempre, ele chamaria uma versão desatualizada de `onSave` — sem problema se `onSave` só depende do parâmetro que recebe (é o caso da Task 3), mas arriscado em geral. Resolva com encaminhamento por `ref`, atualizado a cada render, para que o controller sempre chame a versão mais recente:

- [ ] **Step 1: Implementar `src/lib/use-autosave.ts`**

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import { createAutoSaver, type AutoSaveState } from "./autosave";

export function useAutoSave<T>({
  value,
  enabled,
  onSave,
  onError,
  isEqual,
  delayMs,
}: {
  value: T;
  enabled: boolean;
  onSave: (value: T) => Promise<void>;
  onError?: (error: unknown) => void;
  isEqual?: (a: T, b: T) => boolean;
  delayMs?: number;
}): AutoSaveState {
  const [state, setState] = useState<AutoSaveState>("idle");

  // Encaminhamento por ref: o controller (criado uma vez, abaixo) sempre lê a
  // versão mais recente de `onSave`/`onError`/`isEqual` através destas refs,
  // mesmo criado a partir dos valores da primeira renderização.
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const isEqualRef = useRef(isEqual);
  isEqualRef.current = isEqual;

  const controllerRef = useRef<ReturnType<typeof createAutoSaver<T>> | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createAutoSaver<T>(
      (v) => onSaveRef.current(v),
      (s) => {
        setState(s);
        if (s === "erro") onErrorRef.current?.(new Error("autosave falhou"));
      },
      {
        delayMs,
        isEqual: isEqualRef.current ? (a, b) => isEqualRef.current!(a, b) : undefined,
      }
    );
  }

  useEffect(() => {
    const controller = controllerRef.current;
    return () => controller?.cancel();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    controllerRef.current?.onChange(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara a cada
    // mudança de `value`/`enabled`; `onSave`/`onError`/`isEqual` chegam pelo
    // controller via ref (ver acima), não precisam disparar o efeito de novo.
  }, [value, enabled]);

  return state;
}
```

- [ ] **Step 2:** Rodar `npx tsc --noEmit` e `npm run lint` — os dois limpos (sem teste novo, `npm test` continua em 155). Commit.

## Task 3: aplicar em `NegocioDrawer.tsx`

**Files:**
- Modify: `src/components/pipeline/NegocioDrawer.tsx`

**Interfaces consumidas:** `useAutoSave` (Task 2, `src/lib/use-autosave.ts`).

Esta task muda duas coisas independentes no mesmo arquivo: (1) as duas seções editáveis ganham autosave no lugar do botão manual; (2) os botões Ganhar/Perder/Confirmar perda passam a dizer qual ação está em andamento. Leia o arquivo inteiro antes de começar — os números de linha abaixo podem já ter mudado.

### Parte 1 — seção "A CONTA" ganha autosave

Hoje (`src/components/pipeline/NegocioDrawer.tsx`, dentro do bloco que renderiza "A CONTA"):
```tsx
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-muted">Dono: {negocio.dono?.full_name ?? "—"}</span>
            <Button
              variant="ghost"
              disabled={pendente || !contaNome.trim()}
              onClick={() =>
                executar("salvar a conta", () =>
                  atualizarConta({
                    contaId: negocio.conta_id,
                    nome: contaNome,
                    nicho: contaNicho.trim() || null,
                    cidade: contaCidade.trim() || null,
                    uf: contaUf.trim() || null,
                    decisorNome: contaDecisor.trim() || null,
                    softwareAtual: contaSoftware.trim() || null,
                    origem: contaOrigem.trim() || null,
                    email: contaEmail.trim() || null,
                    telefone: contaTelefone.trim() || null,
                    site: contaSite.trim() || null,
                  })
                )
              }
            >
              {pendente ? "Salvando…" : "Salvar conta"}
            </Button>
          </div>
```

Vira: o botão some, e o `<span>` da direita passa a mostrar o estado do autosave (ou a razão de não estar salvando, se o nome estiver vazio).

- [ ] **Step 1:** Acrescentar o import e o estado do autosave da conta, logo depois dos `useState` de `contaSite` (perto do fim do bloco de estados da conta):

```tsx
import { useAutoSave } from "@/lib/use-autosave";
```

```tsx
  const contaNomeValido = contaNome.trim() !== "";
  const contaAutoSaveStatus = useAutoSave({
    value: {
      nome: contaNome,
      nicho: contaNicho,
      cidade: contaCidade,
      uf: contaUf,
      decisorNome: contaDecisor,
      softwareAtual: contaSoftware,
      origem: contaOrigem,
      email: contaEmail,
      telefone: contaTelefone,
      site: contaSite,
    },
    enabled: contaNomeValido,
    isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    onSave: async (v) => {
      // Mesmo padrão de `executar()` (beginMutation/end + refresh) — o
      // autosave não é uma exceção à regra do portão. Sem `catch` aqui de
      // propósito: o erro precisa SUBIR para `createAutoSaver` decidir que o
      // save falhou e chamar `onError` — engolir o erro aqui faria o módulo
      // achar que salvou com sucesso.
      const end = beginMutation();
      try {
        await atualizarConta({
          contaId: negocio.conta_id,
          nome: v.nome,
          nicho: v.nicho.trim() || null,
          cidade: v.cidade.trim() || null,
          uf: v.uf.trim() || null,
          decisorNome: v.decisorNome.trim() || null,
          softwareAtual: v.softwareAtual.trim() || null,
          origem: v.origem.trim() || null,
          email: v.email.trim() || null,
          telefone: v.telefone.trim() || null,
          site: v.site.trim() || null,
        });
        router.refresh();
      } finally {
        end();
      }
    },
    onError: (erro) => {
      console.error("[pipeline] falha ao salvar a conta:", erro);
      notify("error", "Não foi possível salvar a conta. Tente de novo — se persistir, me avise.");
    },
  });
  const contaStatusTexto = !contaNomeValido
    ? "nome não pode ficar vazio"
    : contaAutoSaveStatus === "salvando"
      ? "salvando…"
      : contaAutoSaveStatus === "salvo"
        ? "salvo"
        : "";
```

`isEqual` compara por `JSON.stringify` porque `value` é um objeto plano recriado a cada renderização (referência nova sempre) — sem isso, o autosave nunca reconheceria "nada mudou" e salvaria a cada 800ms indefinidamente enquanto a gaveta estiver aberta.

- [ ] **Step 2:** Trocar o bloco do botão pelo indicador de estado:

```tsx
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-muted">Dono: {negocio.dono?.full_name ?? "—"}</span>
            <span className="font-mono text-[11px] text-muted">{contaStatusTexto}</span>
          </div>
```

### Parte 2 — seção "O NEGÓCIO" ganha autosave

Hoje, o botão "Definir próximo passo" mora no rodapé da gaveta (fora da seção "O NEGÓCIO", só visualmente perto). Ele sai do rodapé; a seção "O NEGÓCIO" ganha seu próprio indicador de estado ao final, no mesmo padrão da Parte 1.

- [ ] **Step 3:** Acrescentar o estado do autosave do negócio, perto de `valoresInvalidos`:

```tsx
  const negocioAutoSaveStatus = useAutoSave({
    value: { proximoPasso, proximoPassoEm, setup, mrr },
    enabled: !valoresInvalidos,
    isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    onSave: async (v) => {
      // Mesmo padrão de `executar()` (beginMutation/end + refresh); sem
      // `catch` pelo mesmo motivo do onSave da conta acima — o erro precisa
      // chegar em `createAutoSaver`.
      const end = beginMutation();
      try {
        await atualizarNegocio({
          negocioId: negocio.id,
          proximoPasso: v.proximoPasso.trim() || null,
          proximoPassoEm: v.proximoPassoEm || null,
          setup: numeroOuNulo(v.setup),
          mrr: numeroOuNulo(v.mrr),
        });
        router.refresh();
      } finally {
        end();
      }
    },
    onError: (erro) => {
      console.error("[pipeline] falha ao salvar o próximo passo:", erro);
      notify("error", "Não foi possível salvar o próximo passo. Tente de novo — se persistir, me avise.");
    },
  });
  const negocioStatusTexto = valoresInvalidos
    ? "valores não podem ser negativos"
    : negocioAutoSaveStatus === "salvando"
      ? "salvando…"
      : negocioAutoSaveStatus === "salvo"
        ? "salvo"
        : "";
```

- [ ] **Step 4:** No fim do bloco "O NEGÓCIO" (depois do grid SETUP/MENSALIDADE, antes do `</div>` que fecha a seção), acrescentar o indicador:

```tsx
          <div className="flex justify-end">
            <span className="font-mono text-[11px] text-muted">{negocioStatusTexto}</span>
          </div>
```

- [ ] **Step 5:** No rodapé, remover o botão "Definir próximo passo" inteiro (o bloco `<Button disabled={pendente || valoresInvalidos} onClick={() => executar("salvar o próximo passo", ...)}>{pendente ? "Salvando…" : "Definir próximo passo"}</Button>`) e trocar o container do rodapé (o ramo `!pedindoMotivo` do `<>...</>`) de `justify-between` implícito (herdado do pai) para conter só o grupo Ganhar/Perder, alinhado à direita:

Antes:
```tsx
        ) : (
          <>
            <Button
              disabled={pendente || valoresInvalidos}
              onClick={() =>
                executar("salvar o próximo passo", () =>
                  atualizarNegocio({
                    negocioId: negocio.id,
                    proximoPasso: proximoPasso.trim() || null,
                    proximoPassoEm: proximoPassoEm || null,
                    setup: numeroOuNulo(setup),
                    mrr: numeroOuNulo(mrr),
                  })
                )
              }
            >
              {pendente ? "Salvando…" : "Definir próximo passo"}
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                disabled={pendente}
                onClick={() => {
                  if (!confirm("Marcar como ganho? Isso vira uma implantação depois.")) return;
                  executar("marcar o negócio como ganho", () => ganharNegocio(negocio.id), onClose);
                }}
              >
                Ganhar
              </Button>
              <Button variant="danger" disabled={pendente} onClick={() => setPedindoMotivo(true)}>
                Perder
              </Button>
            </div>
          </>
        )}
```

Depois (o grupo Ganhar/Perder sozinho, empurrado pra direita com `ml-auto` já que o pai é um `flex` sem `justify-end` fixo — ver Parte 3 abaixo pro texto dos botões):
```tsx
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              disabled={pendente}
              onClick={() => {
                if (!confirm("Marcar como ganho? Isso vira uma implantação depois.")) return;
                setAcaoAtual("ganhar");
                executar("marcar o negócio como ganho", () => ganharNegocio(negocio.id), onClose);
              }}
            >
              {pendente && acaoAtual === "ganhar" ? "Marcando como ganho…" : "Ganhar"}
            </Button>
            <Button variant="danger" disabled={pendente} onClick={() => setPedindoMotivo(true)}>
              Perder
            </Button>
          </div>
        )}
```

### Parte 3 — Ganhar/Perder dizem qual ação está em andamento

- [ ] **Step 6:** Acrescentar o estado `acaoAtual` perto de `pedindoMotivo`/`motivo`:

```tsx
  const [acaoAtual, setAcaoAtual] = useState<"ganhar" | "perder" | null>(null);
```

- [ ] **Step 7:** O botão "Ganhar" já ganhou o texto condicional no Step 5. Fazer o mesmo em "Confirmar perda" (ramo `pedindoMotivo` do rodapé):

Antes:
```tsx
            <Button
              variant="danger"
              disabled={pendente || motivo.trim() === ""}
              onClick={() =>
                executar("marcar o negócio como perdido", () => perderNegocio(negocio.id, motivo.trim()), onClose)
              }
            >
              Confirmar perda
            </Button>
```

Depois:
```tsx
            <Button
              variant="danger"
              disabled={pendente || motivo.trim() === ""}
              onClick={() => {
                setAcaoAtual("perder");
                executar("marcar o negócio como perdido", () => perderNegocio(negocio.id, motivo.trim()), onClose);
              }}
            >
              {pendente && acaoAtual === "perder" ? "Marcando como perdido…" : "Confirmar perda"}
            </Button>
```

`acaoAtual` nunca precisa ser resetado explicitamente para `null`: ou a gaveta fecha (`onClose`, sucesso — o componente inteiro desmonta) ou a escrita falha (o `catch` de `executar` já mostra o toast de erro; o botão volta ao texto normal porque `pendente` volta a `false`, e a próxima tentativa chama `setAcaoAtual` de novo antes de qualquer novo `executar`).

- [ ] **Step 8:** Rodar `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` — os quatro limpos (155 testes, nenhum teste novo nesta task — é integração de UI, verificada estruturalmente). Commit.

## Self-review desta task (antes de despachar)

- `contaNomeValido`/`valoresInvalidos` continuam sendo a MESMA regra de validação que já existia (só mudou de "desabilita botão" para "gate do `enabled` do autosave + texto explicando por quê") — nenhuma regra nova foi inventada.
- Ganhar/Perder continuam exigindo clique explícito + (no caso de Perder) motivo preenchido — nada virou automático nessas duas ações, só o texto do botão mudou.
- `negocio.conta_id` e `negocio.id` (usados dentro de `onSave`) vêm de `props`, estáveis durante a vida do componente (o pai remonta com `key={negocio.id}` ao trocar de negócio) — não precisam estar no `value` do autosave nem em nenhuma lista de dependência.
- **Achado corrigido durante a escrita deste plano:** a primeira versão dos dois `onSave` não passava por `beginMutation()`/`end()` nem chamava `router.refresh()` — violava a própria Global Constraint desta fase e divergia do padrão que `executar()` já segue em toda escrita da gaveta. Corrigido: cada `onSave` abre o portão, chama a Server Action, atualiza a tela com `router.refresh()` em caso de sucesso, e fecha o portão num `finally` — sem `catch` (o erro precisa subir até `createAutoSaver` para o módulo saber que a tentativa falhou; um `catch` aqui faria o autosave achar que salvou com sucesso mesmo numa falha).
- `router.refresh()` dentro de `onSave` não reseta os campos que o usuário está digitando: `NegocioDrawer` é remontado por `key={negocio.id}` (que não muda numa edição), então o refresh só atualiza as `props` vindas do servidor — o estado local (`contaNome`, `proximoPasso` etc.) continua sendo a fonte da verdade da tela, do mesmo jeito que já era com o botão manual.

## Verificação final da 4B

Mesmo ciclo das fases anteriores: revisão da branch inteira contra `main`, rodada de correção se necessário, merge fast-forward, push, confirmar deploy na Vercel.

**O que só o Samuel/Saymon podem fazer:** abrir um negócio no Pipeline, editar um campo da conta ou o próximo passo, e conferir que "salvando…" aparece e depois "salvo" — sem clicar em nada. **Atenção a um cenário específico que os testes automatizados NÃO cobrem:** digitar e fechar a gaveta antes dos 800ms de debounce vencerem (o teste "edição durante um save em voo" da Task 1 garante outra coisa — que uma edição feita enquanto um save anterior já está em voo não se perde; não cobre o caso do timer de debounce ainda nem ter disparado quando a gaveta fecha). Vale um teste manual desse cenário específico antes de considerar a fase encerrada.

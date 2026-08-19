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

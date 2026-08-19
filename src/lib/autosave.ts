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
  onStateChange: (state: AutoSaveState, error?: unknown) => void,
  options: {
    delayMs?: number;
    isEqual?: (a: T, b: T) => boolean;
    initialValue?: T;
  } = {}
): AutoSaveController<T> {
  const delayMs = options.delayMs ?? 800;
  const isEqual = options.isEqual ?? Object.is;
  const temInicial = "initialValue" in options;

  // `ultimoValorRecebido` e `ultimoSalvo` começam iguais quando `initialValue`
  // é dado: o valor que já veio "do servidor" (ex: ao abrir um formulário)
  // não conta como edição — nem reagenda o debounce (ver `agendar`), nem, se
  // por algum motivo chegasse a `tentar()`, dispararia um save. Sem isto,
  // abrir a gaveta do Pipeline pra só olhar já gravava no banco e zerava
  // `mexido_em`, o relógio do apodrecimento do sistema inteiro (achado C1 da
  // revisão final da Fase 4B).
  let ultimoValorRecebido: T | typeof NAO_HA_VALOR_SALVO = temInicial
    ? (options.initialValue as T)
    : NAO_HA_VALOR_SALVO;
  let ultimoSalvo: T | typeof NAO_HA_VALOR_SALVO = temInicial ? (options.initialValue as T) : NAO_HA_VALOR_SALVO;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let salvando = false;
  let valorPendenteDuranteSave: T | null = null;
  let temPendenteDuranteSave = false;

  function agendar(value: T) {
    // Reagenda o debounce só quando o CONTEÚDO muda, não a cada chamada de
    // `onChange` — quem chama (o hook React) recria o objeto de valor a cada
    // renderização, inclusive quando o motivo da renderização é outro campo
    // do mesmo formulário, ou o próprio autosave mudando de estado depois de
    // uma falha. Sem esta checagem, um save que falha reagenda pra sempre
    // (achado C2: erro muda o estado → re-render → `value` é referência
    // nova → efeito dispara `onChange` de novo → reagenda, sem fim) e editar
    // um campo atrasa o save de outro campo/seção indefinidamente (achado
    // I3).
    if (ultimoValorRecebido !== NAO_HA_VALOR_SALVO && isEqual(value, ultimoValorRecebido)) {
      return;
    }
    ultimoValorRecebido = value;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      tentar(value);
    }, delayMs);
  }

  function tentar(value: T) {
    if (salvando) {
      // Um save já está em voo — `ultimoSalvo` ainda não é definitivo (só
      // atualiza quando ESSE save assentar), então comparar com ele agora
      // compararia contra um valor prestes a ficar obsoleto. Enfileira e
      // deixa a checagem de igualdade rodar de novo depois, com o
      // `ultimoSalvo` já atualizado.
      valorPendenteDuranteSave = value;
      temPendenteDuranteSave = true;
      return;
    }

    if (ultimoSalvo !== NAO_HA_VALOR_SALVO && isEqual(value, ultimoSalvo)) {
      onStateChange("idle");
      return;
    }

    salvando = true;
    onStateChange("salvando");
    save(value)
      .then(() => {
        ultimoSalvo = value;
        onStateChange("salvo");
      })
      .catch((erro) => {
        // O erro real precisa chegar em quem escuta — engolir aqui obrigava
        // o hook React a inventar um erro genérico, e o `console.error` do
        // chamador acabava logando "autosave falhou" em vez do motivo de
        // verdade (validação do servidor, rede, RLS...) — achado I2 da
        // revisão final.
        onStateChange("erro", erro);
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

/**
 * Conta escritas locais em andamento. Enquanto houver alguma, a atualização por
 * tempo real espera — é o que impede o eco da própria ação de passar por cima
 * do otimismo da Fase 1 e causar piscada ou reversão visível.
 *
 * Módulo puro: sem React, sem DOM. Um contador, não um booleano, porque duas
 * ações podem estar em voo ao mesmo tempo (arrastar um card enquanto um
 * comentário salva) e a primeira a terminar não pode liberar o portão.
 */
type Listener = () => void;

let inFlight = 0;
const listeners = new Set<Listener>();

function notify() {
  for (const fn of listeners) fn();
}

export function beginMutation(): () => void {
  inFlight += 1;
  notify();
  let released = false;
  return function end() {
    if (released) return;
    released = true;
    inFlight = Math.max(0, inFlight - 1);
    notify();
  };
}

export function isMutating(): boolean {
  return inFlight > 0;
}

export function subscribeToGate(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Só para os testes: zera o contador entre casos. */
export function resetGateForTests() {
  inFlight = 0;
  listeners.clear();
}

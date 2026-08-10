"use client";

/**
 * Conta escritas locais em andamento. Enquanto houver alguma, a atualização por
 * tempo real espera — é o que impede o eco da própria ação de passar por cima do
 * otimismo da Fase 1 e causar piscada ou reversão visível.
 *
 * Módulo puro: sem React, sem DOM, sem Supabase. Roda em Node, e é por isso que
 * os testes conseguem exercitar o contador sem navegador. O `"use client"` do
 * topo não atrapalha o vitest (é só uma diretiva de string); está aqui para que
 * uma Server Action que importasse este módulo por engano falhasse no build em
 * vez de silenciosamente transformar `inFlight` num global de processo,
 * compartilhado entre usuários diferentes.
 *
 * Um contador, não um booleano, porque duas ações podem estar em voo ao mesmo
 * tempo (arrastar um card enquanto um comentário salva) e a primeira a terminar
 * não pode liberar o portão.
 */

/**
 * Promessa de Server Action não tem timeout. Aba congelada, wifi caindo no meio
 * do POST: a promessa nunca assenta, o `finally` de quem chamou nunca roda, e o
 * contador ficaria em 1 para sempre — travando a atualização ao vivo de TODAS as
 * telas, porque o contador é de módulo. Perder a supressão do eco de uma escrita
 * que já levou 15 segundos é barato; ficar sem tempo real até recarregar a
 * página, não.
 */
const MUTATION_WATCHDOG_MS = 15_000;

let inFlight = 0;
const watchdogs = new Set<ReturnType<typeof setTimeout>>();

/** Marca uma escrita local em andamento. O retorno a encerra, e encerra uma vez só. */
export function beginMutation(): () => void {
  inFlight += 1;
  let released = false;

  function release() {
    if (released) return;
    released = true;
    inFlight = Math.max(0, inFlight - 1);
  }

  const watchdog = setTimeout(() => {
    watchdogs.delete(watchdog);
    release();
  }, MUTATION_WATCHDOG_MS);
  watchdogs.add(watchdog);

  return function end() {
    clearTimeout(watchdog);
    watchdogs.delete(watchdog);
    release();
  };
}

export function isMutating(): boolean {
  return inFlight > 0;
}

/** Só para os testes: zera o contador e os cães de guarda entre casos. */
export function resetGateForTests() {
  for (const watchdog of watchdogs) clearTimeout(watchdog);
  watchdogs.clear();
  inFlight = 0;
}

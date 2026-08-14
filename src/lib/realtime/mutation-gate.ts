"use client";

/**
 * Conta o que está acontecendo localmente agora. Enquanto houver algo em curso,
 * a atualização por tempo real espera — é o que impede o eco da própria ação de
 * passar por cima do otimismo da Fase 1 e causar piscada ou reversão visível.
 *
 * Módulo puro: sem React, sem DOM, sem Supabase. Roda em Node, e é por isso que
 * os testes conseguem exercitar os contadores sem navegador. O `"use client"` do
 * topo não atrapalha o vitest (é só uma diretiva de string); está aqui para que
 * uma Server Action que importasse este módulo por engano falhasse no build em
 * vez de silenciosamente transformar os contadores em globais de processo,
 * compartilhados entre usuários diferentes.
 *
 * Contadores, não booleanos, porque duas coisas podem estar em voo ao mesmo
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

/**
 * O mesmo seguro para a interação, com prazo muito mais folgado: o arraste é
 * liberado pelo par `onDragEnd`/`onDragCancel` e pela desmontagem do quadro, mas
 * se algum caminho escapar de todos os três o tempo real não pode morrer junto.
 * Dois minutos é mais do que qualquer arraste real e menos do que "para sempre".
 */
const INTERACTION_WATCHDOG_MS = 120_000;

let inFlight = 0;
let interactions = 0;
const watchdogs = new Set<ReturnType<typeof setTimeout>>();

/** Cria um contador com liberação idempotente e cão de guarda próprio. */
function begin(increment: (delta: number) => void, watchdogMs: number): () => void {
  increment(1);
  let released = false;

  function release() {
    if (released) return;
    released = true;
    increment(-1);
  }

  const watchdog = setTimeout(() => {
    watchdogs.delete(watchdog);
    release();
  }, watchdogMs);
  watchdogs.add(watchdog);

  return function end() {
    clearTimeout(watchdog);
    watchdogs.delete(watchdog);
    release();
  };
}

/** Marca uma escrita local em andamento. O retorno a encerra, e encerra uma vez só. */
export function beginMutation(): () => void {
  return begin((delta) => {
    inFlight = Math.max(0, inFlight + delta);
  }, MUTATION_WATCHDOG_MS);
}

export function isMutating(): boolean {
  return inFlight > 0;
}

/**
 * Marca uma interação direta em curso — hoje, um card na mão do usuário.
 *
 * É irmão do portão de escrita e existe porque a janela importa: o efeito que
 * sincroniza a opção `paused` do hook roda depois do commit, como macrotask, e
 * pode perder a corrida para um `setTimeout` já vencido. Chamado do
 * `onDragStart`, isto é manipulador de evento, não render: o contador sobe antes
 * de o React ter qualquer coisa a agendar.
 *
 * NOTA DE ESCOPO: hoje ninguém consulta este contador enquanto o Kanban está
 * aberto, porque `useLiveRefresh` só é montado na /início — a Parte I parou em
 * 3 de 7 e o Kanban ao vivo ficou de fora. A proteção é preventiva, não ativa.
 */
export function beginInteraction(): () => void {
  return begin((delta) => {
    interactions = Math.max(0, interactions + delta);
  }, INTERACTION_WATCHDOG_MS);
}

export function isInteracting(): boolean {
  return interactions > 0;
}

/** Só para os testes: zera os contadores e os cães de guarda entre casos. */
export function resetGateForTests() {
  for (const watchdog of watchdogs) clearTimeout(watchdog);
  watchdogs.clear();
  inFlight = 0;
  interactions = 0;
}

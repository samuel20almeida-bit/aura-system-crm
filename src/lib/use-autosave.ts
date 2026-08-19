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
  // versão mais recente de `onSave`/`onError`/`isEqual` através destas refs.
  // A sincronia acontece em efeito, e não durante o render: escrever em ref
  // no meio do render é erro de lint neste projeto (react-hooks/refs) e não
  // é confiável com renderização concorrente (mesmo padrão de
  // `src/lib/realtime/useLiveRefresh.ts`).
  const onSaveRef = useRef(onSave);
  const onErrorRef = useRef(onError);
  const isEqualRef = useRef(isEqual);
  useEffect(() => {
    onSaveRef.current = onSave;
    onErrorRef.current = onError;
    isEqualRef.current = isEqual;
  }, [onSave, onError, isEqual]);

  // `setState` não pode rodar depois do componente desmontar, mas o `onError`
  // (log + toast) continua válido mesmo com a gaveta fechada — é uma falha
  // real acontecendo em segundo plano, e o usuário se beneficia de saber.
  // Só o `setState` é exclusivo de componente vivo (achado M5 da revisão
  // final: a versão anterior bloqueava os dois, e uma falha depois do
  // desmonte não avisava ninguém — nem toast, nem log).
  const montadoRef = useRef(true);

  // Capturado só na primeira renderização (`useRef` ignora o argumento em
  // renders seguintes) — semeia `createAutoSaver` pra o primeiro `onChange`
  // (disparado no mount, com o valor que já veio do servidor) não contar
  // como edição. Ver achado C1 da revisão final da Fase 4B: abrir a gaveta
  // do Pipeline só pra olhar estava gravando no banco e zerando `mexido_em`,
  // o relógio do apodrecimento do sistema inteiro.
  const valorInicialRef = useRef(value);

  // O controller precisa ser criado uma única vez (sobrevive a
  // re-renderizações sem recriar o temporizador de debounce em voo), mas
  // `createAutoSaver` não pode ser chamado durante o render: as closures que
  // ele guarda leem refs (`onSaveRef`/`onErrorRef`/`isEqualRef`), e ler ref
  // durante o render é erro de lint neste projeto (react-hooks/refs) — a
  // criação (e a leitura/escrita das refs que ela envolve) acontece no
  // `useEffect` de mount abaixo, não aqui.
  const controllerRef = useRef<ReturnType<typeof createAutoSaver<T>> | null>(null);

  useEffect(() => {
    // Reseta a cada (re)montagem — inclusive o double-invoke de
    // desenvolvimento do Strict Mode, que roda mount→cleanup→mount de novo:
    // sem isto, o cleanup do primeiro mount marcaria `false` para sempre e
    // nenhum `onStateChange` do controller real (do segundo mount) jamais
    // atualizaria o estado.
    montadoRef.current = true;
    const controller = createAutoSaver<T>(
      (v) => onSaveRef.current(v),
      (s, erro) => {
        if (montadoRef.current) setState(s);
        if (s === "erro") onErrorRef.current?.(erro);
      },
      {
        delayMs,
        isEqual: (a, b) => (isEqualRef.current ? isEqualRef.current(a, b) : Object.is(a, b)),
        initialValue: valorInicialRef.current,
      }
    );
    controllerRef.current = controller;
    return () => {
      montadoRef.current = false;
      controller.cancel();
    };
    // Criado uma única vez no mount; `delayMs` fixa o intervalo de debounce
    // para a vida do controller (não deve recriá-lo), e `onSave`/`onError`/
    // `isEqual` chegam por ref (ver acima) — não precisam disparar o efeito
    // de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!enabled) return;
    controllerRef.current?.onChange(value);
  }, [value, enabled]);

  return state;
}

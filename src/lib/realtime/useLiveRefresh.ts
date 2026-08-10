"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isMutating, subscribeToGate } from "./mutation-gate";

export type LiveStatus = "conectando" | "ao-vivo" | "sem-conexao";

const DEBOUNCE_MS = 400;

/**
 * Assina mudanças nas tabelas indicadas e pede dados novos ao servidor.
 *
 * `router.refresh()` refaz o payload do servidor preservando o estado dos
 * componentes cliente — janela aberta e campo digitado sobrevivem. O que NÃO
 * sobrevive é estado derivado de props, como o `columns` do KanbanBoard: por
 * isso existe `paused`, e por isso o Kanban a usa durante o arraste.
 */
export function useLiveRefresh(tables: string[], options?: { paused?: boolean }): LiveStatus {
  const router = useRouter();
  const [status, setStatus] = useState<LiveStatus>("conectando");
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // O valor de `paused` é lido dentro de um setTimeout, fora de render, então
  // precisa viver num ref. A sincronia acontece em efeito, e não durante o
  // render: escrever em ref no meio do render é erro de lint neste projeto
  // (react-hooks/refs) e não é confiável com renderização concorrente.
  const pausedNow = Boolean(options?.paused);
  const paused = useRef(pausedNow);
  useEffect(() => {
    paused.current = pausedNow;
  }, [pausedNow]);

  // A lista vira string para não reassinar a cada render por identidade nova.
  const key = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`aura:${key}`);

    function flush() {
      timer.current = null;
      if (!pending.current) return;
      if (paused.current || isMutating()) {
        timer.current = setTimeout(flush, DEBOUNCE_MS);
        return;
      }
      pending.current = false;
      router.refresh();
    }

    function schedule() {
      pending.current = true;
      if (timer.current) return;
      timer.current = setTimeout(flush, DEBOUNCE_MS);
    }

    for (const table of key.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
    }

    channel.subscribe((s) => {
      if (s === "SUBSCRIBED") setStatus("ao-vivo");
      else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") setStatus("sem-conexao");
    });

    // Uma escrita que termina enquanto havia evento represado precisa acordar o
    // flush; senão a atualização fica esperando o próximo evento do outro.
    const unsubscribeGate = subscribeToGate(() => {
      if (pending.current && !timer.current) timer.current = setTimeout(flush, 0);
    });

    return () => {
      unsubscribeGate();
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [key, router]);

  return status;
}

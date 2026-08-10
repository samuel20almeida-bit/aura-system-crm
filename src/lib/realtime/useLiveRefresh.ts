"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isMutating } from "./mutation-gate";

export type LiveStatus = "conectando" | "ao-vivo" | "sem-conexao";

const DEBOUNCE_MS = 400;

/**
 * Teto de espera do adiamento. Passado isto, o refresh acontece mesmo com o
 * portão de escrita fechado ou com `paused` ligado: uma piscada é melhor do que
 * dado velho apresentado em silêncio como se fosse novo.
 */
const MAX_DEFER_MS = 5_000;

/**
 * Assina mudanças nas tabelas indicadas e pede dados novos ao servidor.
 *
 * `router.refresh()` refaz o payload do servidor preservando o estado dos
 * componentes cliente — janela aberta e campo digitado sobrevivem. O que NÃO
 * sobrevive é estado derivado de props, como o `columns` do KanbanBoard: por
 * isso existe `paused`.
 */
export function useLiveRefresh(tables: string[], options?: { paused?: boolean }): LiveStatus {
  const router = useRouter();
  const [status, setStatus] = useState<LiveStatus>("conectando");
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Instante do primeiro adiamento desta rodada; null quando não há adiamento em curso. */
  const adiadoDesde = useRef<number | null>(null);

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

  // `RealtimeClient.channel(topic)` deduplica por tópico e `createBrowserClient`
  // é singleton: dois consumidores com a mesma lista de tabelas receberiam o
  // MESMO canal, e o `.on()` do segundo lançaria "cannot add postgres_changes
  // callbacks after subscribe" — a página inteira quebra. Sem lançar, o primeiro
  // a desmontar mataria o tempo real do outro em silêncio. Um tópico por
  // instância do hook resolve os dois. O saneamento é seguro contra um formato
  // futuro de `useId` que traga caracteres que o tópico não aceite.
  const instanceId = useId().replace(/[^a-zA-Z0-9]+/g, "-");

  useEffect(() => {
    // O `removeChannel` da limpeza dispara CLOSED de forma síncrona. No desmonte
    // é inócuo, mas numa troca de `key` pintaria "sem-conexao" e faria a faixa de
    // aviso piscar durante navegação normal.
    let cancelado = false;
    const supabase = createClient();
    const channel = supabase.channel(`aura:${instanceId}:${key}`);

    function flush() {
      timer.current = null;
      if (!pending.current) return;

      if (paused.current || isMutating()) {
        // Promessa de Server Action não tem timeout, e `paused` é decisão de
        // quem consome. Sem um teto, um adiamento vira silêncio permanente com o
        // status ainda dizendo que está tudo bem.
        if (adiadoDesde.current === null) adiadoDesde.current = Date.now();
        if (Date.now() - adiadoDesde.current < MAX_DEFER_MS) {
          timer.current = setTimeout(flush, DEBOUNCE_MS);
          return;
        }
      }

      pending.current = false;
      adiadoDesde.current = null;
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
      if (cancelado) return;
      if (s === "SUBSCRIBED") setStatus("ao-vivo");
      else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") setStatus("sem-conexao");
    });

    return () => {
      cancelado = true;
      // Zerar os refs, e não só chamar clearTimeout: `setTimeout` devolve inteiro
      // positivo, sempre truthy, e refs sobrevivem à re-execução do efeito. Um
      // `timer.current` obsoleto faria o `schedule()` seguinte retornar sem
      // agendar nada — o hook ficaria surdo para sempre.
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current = false;
      adiadoDesde.current = null;
      supabase.removeChannel(channel);
    };
  }, [instanceId, key, router]);

  return status;
}

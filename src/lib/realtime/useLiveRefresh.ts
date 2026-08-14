"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isInteracting, isMutating } from "./mutation-gate";

/** Estado do canal em si — só fala do transporte, não da frescura do dado. */
export type TransportStatus = "conectando" | "ao-vivo" | "sem-conexao";

/**
 * O que uma tela precisa saber para dizer a verdade sobre defasagem.
 *
 * `transport` sozinho mente: um canal perfeitamente vivo continua dizendo
 * "ao-vivo" enquanto o portão segura um refresh represado. Uma faixa de aviso
 * honesta precisaria das três informações juntas. *
 * NOTA DE ESCOPO — a Parte I parou em 3 de 7 tarefas. Hoje NADA lê este retorno:
 * o único consumidor (`LiveActivity`) o descarta. A faixa de defasagem que
 * usaria estes três campos era a Task 6, cancelada quando o negócio mudou de
 * direção. Os campos ficam porque estão corretos e são exatamente o que uma
 * faixa dessas precisaria — não porque exista uma.
 */
export type LiveStatus = {
  transport: TransportStatus;
  /** Há evento recebido esperando virar atualização. */
  pendente: boolean;
  /** Instante (ms) do último `router.refresh()` — na montagem, o do payload do servidor. */
  ultimaAtualizacao: number;
};

const DEBOUNCE_MS = 400;

/**
 * Teto de espera do adiamento. Passado isto, o refresh acontece mesmo com o
 * portão de escrita fechado ou com `paused` ligado: uma piscada é melhor do que
 * dado velho apresentado em silêncio como se fosse novo.
 *
 * Não vale para a interação — ver `flush`.
 */
const MAX_DEFER_MS = 5_000;

/**
 * Assina mudanças nas tabelas indicadas e pede dados novos ao servidor.
 *
 * `router.refresh()` refaz o payload do servidor preservando o estado dos
 * componentes cliente — janela aberta e campo digitado sobrevivem. O que NÃO
 * sobrevive é estado derivado de props, como o `columns` do KanbanBoard: por
 * isso existe o contador de interação do `mutation-gate`, setado no
 * `onDragStart` do quadro.
 *
 * NOTA DE ESCOPO: essa proteção está posta À FRENTE de um Kanban ao vivo que a
 * Parte I não chegou a entregar. Hoje este hook só é montado na /início, então
 * nenhum refresh de tempo real alcança o quadro e o contador de interação nunca
 * é consultado por lá. Não remova achando que é código morto: é o que torna
 * seguro assinar `tasks` no dia em que o Kanban entrar.
 *
 * A opção `paused` continua aqui porque é útil e barata, mas ela não é a
 * garantia do arraste: o efeito que a sincroniza roda depois do commit e pode
 * perder a corrida para um `setTimeout` já vencido. Quem garante é o contador.
 */
export function useLiveRefresh(tables: string[], options?: { paused?: boolean }): LiveStatus {
  const router = useRouter();
  const [transport, setTransport] = useState<TransportStatus>("conectando");
  const [pendente, setPendente] = useState(false);
  // Na montagem o payload do servidor acabou de chegar, então ele é a última
  // atualização que existe. Zero aqui faria toda tela nascer "defasada em 1970".
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(() => Date.now());

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
  // callbacks after subscribe" — a página inteira quebra. Um tópico por
  // instância do hook resolve. O saneamento é seguro contra um formato futuro de
  // `useId` que traga caracteres que o tópico não aceite.
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

      // Bloqueio duro, sem prazo: enquanto o usuário tem um card na mão,
      // atualizar não é uma piscada, é arrancar o trabalho da mão dele. Um
      // arraste pode durar muito mais que MAX_DEFER_MS e ainda assim ser
      // legítimo; quem impede que ele dure para sempre é o cão de guarda do
      // contador de interação.
      if (isInteracting()) {
        timer.current = setTimeout(flush, DEBOUNCE_MS);
        return;
      }

      // Bloqueio com prazo: escrita local em voo ou `paused` ligado adiam, mas
      // não para sempre.
      if (paused.current || isMutating()) {
        if (adiadoDesde.current === null) adiadoDesde.current = Date.now();
        if (Date.now() - adiadoDesde.current < MAX_DEFER_MS) {
          timer.current = setTimeout(flush, DEBOUNCE_MS);
          return;
        }
      }

      pending.current = false;
      adiadoDesde.current = null;
      setPendente(false);
      setUltimaAtualizacao(Date.now());
      router.refresh();
    }

    function schedule() {
      pending.current = true;
      setPendente(true);
      if (timer.current) return;
      timer.current = setTimeout(flush, DEBOUNCE_MS);
    }

    for (const table of key.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
    }

    channel.subscribe((s) => {
      if (cancelado) return;
      if (s === "SUBSCRIBED") setTransport("ao-vivo");
      else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") setTransport("sem-conexao");
    });

    return () => {
      cancelado = true;
      // Zerar o ref, e não só chamar clearTimeout: `setTimeout` devolve inteiro
      // positivo, sempre truthy, e refs sobrevivem à re-execução do efeito. Um
      // `timer.current` obsoleto faria o `schedule()` seguinte retornar sem
      // agendar nada — o hook ficaria surdo para sempre.
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current = false;
      adiadoDesde.current = null;
      setPendente(false);
      supabase.removeChannel(channel);
    };
  }, [instanceId, key, router]);

  return useMemo(
    () => ({ transport, pendente, ultimaAtualizacao }),
    [transport, pendente, ultimaAtualizacao]
  );
}

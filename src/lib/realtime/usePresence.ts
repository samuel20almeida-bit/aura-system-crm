"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { navItems } from "@/components/layout/Sidebar";

/**
 * Tópico único e compartilhado — de propósito, sem `useId()`. Presença é como
 * os dois sócios se enxergam: precisa do MESMO tópico nos dois clientes, ao
 * contrário de `useLiveRefresh` (`src/lib/realtime/useLiveRefresh.ts`), que
 * usa `useId()` porque cada consumidor ali precisa do PRÓPRIO canal.
 *
 * A contrapartida dessa escolha é a regra que protege ela: só pode existir
 * UMA instância deste hook montada no app inteiro. `createBrowserClient` é
 * singleton e `RealtimeClient.channel(topic)` deduplica por tópico — pior,
 * ignora os `params` (aqui, `presence.key`) se o tópico já existir, o que
 * descartaria a config em silêncio. Por isso só `PresenceRow` chama este
 * hook, e só é montado a partir de `Topbar`, que é chrome de `AppShell` —
 * persiste entre navegações, nunca remonta numa tela.
 *
 * O canal é PRIVADO (`config.private`, abaixo). Sem isso ele era público: a
 * anon key e este tópico viajam no bundle do cliente, então qualquer pessoa
 * que abrisse /login e lesse o JS podia assinar o tópico e ver, ao vivo, o
 * primeiro nome, as iniciais, o UUID de autenticação e a tela de cada sócio —
 * e podia se anunciar com uma chave forjada, inclusive a do outro sócio.
 *
 * `private: true` sozinho não basta, e a metade que falta falha em SILÊNCIO:
 * `realtime.messages` tem RLS ligada, então canal privado sem policy é negado
 * na entrada e a faixa simplesmente nunca aparece. As policies vivem em
 * `supabase/migrations/0012_realtime_presenca_privada.sql` e são a outra
 * metade obrigatória desta linha.
 */
const PRESENCE_TOPIC = "aura:presenca";

type PresenceMeta = { name: string; initials: string; module: string | null };

export type Peer = {
  userId: string;
  name: string;
  initials: string;
  module: string | null;
};

/**
 * Traduz a rota para o nome que aparece no menu — `/kanban` → "Kanban",
 * `/pipeline?negocio=[id]` → "Pipeline". Reusa `navItems` de `Sidebar.tsx`, o
 * único mapa de rótulos de rota do app; um segundo mapa aqui divergiria dele
 * com o tempo.
 */
export function moduleFromPath(pathname: string): string | null {
  const item = navItems.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  return item?.label ?? null;
}

/**
 * Guarda de instância única. O tópico de presença é compartilhado por
 * construção, então não existe a proteção por `useId` que o useLiveRefresh tem.
 */
let instanciaMontada = false;

/**
 * Teto de recriações do canal e espera crescente entre elas. Ver o ramo CLOSED:
 * sem teto, um `phx_close` repetido do servidor viraria um laço de join/close no
 * ritmo do round-trip. Cinco tentativas, dobrando de 1s até 16s.
 */
const MAX_RECRIACOES = 5;
const RECRIACAO_BASE_MS = 1_000;

/**
 * Quem mais está online, e em que tela — recurso de canal do Supabase, não de
 * banco: não precisa de tabela, coluna nem migração.
 *
 * Exclui o próprio usuário da lista devolvida: ninguém precisa ser avisado de
 * que está online.
 */
export function usePresence({
  userId,
  name,
  initials,
}: {
  userId: string;
  name: string;
  initials: string;
}): Peer[] {
  const pathname = usePathname();
  const [peers, setPeers] = useState<Peer[]>([]);
  // Contador de geração: incrementado quando o canal morre de um jeito que não
  // se recupera sozinho (ver o ramo CLOSED abaixo), força o efeito a recriá-lo.
  const [geracao, setGeracao] = useState(0);

  // O canal é criado uma vez (efeito abaixo, sem `pathname` nas deps) e
  // reanunciado via `.track()` a cada navegação — não recriado a cada troca
  // de rota. `pathnameRef` existe porque o `.subscribe()` inicial resolve de
  // forma assíncrona: se o caminho mudar antes de "SUBSCRIBED" chegar, o
  // primeiro anúncio precisa da rota MAIS RECENTE, não da que existia quando
  // o efeito rodou. Escrever num ref fora de render (aqui, em efeito) é
  // seguro; durante o render seria erro de lint neste projeto.
  const pathnameRef = useRef(pathname);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const subscribedRef = useRef(false);

  // Re-anuncia quando o caminho (ou a identidade) muda, sem recriar o canal.
  useEffect(() => {
    pathnameRef.current = pathname;
    if (subscribedRef.current) {
      channelRef.current?.track({ name, initials, module: moduleFromPath(pathname) })?.catch(() => {});
    }
  }, [pathname, name, initials]);

  useEffect(() => {
    // O tópico é FIXO — tem que ser, é assim que os dois sócios se veem — então
    // a proteção do useLiveRefresh (um tópico por instância via useId) não vale
    // aqui. Duas instâncias montadas receberiam o MESMO canal pela dedução por
    // tópico do realtime-js, e o segundo `.on("presence", …)` lançaria
    // "cannot add presence callbacks after subscribe()". E o preço é pior que na
    // T1: a Topbar vive DENTRO do layout, acima de (app)/error.tsx, e não há
    // global-error.tsx — o erro sobe até a raiz e derruba o app inteiro, não uma
    // tela. A guarda sobrevive ao StrictMode porque ele faz setup→cleanup→setup,
    // nunca dois setups vivos ao mesmo tempo.
    if (instanciaMontada) {
      if (process.env.NODE_ENV !== "production") {
        console.error(
          "usePresence: segunda instância montada. O tópico é fixo e não suporta duas — monte <PresenceRow> uma vez só, no AppShell."
        );
      }
      return;
    }
    instanciaMontada = true;

    let cancelado = false;
    const temporizadores = new Set<ReturnType<typeof setTimeout>>();
    const supabase = createClient();
    const channel = supabase.channel(PRESENCE_TOPIC, {
      config: { private: true, presence: { key: userId } },
    });
    channelRef.current = channel;

    function sync() {
      const state = channel.presenceState<PresenceMeta>();
      const list: Peer[] = [];
      for (const [key, metas] of Object.entries(state)) {
        if (key === userId) continue; // ninguém precisa ser avisado de que está online
        const latest = metas[metas.length - 1];
        if (!latest) continue;
        list.push({ userId: key, name: latest.name, initials: latest.initials, module: latest.module });
      }
      setPeers(list);
    }

    channel.on("presence", { event: "sync" }, sync);

    channel.subscribe(async (status) => {
      if (cancelado) return;
      if (status === "SUBSCRIBED") {
        subscribedRef.current = true;
        await channel
          .track({ name, initials, module: moduleFromPath(pathnameRef.current) })
          .catch(() => {});
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        // Estes dois o phoenix recupera sozinho: o canal fica `errored`, o
        // rejoinTimer reagenda, e no `onOpen` do socket o reingresso acontece
        // porque a condição é `isErrored()`. A faixa esvazia e volta sozinha.
        subscribedRef.current = false;
        setPeers([]);
      } else if (status === "CLOSED") {
        // CLOSED é diferente: o `onClose` do phoenix RESETA o rejoinTimer, põe o
        // estado em `closed` e tira o canal da lista do socket. Como o reingresso
        // do `onOpen` exige `isErrored()`, nada ressuscita este canal — sem
        // recriar, a presença morreria calada até um recarregamento.
        //
        // Mas recriar SEM TETO é pior que não recriar. O CLOSED que chega aqui
        // fora da limpeza é um `phx_close` vindo do servidor — token recusado no
        // canal, limite de taxa, reinício do lado dele. Nesses casos o join
        // seguinte é fechado de novo, e um `setGeracao` incondicional viraria
        // laço de join/close no ritmo do round-trip, para sempre, sem nada na
        // tela dizendo. Daí o teto e a espera crescente: tenta, desiste, e
        // desistir é um estado honesto — a faixa some, como quando não há
        // ninguém online.
        subscribedRef.current = false;
        setPeers([]);
        if (geracao < MAX_RECRIACOES) {
          const espera = RECRIACAO_BASE_MS * 2 ** geracao;
          const t = setTimeout(() => {
            if (!cancelado) setGeracao((g) => g + 1);
          }, espera);
          temporizadores.add(t);
        }
      }
    });

    return () => {
      // `cancelado` barra o CLOSED legítimo disparado pelo próprio
      // removeChannel abaixo — sem ele, cada desmontagem incrementaria a
      // geração e o efeito se recriaria em laço.
      cancelado = true;
      for (const t of temporizadores) clearTimeout(t);
      temporizadores.clear();
      subscribedRef.current = false;
      channelRef.current = null;
      instanciaMontada = false;
      setPeers([]);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- name/initials/pathname tratados no efeito de re-anúncio acima; recriar o canal por eles quebraria a instância única
  }, [userId, geracao]);

  return peers;
}

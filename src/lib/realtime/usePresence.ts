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
 * `/crm/[id]` → "CRM". Reusa `navItems` de `Sidebar.tsx`, o único mapa de
 * rótulos de rota do app; um segundo mapa aqui divergiria dele com o tempo.
 */
export function moduleFromPath(pathname: string): string | null {
  const item = navItems.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  return item?.label ?? null;
}

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
      channelRef.current?.track({ name, initials, module: moduleFromPath(pathname) });
    }
  }, [pathname, name, initials]);

  useEffect(() => {
    let cancelado = false;
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
        await channel.track({ name, initials, module: moduleFromPath(pathnameRef.current) });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        // A presença falhou: a faixa some (lista vazia), mas o canal continua
        // de pé — a próxima reconexão a repovoa sozinha.
        subscribedRef.current = false;
        setPeers([]);
      }
    });

    return () => {
      cancelado = true;
      subscribedRef.current = false;
      channelRef.current = null;
      setPeers([]);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- name/initials/pathname tratados no efeito de re-anúncio acima; recriar o canal por eles quebraria a instância única
  }, [userId]);

  return peers;
}

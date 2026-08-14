"use client";

import { usePresence, type Peer } from "@/lib/realtime/usePresence";
import { Avatar } from "@/components/ui/Avatar";

/**
 * "no Kanban", "no CRM", "em Horas" — o gênero do artigo varia com o rótulo
 * do menu (`Sidebar.tsx`). Cobre os seis nomes que existem hoje; um rótulo
 * novo cai no padrão "em", que é sempre correto, só não o mais natural para
 * todos os casos.
 */
const PREPOSITION_BY_MODULE: Record<string, string> = {
  Início: "no",
  Kanban: "no",
  CRM: "no",
};

function withPreposition(module: string): string {
  return `${PREPOSITION_BY_MODULE[module] ?? "em"} ${module}`;
}

function peerLabel(peer: Peer): string {
  return peer.module ? `${peer.name} · ${withPreposition(peer.module)}` : peer.name;
}

/**
 * Quem mais está online, na barra superior. Monta sempre — é quem segura a
 * conexão de presença (via `usePresence`) — e desenha o vazio aqui dentro: se
 * ninguém além de você estiver online, ou se a presença falhar, a faixa não
 * renderiza nada. O canal continua de pé nos dois casos; a próxima
 * atualização repovoa a faixa sozinha.
 *
 * No celular só aparece o avatar com o ponto: o nome e o módulo vivem na
 * dica que só aparece com o mouse — a barra superior já é apertada.
 */
export function PresenceRow({
  userId,
  name,
  initials,
}: {
  userId: string;
  name: string;
  initials: string;
}) {
  const peers = usePresence({ userId, name, initials });

  if (peers.length === 0) return null;

  return (
    <div className="flex items-center -space-x-1.5">
      {peers.map((peer) => (
        <div key={peer.userId} className="group relative flex-none">
          <Avatar initials={peer.initials} size="sm" className="ring-2 ring-surface" />
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 h-2 w-2 flex-none rounded-full bg-accent ring-2 ring-surface animate-pulse-soft"
          />
          <div
            role="tooltip"
            className="pointer-events-none absolute right-0 top-full z-10 mt-1.5 hidden whitespace-nowrap rounded-md border border-border bg-ink px-2 py-1 font-mono text-[10.5px] text-bone md:group-hover:block"
          >
            {peerLabel(peer)}
          </div>
        </div>
      ))}
    </div>
  );
}

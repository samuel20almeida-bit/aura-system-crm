"use client";

import { useState } from "react";
import Link from "next/link";
import { ALL_CLEAR, TONE_BG, type AppNotification } from "@/lib/notifications";

function toneDot(tone: AppNotification["tone"]): string {
  return TONE_BG[tone];
}

/** Tom mais urgente da lista — o ponto do sino não pode ser âmbar se só há avisos neutros. */
function highestTone(notifications: AppNotification[]): AppNotification["tone"] {
  if (notifications.some((n) => n.tone === "red")) return "red";
  if (notifications.some((n) => n.tone === "amber")) return "amber";
  return "neutral";
}

export function NotificationBell({ notifications }: { notifications: AppNotification[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex">
      <button onClick={() => setOpen((v) => !v)} className="relative flex text-muted hover:text-ink" aria-label="Avisos">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M4.4 7a3.6 3.6 0 0 1 7.2 0v2.6l1 1.6H3.4l1-1.6z" />
          <path d="M6.6 12.6a1.5 1.5 0 0 0 2.8 0" />
        </svg>
        {notifications.length > 0 && (
          <span
            className={"absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full " + toneDot(highestTone(notifications))}
          />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* No celular o painel se ancora na janela, não no botão: quando algo
              empurra o sino para dentro da barra, um painel de 320px preso ao
              botão sai pela borda ESQUERDA — que não gera rolagem, então a parte
              de fora fica inalcançável. Um max-w sozinho não bastaria: a largura
              encolheria, mas a âncora continua longe demais da direita.
              O cronômetro da barra era quem empurrava e saiu na Fase 3A; a
              presença ao lado continua crescendo com quem está online. */}
          <div className="fixed inset-x-2 top-14 z-50 overflow-hidden rounded-xl border border-border bg-surface shadow-xl animate-fade-in md:absolute md:inset-x-auto md:right-0 md:top-7 md:w-80">
            <div className="border-b border-border px-3.5 py-2.5">
              <span className="label">PRECISA DE VOCÊ</span>
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              {notifications.length === 0 && (
                <div className="px-3.5 py-6 text-center text-[12.5px] text-faint">{ALL_CLEAR}</div>
              )}
              {notifications.map((n) => {
                const rowClass =
                  "flex items-start gap-2.5 border-b border-border-soft px-3.5 py-2.5 last:border-b-0";
                const body = (
                  <>
                    <span className={"mt-1 h-1.5 w-1.5 flex-none rounded-full " + toneDot(n.tone)} />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">{n.title}</div>
                      <div className="font-mono text-[11px] text-muted">{n.detail}</div>
                    </div>
                  </>
                );

                return n.href ? (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={rowClass + " hover:bg-neutral-tint"}
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={n.id} className={rowClass}>
                    {body}
                  </div>
                );
              })}
            </div>
            {/* O sino cobre faturas/contratos (CRM antigo) + tarefas — não
                negócio/Pipeline, que `getNotifications` nunca passou a
                incluir. `/hoje` é quem unifica negócio + tarefa; este link só
                aponta pra lá, não substitui os itens acima. */}
            <Link
              href="/hoje"
              onClick={() => setOpen(false)}
              className="block border-t border-border px-3.5 py-2.25 text-center font-mono text-[11px] text-muted hover:bg-neutral-tint hover:text-ink"
            >
              Ver tudo em /hoje
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

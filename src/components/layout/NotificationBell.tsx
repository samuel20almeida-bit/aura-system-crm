"use client";

import { useState } from "react";
import Link from "next/link";
import type { AppNotification } from "@/lib/notifications";

function toneDot(tone: AppNotification["tone"]): string {
  return tone === "red" ? "bg-red" : tone === "amber" ? "bg-amber" : "bg-faint";
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
          <div className="absolute right-0 top-7 z-50 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-xl animate-fade-in">
            <div className="border-b border-border px-3.5 py-2.5">
              <span className="label">PRECISA DE VOCÊ</span>
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              {notifications.length === 0 && (
                <div className="px-3.5 py-6 text-center text-[12.5px] text-faint">Tudo em dia por aqui.</div>
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
          </div>
        </>
      )}
    </div>
  );
}

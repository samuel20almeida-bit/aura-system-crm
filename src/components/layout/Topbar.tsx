"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/Avatar";
import { TimerWidget, type RunningTimer } from "@/components/layout/TimerWidget";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { MobileNavToggle } from "@/components/layout/Sidebar";
import { PresenceRow } from "@/components/layout/PresenceRow";
import type { AppNotification } from "@/lib/notifications";

const crumbs: { match: RegExp; label: string }[] = [
  { match: /^\/inicio/, label: "Início" },
  { match: /^\/kanban/, label: "Kanban" },
  { match: /^\/horas/, label: "Horas" },
  { match: /^\/metas/, label: "Metas" },
  { match: /^\/crm/, label: "CRM" },
  { match: /^\/playbooks/, label: "Playbooks" },
];

type SearchResult = { type: "tarefa" | "cliente"; id: string; title: string; sub: string; href: string };

export function Topbar({
  userId,
  fullName,
  initials,
  running,
  notifications,
  onMenuClick,
}: {
  userId: string;
  fullName: string;
  initials: string;
  running: RunningTimer | null;
  notifications: AppNotification[];
  onMenuClick: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const crumb = crumbs.find((c) => c.match.test(pathname))?.label ?? "";

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!query.trim()) return;
    const supabase = createClient();
    const timeout = setTimeout(async () => {
      const [tasksRes, clientsRes] = await Promise.all([
        supabase.from("tasks").select("id, title, code").ilike("title", `%${query}%`).limit(5),
        supabase.from("clients").select("id, name, segment").ilike("name", `%${query}%`).limit(5),
      ]);
      const taskResults: SearchResult[] = (tasksRes.data ?? []).map((t) => ({
        type: "tarefa",
        id: t.id,
        title: t.title,
        sub: t.code,
        href: `/kanban?task=${t.id}`,
      }));
      const clientResults: SearchResult[] = (clientsRes.data ?? []).map((c) => ({
        type: "cliente",
        id: c.id,
        title: c.name,
        sub: c.segment ?? "Cliente",
        href: `/crm/${c.id}`,
      }));
      setResults([...taskResults, ...clientResults]);
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  const displayResults = query.trim() ? results : [];

  return (
    <div className="flex h-[54px] flex-none items-center gap-3 border-b border-border bg-surface px-4 md:gap-3.5 md:px-5.5">
      <MobileNavToggle onClick={onMenuClick} />
      <div className="hidden text-xs text-faint md:block">
        Aura Studio {crumb && <>/ <b className="font-medium text-ink">{crumb}</b></>}
      </div>

      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="ml-auto hidden max-w-[320px] flex-1 items-center gap-2 rounded-lg border border-border bg-bone px-2.5 py-1.5 text-left text-[12.5px] text-faint md:flex"
      >
        Buscar tarefas, clientes…
        <span className="ml-auto rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[9.5px] text-faint">
          ⌘K
        </span>
      </button>

      <div className="ml-auto flex items-center gap-3 md:ml-0 md:contents">
        <NotificationBell notifications={notifications} />

        <TimerWidget running={running} />

        <PresenceRow userId={userId} name={fullName.split(" ")[0]} initials={initials} />

        <Avatar initials={initials} />
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-ink/20 pt-[12vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar tarefas, clientes…"
              className="w-full border-b border-border px-4 py-3.5 text-sm outline-none"
            />
            <div className="max-h-80 overflow-y-auto">
              {displayResults.length === 0 && query && (
                <div className="px-4 py-6 text-center text-[12.5px] text-faint">Nada encontrado</div>
              )}
              {displayResults.map((r) => (
                <button
                  key={r.type + r.id}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    router.push(r.href);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-neutral-tint"
                >
                  <span className="rounded bg-neutral-tint px-1.5 py-0.5 font-mono text-[10px] text-muted">
                    {r.type}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{r.title}</span>
                  <span className="font-mono text-[11px] text-faint">{r.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

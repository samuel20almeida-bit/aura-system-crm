"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/Avatar";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { MobileNavToggle } from "@/components/layout/Sidebar";
import { PresenceRow } from "@/components/layout/PresenceRow";
import { moduleFromPath } from "@/lib/realtime/usePresence";
import type { AppNotification } from "@/lib/notifications";

type SearchResult = {
  tipo: "tarefa" | "negócio";
  id: string;
  titulo: string;
  sub: string;
  href: string;
};

export function Topbar({
  userId,
  fullName,
  initials,
  notifications,
  onMenuClick,
}: {
  userId: string;
  fullName: string;
  initials: string;
  notifications: AppNotification[];
  onMenuClick: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // Mesma fonte de rótulos que a presença usa (que por sua vez reusa navItems do
  // Sidebar). O mapa de RegExp que vivia aqui era um segundo mapa rota→rótulo e
  // já divergia: /^\/hoje/ casava "/hojeemdia" como Hoje.
  const crumb = moduleFromPath(pathname) ?? "";

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [ativo, setAtivo] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function abrir() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

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
    // Sem limpar `results` aqui: apagar estado dentro do efeito dispara render
    // em cascata (o lint reprova). A lista exibida é DERIVADA da consulta —
    // `resultados`, abaixo —, que é o padrão que este arquivo já usava.
    if (!query.trim()) return;
    const supabase = createClient();
    let cancelado = false;

    const timeout = setTimeout(async () => {
      const termo = `%${query}%`;

      // Tarefa acha pelo próprio título. Negócio não tem título: a identidade
      // dele é o nome da conta, então a busca é pela conta e o resultado é o
      // negócio dela — que é o que tem tela para abrir (`/pipeline?negocio=`).
      // Conta sem negócio não aparece porque não há para onde levar.
      const [tarefasRes, contasRes] = await Promise.all([
        supabase.from("tasks").select("id, title, code").ilike("title", termo).limit(5),
        supabase.from("contas").select("id, nome").ilike("nome", termo).limit(5),
      ]);

      const tarefas: SearchResult[] = (tarefasRes.data ?? []).map((t) => ({
        tipo: "tarefa",
        id: t.id,
        titulo: t.title,
        sub: t.code,
        href: `/kanban?task=${t.id}`,
      }));

      // Duas consultas em vez de um filtro sobre tabela embutida: o filtro
      // embutido do PostgREST depende de `!inner` e de o nome do filtro casar
      // com o apelido do embed, e um erro ali devolve lista vazia em silêncio.
      // Duas consultas simples falham de forma visível se falharem.
      const contas = contasRes.data ?? [];
      let negocios: SearchResult[] = [];
      if (contas.length > 0) {
        const { data } = await supabase
          .from("negocios")
          .select("id, estagio, conta_id")
          .in("conta_id", contas.map((c) => c.id))
          .limit(5);
        const nomePorConta = new Map(contas.map((c) => [c.id, c.nome]));
        negocios = (data ?? []).map((n) => ({
          tipo: "negócio",
          id: n.id,
          titulo: nomePorConta.get(n.conta_id) ?? "—",
          sub: n.estagio,
          href: `/pipeline?negocio=${n.id}`,
        }));
      }

      if (!cancelado) {
        setResults([...tarefas, ...negocios]);
        setAtivo(0);
      }
    }, 200);

    return () => {
      cancelado = true;
      clearTimeout(timeout);
    };
  }, [query]);

  // Enquanto o campo está vazio, os resultados da última busca continuam em
  // `results` mas não são mostrados nem navegáveis.
  const resultados = query.trim() ? results : [];

  function irPara(r: SearchResult) {
    setOpen(false);
    setQuery("");
    router.push(r.href);
  }

  function navegar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (resultados.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((i) => (i + 1) % resultados.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => (i - 1 + resultados.length) % resultados.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      // `ativo` pode ter sobrado de uma lista maior enquanto a nova chega.
      const alvo = resultados[ativo] ?? resultados[0];
      irPara(alvo);
    }
  }

  return (
    <div className="flex h-[54px] flex-none items-center gap-3 border-b border-border bg-surface px-4 md:gap-3.5 md:px-5.5">
      <MobileNavToggle onClick={onMenuClick} />
      <div className="hidden text-xs text-faint md:block">
        Aura Studio {crumb && <>/ <b className="font-medium text-ink">{crumb}</b></>}
      </div>

      {/* No celular a busca era o único recurso do topo sem porta de entrada:
          não havia campo, e ⌘K não existe em teclado virtual. Vira ícone. */}
      <button
        onClick={abrir}
        aria-label="Buscar"
        className="ml-auto flex text-muted transition-colors hover:text-ink md:hidden"
      >
        <LupaIcon />
      </button>

      <button
        onClick={abrir}
        className="ml-auto hidden max-w-[320px] flex-1 items-center gap-2 rounded-control border border-border bg-bone px-2.5 py-1.5 text-left text-small text-faint transition-colors hover:border-faint md:flex"
      >
        <LupaIcon />
        Buscar tarefas e negócios…
        <span className="ml-auto rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[9.5px] text-faint">
          ⌘K
        </span>
      </button>

      {/* `md:contents` some com este invólucro no desktop, deixando sino,
          presença e avatar como filhos diretos da barra — é o que faz o
          espaçamento deles seguir o `gap` da barra em vez de um próprio.
          No celular ele volta a existir, agrupando os três à direita da lupa. */}
      <div className="flex items-center gap-3 md:contents">
        <NotificationBell notifications={notifications} />

        <PresenceRow userId={userId} name={fullName.split(" ")[0]} initials={initials} />

        <Avatar initials={initials} />
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-ink/20 px-4 pt-[12vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-card border border-border bg-surface shadow-overlay"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={navegar}
              placeholder="Buscar tarefas e negócios…"
              className="w-full border-b border-border px-4 py-3.5 text-sm outline-none"
            />
            <div className="max-h-80 overflow-y-auto">
              {resultados.length === 0 && query.trim() && (
                <div className="px-4 py-6 text-center text-small text-faint">Nada encontrado</div>
              )}
              {resultados.map((r, i) => (
                <button
                  key={r.tipo + r.id}
                  onClick={() => irPara(r)}
                  onMouseEnter={() => setAtivo(i)}
                  className={clsx(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                    i === ativo && "bg-neutral-tint"
                  )}
                >
                  <span className="rounded bg-neutral-tint px-1.5 py-0.5 font-mono text-[10px] text-muted">
                    {r.tipo}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{r.titulo}</span>
                  <span className="font-mono text-[11px] text-faint">{r.sub}</span>
                </button>
              ))}
            </div>
            {resultados.length > 0 && (
              <div className="flex items-center gap-3 border-t border-border px-4 py-2 font-mono text-[10px] text-faint">
                <span>↑↓ navegar</span>
                <span>↵ abrir</span>
                <span>esc fechar</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LupaIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      className="flex-none"
    >
      <circle cx="7.2" cy="7.2" r="4.4" />
      <path d="M10.4 10.4 13.4 13.4" />
    </svg>
  );
}

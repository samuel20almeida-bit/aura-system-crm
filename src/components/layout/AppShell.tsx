"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import type { AppNotification } from "@/lib/notifications";

/**
 * Onde a preferência de menu recolhido é guardada. O layout (Server Component)
 * lê este cookie para já mandar o HTML com a largura certa; o clique no botão
 * o reescreve aqui no cliente. Exportado para que os dois lados usem o mesmo
 * nome — dois literais divergem com o tempo.
 */
export const COOKIE_MENU = "aura_menu";

/**
 * Invólucro cliente fino: segura o estado `open` da gaveta de navegação e
 * conecta o botão da Topbar (MobileNavToggle) à Sidebar. O layout que o usa
 * é um Server Component assíncrono — só pode passar dados serializáveis
 * aqui, nunca uma função.
 */
export function AppShell({
  profile,
  counts,
  notifications,
  menuRecolhido,
  children,
}: {
  profile: { id: string; full_name: string; role_title: string | null; initials: string };
  counts: { openTasks: number | null };
  notifications: AppNotification[];
  menuRecolhido: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [recolhido, setRecolhido] = useState(menuRecolhido);

  function alternarRecolhido() {
    const novo = !recolhido;
    setRecolhido(novo);
    // 365 dias: é preferência de layout, não sessão. `SameSite=Lax` porque
    // nada aqui precisa atravessar site de terceiro.
    document.cookie = `${COOKIE_MENU}=${novo ? "1" : "0"}; path=/; max-age=31536000; SameSite=Lax`;
  }

  return (
    // h-dvh, não h-screen: no iOS 100vh inclui a barra de endereços, e o fim
    // do painel rolável ficava embaixo do chrome do navegador.
    <div className="flex h-dvh w-full bg-bone">
      <Sidebar
        profile={profile}
        counts={counts}
        open={open}
        onClose={() => setOpen(false)}
        recolhido={recolhido}
        onAlternarRecolhido={alternarRecolhido}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          userId={profile.id}
          fullName={profile.full_name}
          initials={profile.initials}
          notifications={notifications}
          onMenuClick={() => setOpen(true)}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin">{children}</div>
      </div>
    </div>
  );
}

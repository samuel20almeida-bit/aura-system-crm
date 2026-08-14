"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import type { AppNotification } from "@/lib/notifications";

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
  children,
}: {
  profile: { id: string; full_name: string; role_title: string | null; initials: string };
  counts: { openTasks: number | null; overdueInvoices: number | null };
  notifications: AppNotification[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    // h-dvh, não h-screen: no iOS 100vh inclui a barra de endereços, e o fim
    // do painel rolável ficava embaixo do chrome do navegador.
    <div className="flex h-dvh w-full bg-bone">
      <Sidebar profile={profile} counts={counts} open={open} onClose={() => setOpen(false)} />
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

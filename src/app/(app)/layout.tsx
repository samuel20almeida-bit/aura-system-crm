import { cookies } from "next/headers";
import { requireProfile } from "@/lib/data/profile";
import { getNavCounts } from "@/lib/data/nav";
import { getNotifications } from "@/lib/data/notifications";
import { AppShell, COOKIE_MENU } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  // As duas consultas são independentes entre si — em série custavam uma espera
  // a mais antes de qualquer página começar a renderizar.
  const [counts, notifications, cookieStore] = await Promise.all([
    getNavCounts(),
    getNotifications(profile.id),
    cookies(),
  ]);

  // A preferência do menu vem em cookie, e não em `localStorage`, para que o
  // servidor já mande o HTML com a largura certa. Lida no cliente, ela só
  // chegaria depois da primeira pintura, e quem prefere o menu recolhido veria
  // o menu largo por um quadro a cada carregamento — a mesma piscada que o
  // ponto de corte do quadro da Implantação resolveu mudando para CSS.
  const menuRecolhido = cookieStore.get(COOKIE_MENU)?.value === "1";

  return (
    <ToastProvider>
      <AppShell
        profile={profile}
        counts={counts}
        notifications={notifications}
        menuRecolhido={menuRecolhido}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}

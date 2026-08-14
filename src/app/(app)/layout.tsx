import { requireProfile } from "@/lib/data/profile";
import { getNavCounts } from "@/lib/data/nav";
import { getNotifications } from "@/lib/data/notifications";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  // As duas consultas são independentes entre si — em série custavam uma espera
  // a mais antes de qualquer página começar a renderizar.
  const [counts, notifications] = await Promise.all([getNavCounts(), getNotifications(profile.id)]);

  return (
    <ToastProvider>
      <AppShell profile={profile} counts={counts} notifications={notifications}>
        {children}
      </AppShell>
    </ToastProvider>
  );
}

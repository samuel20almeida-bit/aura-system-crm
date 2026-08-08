import { requireProfile } from "@/lib/data/profile";
import { getNavCounts } from "@/lib/data/nav";
import { getRunningTimer } from "@/lib/data/time";
import { getNotifications } from "@/lib/data/notifications";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { ToastProvider } from "@/components/ui/Toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  // As três consultas são independentes entre si — em série custavam quatro
  // esperas antes de qualquer página começar a renderizar.
  const [counts, timer, notifications] = await Promise.all([
    getNavCounts(),
    getRunningTimer(profile.id),
    getNotifications(profile.id),
  ]);
  const running = timer
    ? {
        id: timer.id,
        started_at: timer.started_at,
        taskTitle: timer.task?.title ?? null,
        clientName: timer.client?.name ?? null,
      }
    : null;

  return (
    <ToastProvider>
      <div className="flex h-screen w-full bg-bone">
        <Sidebar profile={profile} counts={counts} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar initials={profile.initials} running={running} notifications={notifications} />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin">{children}</div>
        </div>
      </div>
    </ToastProvider>
  );
}

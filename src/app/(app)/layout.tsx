import { requireProfile } from "@/lib/data/profile";
import { getNavCounts } from "@/lib/data/nav";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { ToastProvider } from "@/components/ui/Toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  const counts = await getNavCounts();

  return (
    <ToastProvider>
      <div className="flex h-screen w-full bg-bone">
        <Sidebar profile={profile} counts={counts} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar initials={profile.initials} />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin">{children}</div>
        </div>
      </div>
    </ToastProvider>
  );
}

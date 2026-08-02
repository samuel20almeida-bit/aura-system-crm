"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { AuraLogo } from "@/components/ui/AuraLogo";
import { Avatar } from "@/components/ui/Avatar";
import { signOut } from "@/lib/actions/auth";

type NavCountKey = "openTasks" | "overdueInvoices";
type NavItem = {
  href: string;
  label: string;
  icon: () => React.ReactElement;
  countKey?: NavCountKey;
};

const workItems: NavItem[] = [
  { href: "/inicio", label: "Início", icon: HomeIcon },
  { href: "/kanban", label: "Kanban", icon: KanbanIcon, countKey: "openTasks" },
  { href: "/horas", label: "Horas", icon: ClockIcon },
];

const businessItems: NavItem[] = [
  { href: "/metas", label: "Metas", icon: TargetIcon },
  { href: "/crm", label: "CRM", icon: CrmIcon, countKey: "overdueInvoices" },
  { href: "/playbooks", label: "Playbooks", icon: PlaybookIcon },
];

export function Sidebar({
  profile,
  counts,
}: {
  profile: { full_name: string; role_title: string | null; initials: string };
  counts: { openTasks: number; overdueInvoices: number };
}) {
  const pathname = usePathname();

  const renderItem = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    const count = item.countKey ? counts[item.countKey] : undefined;
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={clsx(
          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium",
          active ? "bg-accent-tint text-accent" : "text-muted hover:bg-neutral-tint"
        )}
      >
        <Icon />
        {item.label}
        {!!count && (
          <span
            className={clsx(
              "ml-auto font-mono text-[10px] font-semibold",
              item.countKey === "overdueInvoices" ? "text-red" : active ? "text-accent" : "text-faint"
            )}
          >
            {count}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-full w-[236px] flex-none flex-col border-r border-border bg-surface py-4.5">
      <div className="flex items-center justify-between px-4.5 pb-1.5">
        <div className="flex items-center gap-2">
          <AuraLogo />
          <span className="text-[17px] font-semibold">aura</span>
        </div>
      </div>
      <div className="mx-3 mt-2.5 mb-1 flex items-center gap-2 rounded-lg border border-border bg-bone px-2.5 py-1.5 text-xs font-medium text-muted">
        <span className="flex h-4 w-4 items-center justify-center rounded bg-accent-tint font-mono text-[9px] font-semibold text-accent">
          A
        </span>
        Aura Studio
      </div>

      <div className="mt-2 flex flex-col gap-0.5 px-3">
        <span className="px-2.5 pb-1.5 pt-4 font-mono text-[9.5px] font-semibold tracking-[0.09em] text-faint">
          TRABALHO
        </span>
        {workItems.map(renderItem)}
      </div>
      <div className="flex flex-col gap-0.5 px-3">
        <span className="px-2.5 pb-1.5 pt-4 font-mono text-[9.5px] font-semibold tracking-[0.09em] text-faint">
          NEGÓCIO
        </span>
        {businessItems.map(renderItem)}
      </div>

      <form action={signOut} className="mx-3 mt-auto flex items-center gap-2.5 border-t border-border pt-3.5">
        <Avatar initials={profile.initials} />
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-medium">{profile.full_name}</div>
          <div className="truncate font-mono text-[11px] text-muted">
            {profile.role_title || "Fundador(a)"}
          </div>
        </div>
        <button
          type="submit"
          title="Sair"
          className="ml-auto flex text-muted hover:text-ink"
        >
          <LogoutIcon />
        </button>
      </form>
    </div>
  );
}

function iconProps() {
  return { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.3 } as const;
}

function HomeIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M2.6 7 8 2.6 13.4 7v6.4H2.6z" />
    </svg>
  );
}
function KanbanIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M2.6 3h3.2v10.2H2.6zM6.9 3h3.2v6.6H6.9zM11.2 3h2.2v10.2h-2.2z" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="8" cy="8" r="5.6" />
      <path d="M8 4.8V8l2.2 1.4" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="8" cy="8" r="5.4" />
      <circle cx="8" cy="8" r="1.8" />
    </svg>
  );
}
function CrmIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="6.2" cy="6" r="2.3" />
      <path d="M2.4 13.2c0-2 1.7-3.3 3.8-3.3s3.8 1.3 3.8 3.3" />
      <path d="M11 4.6a2.2 2.2 0 0 1 0 4" />
    </svg>
  );
}
function PlaybookIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 2.8h5.2A1.8 1.8 0 0 1 10 4.6v8.6H4.8A1.8 1.8 0 0 1 3 11.4z" />
      <path d="M10 4.6a1.8 1.8 0 0 1 1.8-1.8H13v10.4h-1.2" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M6.5 2.8H3.6a.8.8 0 0 0-.8.8v8.8a.8.8 0 0 0 .8.8h2.9" />
      <path d="M10.6 11.2 13.8 8l-3.2-3.2M13.8 8H6.2" />
    </svg>
  );
}

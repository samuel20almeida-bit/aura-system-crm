"use client";

import { useState } from "react";
import Link from "next/link";
import { StartTimerModal, LogTimeModal } from "./TimeModals";
import { Button, ButtonLink } from "@/components/ui/Button";

type ClientLite = { id: string; name: string };
type TaskLite = { id: string; title: string; client_id: string | null };

export function HorasActions({
  clients,
  tasks,
  prevMonthHref,
  nextMonthHref,
  monthLabel,
  csvHref,
}: {
  clients: ClientLite[];
  tasks: TaskLite[];
  prevMonthHref: string;
  nextMonthHref: string;
  monthLabel: string;
  csvHref: string;
}) {
  const [modal, setModal] = useState<"timer" | "log" | null>(null);

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-border bg-surface px-1 py-1 text-xs text-muted">
          <Link href={prevMonthHref} className="rounded-full px-1.5 py-0.5 hover:bg-neutral-tint">◀</Link>
          <span className="px-1 font-medium text-ink">{monthLabel}</span>
          <Link href={nextMonthHref} className="rounded-full px-1.5 py-0.5 hover:bg-neutral-tint">▶</Link>
        </div>
        <ButtonLink href={csvHref} variant="ghost">Exportar CSV</ButtonLink>
        <Button variant="ghost" onClick={() => setModal("log")}>Registrar horas</Button>
        <Button onClick={() => setModal("timer")}>▶ Iniciar timer</Button>
      </div>
      {modal === "timer" && <StartTimerModal clients={clients} tasks={tasks} onClose={() => setModal(null)} />}
      {modal === "log" && <LogTimeModal clients={clients} tasks={tasks} onClose={() => setModal(null)} />}
    </>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDuration } from "@/lib/format";
import { stopRunningTimer } from "@/lib/actions/time";
import { useToast } from "@/components/ui/Toast";

const EIGHT_HOURS_SECONDS = 8 * 3600;

export type RunningTimer = {
  id: string;
  started_at: string;
  taskTitle: string | null;
  clientName: string | null;
};

export function TimerWidget({ running }: { running: RunningTimer | null }) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(running.started_at).getTime()) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [running]);

  if (!running) return null;

  const forgotten = elapsed > EIGHT_HOURS_SECONDS;
  const label = running.taskTitle ?? running.clientName ?? "Interno";

  return (
    <div
      className={
        "flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 " +
        (forgotten ? "border-red-tint-border bg-red-tint" : "border-accent-tint-border bg-accent-tint")
      }
      title={forgotten ? "Timer rodando há mais de 8 horas — provavelmente esquecido" : label}
    >
      <span className={"h-1.5 w-1.5 flex-none rounded-full motion-safe:animate-pulse-soft " + (forgotten ? "bg-red" : "bg-accent")} />
      <span className={"max-w-[140px] truncate text-[12px] " + (forgotten ? "text-red" : "text-accent")}>{label}</span>
      <span className={"font-mono text-[12px] font-semibold " + (forgotten ? "text-red" : "text-accent")}>
        {formatDuration(elapsed)}
      </span>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await stopRunningTimer();
              notify("success", "Timer parado e horas registradas.");
              router.refresh();
            } catch {
              notify("error", "Não foi possível parar o timer.");
            }
          })
        }
        className={"font-mono text-[11px] underline underline-offset-2 " + (forgotten ? "text-red" : "text-accent")}
      >
        parar
      </button>
    </div>
  );
}

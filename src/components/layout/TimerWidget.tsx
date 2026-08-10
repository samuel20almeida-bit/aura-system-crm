"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDuration } from "@/lib/format";
import { stopRunningTimer } from "@/lib/actions/time";
import { beginMutation } from "@/lib/realtime/mutation-gate";
import { useToast } from "@/components/ui/Toast";
import { FORGOTTEN_TIMER_MS } from "@/lib/notifications";

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
  /** Milissegundos desde o início — mesma unidade do limiar compartilhado. */
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!running) return;
    const tick = () => setElapsedMs(Date.now() - new Date(running.started_at).getTime());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [running]);

  if (!running) return null;

  const forgotten = elapsedMs > FORGOTTEN_TIMER_MS;
  const label = running.taskTitle ?? running.clientName ?? "Interno";

  return (
    <div
      className={
        "flex items-center gap-1.5 rounded-lg border px-1.5 py-1 md:gap-2.5 md:px-2.5 md:py-1.5 " +
        (forgotten ? "border-red-tint-border bg-red-tint" : "border-accent-tint-border bg-accent-tint")
      }
      title={forgotten ? "Timer rodando há mais de 8 horas — provavelmente esquecido" : label}
    >
      <span className={"h-1.5 w-1.5 flex-none rounded-full animate-pulse-soft " + (forgotten ? "bg-red" : "bg-accent")} />
      <span className={"max-w-[70px] truncate text-[12px] md:max-w-[140px] " + (forgotten ? "text-red" : "text-accent")}>{label}</span>
      <span className={"font-mono text-[12px] font-semibold " + (forgotten ? "text-red" : "text-accent")}>
        {formatDuration(Math.floor(elapsedMs / 1000))}
      </span>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const end = beginMutation();
            try {
              await stopRunningTimer();
              notify("success", "Timer parado e horas registradas.");
              router.refresh();
            } catch {
              notify("error", "Não foi possível parar o timer.");
            } finally {
              end();
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

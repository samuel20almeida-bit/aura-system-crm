"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { formatDuration } from "@/lib/format";
import { stopRunningTimer } from "@/lib/actions/time";

export function TimerBanner({
  startedAt,
  label,
}: {
  startedAt: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-accent-tint-border bg-accent-tint p-3.5">
      <span className="h-2 w-2 flex-none animate-pulse rounded-full bg-accent" />
      <div className="flex-1">
        <div className="label text-accent">RODANDO AGORA</div>
        <div className="text-[13.5px] font-medium text-accent">{label}</div>
      </div>
      <span className="font-mono text-xl font-semibold text-accent">{formatDuration(elapsed)}</span>
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await stopRunningTimer();
            router.refresh();
          })
        }
      >
        Parar e salvar
      </Button>
    </div>
  );
}

"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import clsx from "clsx";
import { addToast, removeToast, type Toast, type ToastTone } from "@/lib/toast-store";

const DISMISS_MS = 5000;

type ToastContextValue = {
  notify: (tone: ToastTone, message: string, undo?: () => void) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((tone: ToastTone, message: string, undo?: () => void) => {
    setToasts((list) => addToast(list, { tone, message, undo }, crypto.randomUUID()));
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((list) => removeToast(list, id));
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// `onDismiss` recebe o id em vez de já vir amarrado a ele: uma função inline
// (`() => dismiss(t.id)`) teria identidade nova a cada render do provider, e o
// efeito abaixo reiniciaria o cronômetro de todos os avisos na tela sempre que
// um novo aviso entrasse. Com `dismiss` memoizado, cada aviso some no seu tempo.
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const id = toast.id;
  useEffect(() => {
    const timeout = setTimeout(() => onDismiss(id), DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [onDismiss, id]);

  return (
    <div
      role="status"
      className={clsx(
        "pointer-events-auto flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-[13px] shadow-lg animate-toast-in",
        toast.tone === "success" && "border-accent-tint-border bg-accent-tint text-accent",
        toast.tone === "error" && "border-red-tint-border bg-red-tint text-red",
        toast.tone === "info" && "border-border bg-surface text-ink"
      )}
    >
      <span>{toast.message}</span>
      {toast.undo && (
        <button
          onClick={() => {
            toast.undo?.();
            onDismiss(id);
          }}
          className="font-mono text-[11px] underline underline-offset-2 hover:opacity-70"
        >
          Desfazer
        </button>
      )}
      <button onClick={() => onDismiss(id)} className="ml-1 text-[13px] opacity-50 hover:opacity-100" aria-label="Fechar aviso">
        ✕
      </button>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <span className="text-2xl">⚠️</span>
      <h1 className="text-lg font-medium">Algo deu errado</h1>
      <p className="max-w-sm text-[13px] text-muted">
        Não foi possível completar essa ação. Tente novamente — se o problema
        continuar, atualize a página.
      </p>
      <Button onClick={() => reset()} className="mt-1">
        Tentar novamente
      </Button>
    </div>
  );
}

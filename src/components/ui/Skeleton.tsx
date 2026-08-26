import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("rounded bg-border-soft animate-pulse-soft", className)} />;
}

// As grades abaixo copiam as das páginas que estes esqueletos precedem — é o
// ponto de um esqueleto: ocupar o mesmo espaço que o conteúdo real vai ocupar.
// Fixas em 4 e 3 colunas, elas escapavam pela direita a 390px e a primeira
// pintura de toda navegação no celular saltava para o empilhado logo depois.
// As classes são literais porque o Tailwind lê o código-fonte: uma string
// montada como `md:grid-cols-${count}` não geraria CSS nenhum.
const KPI_ROW_COLS: Record<number, string> = {
  3: "grid grid-cols-2 gap-3 md:grid-cols-3",
  4: "grid grid-cols-2 gap-3 md:grid-cols-4",
};

export function SkeletonKpiRow({ count = 4 }: { count?: number }) {
  return (
    // O esqueleto tem que ter a mesma contagem e a mesma grade da tela que ele
    // cobre; divergir troca o desenho por um salto no momento em que os dados chegam.
    <div className={KPI_ROW_COLS[count] ?? KPI_ROW_COLS[4]}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-1.5 w-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex-1 rounded-card border border-border bg-surface p-4">
      <div className="flex gap-3 border-b border-border pb-2">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-2 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 border-b border-border-soft py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid flex-1 grid-cols-1 gap-3.5 md:grid-cols-3">
      {Array.from({ length: count }).map((_, col) => (
        // No celular o Kanban mostra uma coluna por vez (KanbanBoard.tsx):
        // empilhar as três aqui reservaria espaço que a página não usa.
        <div
          key={col}
          className={clsx(
            "flex-col gap-2.25 rounded-card border border-neutral-tint-border bg-neutral-tint p-2.75 md:flex",
            col === 0 ? "flex" : "hidden"
          )}
        >
          <Skeleton className="h-2.5 w-20" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-[10px] border border-border bg-surface p-2.75">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

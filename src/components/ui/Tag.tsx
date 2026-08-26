import clsx from "clsx";

export function Tag({
  tone = "neutral",
  dot = false,
  children,
}: {
  tone?: "accent" | "red" | "amber" | "neutral";
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-label font-sans",
        tone === "accent" && "bg-accent-tint text-accent",
        tone === "red" && "bg-red-tint text-red",
        // O âmbar estava escrito à mão, `#9A6B1E` sobre `#FBF2E1`. É
        // exatamente o par que a etapa B mediu em 4,20:1 e substituiu por
        // `--color-warning` sobre `--color-warning-tint` (5,91:1) — só que a
        // correção não chegou aqui, porque esta cópia não usava o token. É a
        // tag do prazo estourado e da conta indisponível: o aviso mais urgente
        // era o texto menos legível, o mesmo padrão que o vermelho tinha.
        tone === "amber" && "bg-warning-tint text-warning",
        tone === "neutral" && "bg-neutral-tint text-muted"
      )}
    >
      {dot && (
        <span className="h-1.5 w-1.5 flex-none rounded-full bg-current" />
      )}
      {children}
    </span>
  );
}

export function Chip({
  active = false,
  dashed = false,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  dashed?: boolean;
}) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-sans transition-colors",
        dashed && "border-dashed",
        active
          ? "bg-ink text-bone border-ink"
          : "bg-surface text-muted border-border hover:border-faint",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

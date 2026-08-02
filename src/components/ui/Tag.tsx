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
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-sans",
        tone === "accent" && "bg-accent-tint text-accent",
        tone === "red" && "bg-red-tint text-red",
        tone === "amber" && "bg-[#FBF2E1] text-[#9A6B1E]",
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

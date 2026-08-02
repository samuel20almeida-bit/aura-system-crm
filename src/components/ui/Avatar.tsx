import clsx from "clsx";

export function Avatar({
  initials,
  size = "md",
  ghost = false,
  className,
}: {
  initials: string | null | undefined;
  size?: "sm" | "md";
  ghost?: boolean;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex flex-none items-center justify-center rounded-full border font-mono font-semibold",
        size === "sm" ? "h-[22px] w-[22px] text-[9px]" : "h-7 w-7 text-[10px]",
        ghost
          ? "bg-neutral-tint text-muted border-border"
          : "bg-accent-tint text-accent border-accent-tint-border",
        className
      )}
    >
      {initials || "—"}
    </span>
  );
}

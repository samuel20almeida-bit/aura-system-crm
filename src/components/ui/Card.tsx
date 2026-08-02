import clsx from "clsx";

export function Card({
  className,
  danger,
  accent,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { danger?: boolean; accent?: boolean }) {
  return (
    <div
      className={clsx(
        "rounded-xl border bg-surface",
        danger ? "border-red-tint-border" : accent ? "border-accent-tint-border bg-accent-tint" : "border-border",
        className
      )}
      {...props}
    />
  );
}

export function Kpi({
  label,
  value,
  valueClassName,
  sub,
  labelClassName,
  children,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  sub?: React.ReactNode;
  labelClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-1.5 p-4">
      <span className={clsx("label", labelClassName)}>{label}</span>
      <span className={clsx("text-xl font-semibold", valueClassName)}>{value}</span>
      {children}
      {sub && <span className="font-mono text-[11px] text-muted">{sub}</span>}
    </Card>
  );
}

export function ProgressBar({
  percent,
  danger = false,
  className,
}: {
  percent: number;
  danger?: boolean;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={clsx("h-1.5 overflow-hidden rounded bg-[#EDEAE2]", className)}>
      <div
        className={clsx("h-full rounded", danger ? "bg-red" : "bg-accent")}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

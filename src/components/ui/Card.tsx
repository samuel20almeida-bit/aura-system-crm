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

/**
 * Três texturas, uma por degrau: rótulo em mono maiúsculo, valor grande em
 * `tabular-nums` (para que os seis do Painel se alinhem como um conjunto, e
 * não como seis larguras diferentes), e a linha de apoio em prosa.
 *
 * A linha de apoio deixou de ser `font-mono`: ela é frase — "8 clientes
 * ativos", "setup vs. 1 mês de mensalidade" —, e mono a 11px em frase é
 * exatamente o que faz uma tela parecer terminal em vez de produto. O que
 * precisa de alinhamento é o número, e o número está no valor.
 *
 * `children` fica entre o valor e a linha de apoio, que é onde caberia uma
 * variação ("↑ 12%"). O Painel não a usa: das seis métricas, nenhuma tem
 * valor anterior com que se comparar — não existe histórico de assinatura
 * (a Fase 3C foi pulada), então qualquer delta ali seria inventado.
 */
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
    <Card className="flex flex-col gap-1 p-4">
      <span className={clsx("label", labelClassName)}>{label}</span>
      <span className={clsx("text-display font-semibold tabular-nums", valueClassName)}>{value}</span>
      {children}
      {sub && <span className="mt-0.5 text-small text-muted">{sub}</span>}
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
        className={clsx("h-full rounded transition-[width] duration-200 ease-out", danger ? "bg-red" : "bg-accent")}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

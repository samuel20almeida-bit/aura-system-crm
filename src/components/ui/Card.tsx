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
        "rounded-card border bg-surface",
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
 * `destaque` pinta o cartão de verde cheio. É para UM cartão por linha: seis
 * cartões brancos iguais não têm ponto de entrada, e o olho começa pelo canto
 * superior esquerdo por falta de alternativa em vez de por decisão. Cheio, ele
 * ancora a linha e diz qual é o número que importa. Dois destaques na mesma
 * linha anulam um ao outro — é o mesmo motivo de haver um só botão primário
 * por formulário.
 *
 * O texto sobre o verde cheio é `bone/85`, e não `/75`: medido, `/75` dá
 * 4,07:1 sobre o acento — abaixo do mínimo de 4,5:1, e tanto o rótulo quanto a
 * linha de apoio são texto. `/85` dá 4,76:1. O ícone fica em `/60` (3,19:1)
 * porque o mínimo de elemento gráfico é 3:1 e ele repete o rótulo ao lado.
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
  icone,
  destaque = false,
  children,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  sub?: React.ReactNode;
  labelClassName?: string;
  /** Desenho de 16px no canto, para o cartão ser reconhecível antes de ser lido. */
  icone?: React.ReactNode;
  /** Verde cheio. Um por linha. */
  destaque?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card
      className={clsx(
        "flex flex-col gap-1 p-5",
        destaque && "border-accent bg-accent text-bone shadow-layer"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={clsx("label", destaque && "text-bone/85", labelClassName)}>{label}</span>
        {icone && (
          // `aria-hidden` no contêiner: o ícone repete o rótulo que está ao
          // lado dele, e anunciado viraria o rótulo dito duas vezes.
          <span aria-hidden className={clsx("flex-none", destaque ? "text-bone/60" : "text-faint")}>
            {icone}
          </span>
        )}
      </div>
      <span className={clsx("text-display font-semibold tabular-nums", valueClassName)}>{value}</span>
      {children}
      {sub && <span className={clsx("mt-0.5 text-small", destaque ? "text-bone/85" : "text-muted")}>{sub}</span>}
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
    // O trilho era `bg-[#EDEAE2]` escrito à mão — o valor exato de
    // `--color-border-soft`, nomeado na etapa B. Mesma história do raio, da
    // sombra e do âmbar: token definido, cópia crua ao lado.
    <div className={clsx("h-1.5 overflow-hidden rounded bg-border-soft", className)}>
      <div
        className={clsx("h-full rounded transition-[width] duration-200 ease-out", danger ? "bg-red" : "bg-accent")}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

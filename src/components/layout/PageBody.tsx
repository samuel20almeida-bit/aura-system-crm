export function PageBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-5.5">{children}</div>
  );
}

export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 className="text-display font-medium">{title}</h1>
        {sub && <div className="mt-0.5 text-small text-muted">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Uma faixa nomeada dentro da página. `PageHeader` nomeia a tela; este nomeia
 * um bloco dentro dela, e é a mesma gramática — por isso mora aqui, junto do
 * resto do ritmo da página.
 *
 * O `aside` existe por um motivo concreto: o Painel tem dois blocos chamados
 * "Origem → receita", um acumulado e um do período escolhido. Sem dizer o
 * recorte ao lado do nome, os dois parecem o mesmo número em desacordo.
 */
export function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-title font-medium">{title}</h2>
        {aside && <span className="text-small text-faint">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

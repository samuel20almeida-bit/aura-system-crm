import clsx from "clsx";

/**
 * Duas densidades, deliberadas.
 *
 * `denso` é o padrão e é o que a maioria das telas quer: Kanban, Pipeline,
 * Hoje e Implantação são telas de TRABALHO, onde ar demais vira rolagem e
 * rolagem custa. `leitura` é para as telas que só se olham — Painel, Operação
 * —, onde a densidade não serve a ninguém e o que se quer é que o número
 * tenha espaço em volta.
 *
 * Isto existe como prop, e não como um valor único no meio do caminho, porque
 * um compromisso entre os dois não serviria a nenhum dos dois: seria uma tela
 * de trabalho esparsa e uma tela de leitura apertada.
 */
export function PageBody({
  children,
  ritmo = "denso",
}: {
  children: React.ReactNode;
  ritmo?: "denso" | "leitura";
}) {
  return (
    <div
      className={clsx(
        "flex min-h-0 flex-1 flex-col",
        ritmo === "leitura" ? "gap-8 p-5 md:p-8" : "gap-4 p-4 md:p-5.5"
      )}
    >
      {children}
    </div>
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
        {/* `mt-1`, não `mt-0.5`: o título subiu de 21 para 26px e a linha de
            apoio encostava nele. */}
        {sub && <div className="mt-1 text-small text-muted">{sub}</div>}
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
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-title font-medium">{title}</h2>
        {aside && <span className="text-small text-faint">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

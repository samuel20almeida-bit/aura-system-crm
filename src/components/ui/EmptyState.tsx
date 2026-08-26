import clsx from "clsx";

/**
 * "Não há nada aqui" — e, quando dá, o que fazer a respeito.
 *
 * Substitui as versões escritas à mão em Pipeline, Implantação, Hoje,
 * Credenciais e Kanban, que diferiam entre si em coisas sem intenção:
 * `p-8` num, `p-10` noutro, `text-[13px] font-medium` num título que
 * noutro era `text-[13px] text-faint`.
 *
 * A regra que a consolidação preserva: quando a tela está vazia porque um
 * filtro não achou nada, o texto tem de dizer isso — e não "cadastre o
 * primeiro". Credenciais já fazia essa distinção (correção de outra fase),
 * e quem chamar continua responsável por escolher a frase certa.
 */
export function EmptyState({
  title,
  sub,
  action,
  plain = false,
  className,
}: {
  title: string;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  /** Sem a borda tracejada, para quando já existe um contêiner em volta. */
  plain?: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "text-center",
        plain ? "p-8" : "rounded-card border border-dashed border-border p-8",
        className
      )}
    >
      <div className={clsx("text-body font-medium", plain && "text-faint")}>{title}</div>
      {sub && <div className="mt-1 text-small text-muted">{sub}</div>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * A coluna de quadro sem nenhum cartão. NÃO é um estado vazio: o texto é
 * uma instrução de arraste, e o alvo precisa existir mesmo vazio para que
 * haja onde soltar.
 *
 * Estava escrito três vezes, byte a byte igual, em KanbanBoard,
 * PipelineBoard e ImplantacaoBoard.
 *
 * A borda usa um cinza mais escuro que `--color-border` de propósito: a
 * coluna do quadro tem fundo levemente afundado, e a borda padrão sumiria
 * nele. É o único lugar do app que precisa deste tom, então ele vive aqui
 * em vez de virar token.
 */
export function DropZone({ children = "Solte aqui" }: { children?: React.ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-[#CFCABD] p-3.5 text-center text-xs text-faint">
      {children}
    </div>
  );
}

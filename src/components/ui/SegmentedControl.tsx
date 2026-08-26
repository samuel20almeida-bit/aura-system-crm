import clsx from "clsx";
import Link from "next/link";

export type OpcaoSegmentada<T extends string> = {
  valor: T;
  rotulo: React.ReactNode;
  /** Presente = a opção navega (a seleção mora na URL). Ausente = a opção troca estado local. */
  href?: string;
};

/**
 * Escolher UMA de N alternativas que recortam a mesma tela.
 *
 * Estava escrito à mão em seis lugares — filtro de dono em `/hoje`, trimestre
 * em `/metas`, board/lista, clientes/interno e a coluna do celular no Kanban, e
 * o escopo no modal de nova tarefa —, e os seis divergiam em coisas sem
 * intenção: `rounded-lg` em quatro, `rounded-full` num, `text-[12px]` em três,
 * `text-xs` noutro, `px-3.25 py-1.75` contra `px-3 py-1.5`. Nenhum tinha estado
 * de hover, e nenhum se anunciava para leitor de tela.
 *
 * NÃO é o mesmo que um grupo de botões. A diferença que a marcação precisa
 * carregar: aqui as opções são MUTUAMENTE EXCLUSIVAS e uma está sempre valendo.
 * Por isso o contêiner é `role="group"` com nome, e cada opção diz o seu estado
 * — `aria-current="page"` quando a seleção mora na URL, `aria-pressed` quando
 * mora no estado local. Sem isso, um leitor de tela anuncia N botões idênticos
 * e nenhuma forma de saber qual está ativo.
 *
 * A cor do selecionado é `bg-ink`, e não o acento. É deliberado: a pílula verde
 * do menu lateral responde "em que página estou", e este controle responde "que
 * fatia desta página estou vendo". Duas perguntas diferentes, duas marcas.
 */
export function SegmentedControl<T extends string>({
  opcoes,
  valor,
  onChange,
  rotuloAcessivel,
  formato = "control",
  preencher = false,
  className,
}: {
  opcoes: OpcaoSegmentada<T>[];
  valor: T;
  /** Obrigatório para as opções sem `href`. Ignorado pelas que têm. */
  onChange?: (valor: T) => void;
  /** Nome do grupo para leitor de tela — "Filtrar por dono", "Trimestre". */
  rotuloAcessivel: string;
  /** `pilula` arredonda as pontas por completo; `control` usa o raio de controle. */
  formato?: "control" | "pilula";
  /** Cada opção ocupa fração igual da largura. Para o seletor de coluna no celular. */
  preencher?: boolean;
  className?: string;
}) {
  const caixa = clsx(
    "flex overflow-hidden border border-border bg-surface text-small font-medium",
    formato === "pilula" ? "rounded-full" : "rounded-control",
    className
  );

  return (
    <div role="group" aria-label={rotuloAcessivel} className={caixa}>
      {opcoes.map((opcao) => {
        const ativo = opcao.valor === valor;
        const classe = clsx(
          "px-3 py-1.5 text-center transition-colors duration-fast",
          // A pílula não leva divisória: com as pontas redondas, a última
          // divisória fica visivelmente fora do lugar.
          formato === "control" && "border-r border-border last:border-r-0",
          preencher && "flex-1",
          ativo ? "bg-ink text-bone" : "text-muted hover:bg-neutral-tint hover:text-ink"
        );

        return opcao.href !== undefined ? (
          <Link key={opcao.valor} href={opcao.href} aria-current={ativo ? "page" : undefined} className={classe}>
            {opcao.rotulo}
          </Link>
        ) : (
          <button
            key={opcao.valor}
            type="button"
            aria-pressed={ativo}
            onClick={() => onChange?.(opcao.valor)}
            className={classe}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import clsx from "clsx";
import { AuraLogo } from "@/components/ui/AuraLogo";
import { Avatar } from "@/components/ui/Avatar";
import { signOut } from "@/lib/actions/auth";

type NavCountKey = "openTasks";
type NavItem = {
  href: string;
  label: string;
  icon: () => React.ReactElement;
  countKey?: NavCountKey;
};

// Ordem fixada na Task 6 da Fase 3A, estendida na Task 6 da 3B e na Task 3
// da 3D: Hoje · Pipeline · Implantação · Kanban · Painel · Metas ·
// Playbooks — Implantação entra entre Pipeline e Kanban, seguindo a ordem
// do funil completo (venda → build) que o spec da Fase 3 descreve. Painel
// abre o grupo NEGÓCIO como visão geral de métricas, antes de Metas e
// Playbooks. O CRM antigo saiu do menu (a rota inteira foi removida, não
// só o item) — as tabelas que ele lia continuam no banco, sem tela até a
// 3C.
const workItems: NavItem[] = [
  { href: "/hoje", label: "Hoje", icon: HomeIcon },
  { href: "/pipeline", label: "Pipeline", icon: PipelineIcon },
  { href: "/implantacao", label: "Implantação", icon: ImplantacaoIcon },
  { href: "/kanban", label: "Kanban", icon: KanbanIcon, countKey: "openTasks" },
  // Reunião é coordenação do dia a dia, não métrica — por isso entra no grupo
  // TRABALHO e não em NEGÓCIO, depois do Kanban: o que se combina numa
  // reunião vira tarefa lá, então a ordem segue o caminho do combinado.
  { href: "/reunioes", label: "Reuniões", icon: ReuniaoIcon },
];

const businessItems: NavItem[] = [
  { href: "/painel", label: "Painel", icon: PainelIcon },
  { href: "/metas", label: "Metas", icon: TargetIcon },
  { href: "/playbooks", label: "Playbooks", icon: PlaybookIcon },
  { href: "/credenciais", label: "Credenciais", icon: CredentialsIcon },
];

/**
 * Os rótulos que aparecem no menu, para quem precisar traduzir uma rota num
 * nome de tela sem duplicar a lista — hoje, a presença ao vivo (Topbar) usa
 * isto para dizer em que módulo cada pessoa está. Único mapa de rótulos de
 * rota do app; dois divergem com o tempo.
 */
export const navItems: { href: string; label: string }[] = [...workItems, ...businessItems].map(
  ({ href, label }) => ({ href, label })
);

export function Sidebar({
  profile,
  counts,
  open,
  onClose,
  recolhido,
  onAlternarRecolhido,
}: {
  profile: { full_name: string; role_title: string | null; initials: string };
  /** `null` num contador significa "não deu para ler" — nunca zero. */
  counts: { openTasks: number | null };
  open: boolean;
  onClose: () => void;
  /**
   * Recolhido vale só a partir de `md:`. No celular o menu é uma gaveta que
   * cobre a tela — recolher ali não sobraria espaço para nada, e esconderia
   * os rótulos justamente onde o alvo de toque precisa deles.
   */
  recolhido: boolean;
  onAlternarRecolhido: () => void;
}) {
  const pathname = usePathname();

  // A gaveta fecha ao navegar: sem isso, tocar num item do menu no celular
  // carrega a página nova com a gaveta ainda aberta por cima dela.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só o caminho deve disparar o fechamento
  }, [pathname]);

  /** Some a partir de `md:` quando o menu está recolhido. */
  const soLargo = recolhido ? "md:hidden" : undefined;

  const renderItem = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    const count = item.countKey ? counts[item.countKey] : undefined;
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch
        // O título só serve quando o rótulo está escondido; com o menu largo
        // ele seria uma dica repetindo o que já está escrito ao lado.
        title={recolhido ? (count ? `${item.label} (${count})` : item.label) : undefined}
        className={clsx(
          "flex items-center gap-2.5 rounded-control px-2.5 py-2 text-body font-medium transition-colors",
          recolhido && "md:justify-center md:gap-0 md:px-0",
          // Pílula verde CHEIA, e não a tinta clara de antes. Com a tinta, o
          // item ativo e o item sob o mouse tinham peso parecido, e a pergunta
          // "onde eu estou?" custava um segundo. Cheio, ela some.
          active ? "bg-accent text-bone shadow-raised" : "text-muted hover:bg-neutral-tint hover:text-ink"
        )}
      >
        <span className="relative flex">
          <Icon />
          {/* Recolhido não cabe número, mas perder o sinal de "tem tarefa
              aberta" seria perder o motivo de o contador existir. Vira ponto;
              o número continua acessível no título. */}
          {recolhido && !!count && (
            // Sobre a pílula cheia o ponto verde sumiria; no item inativo,
            // um ponto claro sumiria no fundo. A cor segue o estado.
            <span
              className={clsx(
                "absolute -top-0.5 -right-1 hidden h-1.5 w-1.5 rounded-full md:block",
                active ? "bg-bone" : "bg-accent"
              )}
            />
          )}
        </span>
        <span className={soLargo}>{item.label}</span>
        {count === null ? (
          // Um "0" aqui seria uma afirmação; "—" é a ausência de resposta.
          <span
            className={clsx(
              "ml-auto font-mono text-[10px] font-semibold",
              active ? "text-bone/85" : "text-faint",
              soLargo
            )}
            title="Não foi possível ler este número agora"
          >
            —
          </span>
        ) : (
          !!count && (
            <span
              className={clsx(
                "ml-auto font-mono text-[10px] font-semibold",
                // Verde sobre a pílula verde seria invisível.
                active ? "text-bone" : "text-faint",
                soLargo
              )}
            >
              {count}
            </span>
          )
        )}
      </Link>
    );
  };

  const grupo = (titulo: string, itens: NavItem[]) => (
    <div className="flex flex-col gap-0.5 px-3">
      {recolhido ? (
        // Sem rótulo de grupo não haveria nada separando TRABALHO de NEGÓCIO,
        // e os oito ícones virariam uma lista só. O traço faz o mesmo trabalho
        // em 60px de largura.
        <div className="mx-1 my-2 hidden border-t border-border md:block" />
      ) : null}
      <span
        className={clsx(
          "px-2.5 pt-4 pb-1.5 font-mono text-[9.5px] font-semibold tracking-[0.09em] text-faint",
          soLargo
        )}
      >
        {titulo}
      </span>
      {itens.map(renderItem)}
    </div>
  );

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink/20 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex h-full w-[236px] flex-none flex-col border-r border-border bg-surface py-4.5 transition-[transform,width] duration-200 md:static md:translate-x-0",
          recolhido && "md:w-[60px]",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className={clsx("flex items-center gap-2 px-4.5 pb-1.5", recolhido && "md:px-0 md:justify-center")}>
          <AuraLogo />
          <span className={clsx("text-title font-semibold", soLargo)}>aura</span>
          <button
            type="button"
            onClick={onAlternarRecolhido}
            aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
            title={recolhido ? "Expandir menu" : "Recolher menu"}
            className={clsx(
              "ml-auto hidden text-faint transition-colors hover:text-ink md:flex",
              recolhido && "md:hidden"
            )}
          >
            <RecolherIcon />
          </button>
        </div>

        {/* Recolhido, o botão de expandir troca de lugar: no cabeçalho não
            sobra espaço ao lado da marca, e escondê-lo deixaria o menu sem
            volta. */}
        {recolhido && (
          <button
            type="button"
            onClick={onAlternarRecolhido}
            aria-label="Expandir menu"
            title="Expandir menu"
            className="mx-auto mt-2 hidden text-faint transition-colors hover:text-ink md:flex"
          >
            <ExpandirIcon />
          </button>
        )}

        <div
          className={clsx(
            "mx-3 mt-2.5 mb-1 flex items-center gap-2 rounded-control border border-border bg-bone px-2.5 py-1.5 text-xs font-medium text-muted",
            soLargo
          )}
        >
          <span className="flex h-4 w-4 items-center justify-center rounded bg-accent-tint font-mono text-[9px] font-semibold text-accent">
            A
          </span>
          Aura Studio
        </div>

        <div className="mt-2 flex flex-col">{grupo("TRABALHO", workItems)}</div>
        {grupo("NEGÓCIO", businessItems)}

        <form
          action={signOut}
          className={clsx(
            "mx-3 mt-auto flex items-center gap-2.5 border-t border-border pt-3.5",
            recolhido && "md:mx-0 md:flex-col md:gap-2 md:px-2"
          )}
        >
          <Avatar initials={profile.initials} />
          <div className={clsx("min-w-0", soLargo)}>
            <div className="truncate text-small font-medium">{profile.full_name}</div>
            <div className="truncate font-mono text-[11px] text-muted">
              {profile.role_title || "Fundador(a)"}
            </div>
          </div>
          <button
            type="submit"
            title="Sair"
            aria-label="Sair"
            className={clsx("ml-auto flex text-muted hover:text-ink", recolhido && "md:ml-0")}
          >
            <LogoutIcon />
          </button>
        </form>
      </div>
    </>
  );
}

export function MobileNavToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Abrir menu"
      className="flex text-muted hover:text-ink md:hidden"
    >
      <MenuIcon />
    </button>
  );
}

function MenuIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
    </svg>
  );
}

function RecolherIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M6.2 2.8h6.2a.8.8 0 0 1 .8.8v8.8a.8.8 0 0 1-.8.8H6.2M6.2 2.8H3.6a.8.8 0 0 0-.8.8v8.8a.8.8 0 0 0 .8.8h2.6M6.2 2.8v10.4" />
    </svg>
  );
}

function ExpandirIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M9.8 2.8H3.6a.8.8 0 0 0-.8.8v8.8a.8.8 0 0 0 .8.8h6.2M9.8 2.8h2.6a.8.8 0 0 1 .8.8v8.8a.8.8 0 0 1-.8.8H9.8M9.8 2.8v10.4" />
    </svg>
  );
}

function iconProps() {
  return { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.3 } as const;
}

function HomeIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M2.6 7 8 2.6 13.4 7v6.4H2.6z" />
    </svg>
  );
}
function KanbanIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M2.6 3h3.2v10.2H2.6zM6.9 3h3.2v6.6H6.9zM11.2 3h2.2v10.2h-2.2z" />
    </svg>
  );
}
function ImplantacaoIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M2.6 3.4h4.2M2.6 8h7M2.6 12.6h10" />
    </svg>
  );
}
function PainelIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3.2 12.8V8.4M8 12.8V3.2M12.8 12.8V6.4" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="8" cy="8" r="5.4" />
      <circle cx="8" cy="8" r="1.8" />
    </svg>
  );
}
function PipelineIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M2.4 2.8h11.2L9.4 8.2v4.3L6.6 14V8.2z" />
    </svg>
  );
}
function PlaybookIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 2.8h5.2A1.8 1.8 0 0 1 10 4.6v8.6H4.8A1.8 1.8 0 0 1 3 11.4z" />
      <path d="M10 4.6a1.8 1.8 0 0 1 1.8-1.8H13v10.4h-1.2" />
    </svg>
  );
}
function ReuniaoIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="2.4" y="3.4" width="11.2" height="10.2" rx="1.4" />
      <path d="M2.4 6.4h11.2M5.6 2.2v2.2M10.4 2.2v2.2" />
    </svg>
  );
}
function CredentialsIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="5.4" cy="8" r="2.6" />
      <path d="M7.8 8h6M11 8v2.4M13 8v3.2" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M6.5 2.8H3.6a.8.8 0 0 0-.8.8v8.8a.8.8 0 0 0 .8.8h2.9" />
      <path d="M10.6 11.2 13.8 8l-3.2-3.2M13.8 8H6.2" />
    </svg>
  );
}

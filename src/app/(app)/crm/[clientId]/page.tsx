import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody } from "@/components/layout/PageBody";
import { Kpi, Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Avatar } from "@/components/ui/Avatar";
import { Unavailable } from "@/components/ui/Unavailable";
import { getClientDetail } from "@/lib/data/crm";
import { formatCurrency, formatDate } from "@/lib/format";
import { ClientHeaderActions, ContractsCard, ContactHistoryCard } from "@/components/crm/ClientDetailClient";

const priorityLabel: Record<string, string> = { high: "Alta", medium: "Média", low: "Baixa" };

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const detail = await getClientDetail(clientId);

  // Consulta que falhou não é cliente inexistente: um notFound() aqui afirmaria
  // que a ficha não existe quando na verdade ninguém conseguiu lê-la.
  if (detail.unavailable) {
    return (
      <PageBody>
        <div className="text-[12.5px] text-faint">
          <Link href="/crm" className="hover:text-ink">← Voltar para CRM</Link>
        </div>
        <Unavailable title="Não foi possível carregar a ficha deste cliente agora" />
      </PageBody>
    );
  }

  const { client, contracts, invoices, tasks, contacts, runs, totalMinutes, revenueTotal } = detail;

  if (!client) notFound();

  const activeTasks = tasks.filter((t) => t.status !== "done");
  const initials = client.name.slice(0, 2).toUpperCase();

  return (
    <PageBody>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3.5">
          <span
            className="flex h-10.5 w-10.5 items-center justify-center rounded-[10px] text-sm font-semibold"
            style={{ background: `color-mix(in oklab, ${client.color} 16%, white)`, color: client.color }}
          >
            {initials}
          </span>
          <div>
            <h1 className="text-[21px] font-medium">{client.name}</h1>
            <div className="mt-0.5 text-[12.5px] text-muted">
              {client.client_since ? `Cliente desde ${formatDate(client.client_since, { month: "long", year: "numeric" })}` : "Cliente"}
              {client.contact_name ? ` · Contato: ${client.contact_name}` : ""}
            </div>
          </div>
          <Tag tone={client.status === "active" ? "accent" : "neutral"}>{client.status === "active" ? "Ativo" : "Inativo"}</Tag>
        </div>
        <ClientHeaderActions clientId={client.id} />
      </div>

      <div className="text-[12.5px] text-faint">
        <Link href="/crm" className="hover:text-ink">← Voltar para CRM</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="RECEITA ACUMULADA" value={formatCurrency(revenueTotal)} />
        <Kpi label="CONTRATOS ATIVOS" value={contracts.filter((c) => c.status === "active").length} />
        <Kpi label="TAREFAS ATIVAS" value={activeTasks.length} />
        <Kpi label="HORAS REGISTRADAS" value={`${(totalMinutes / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`} />
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3.5 overflow-hidden md:grid-cols-[1.6fr_1fr]">
        <div className="flex min-h-0 flex-col gap-3.5 overflow-y-auto scrollbar-thin">
          <Card className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2">
              <span className="label">TAREFAS ATIVAS</span>
              <Link href="/kanban" className="ml-auto font-mono text-[11px] text-muted hover:text-ink">abrir no Kanban →</Link>
            </div>
            {activeTasks.map((t) => (
              <div key={t.id} className="grid grid-cols-[1fr_90px_74px_28px] items-center gap-2 border-b border-border-soft py-2 text-[13px] last:border-b-0">
                <span className="truncate">{t.title}</span>
                <Tag tone={t.priority === "high" ? "red" : "neutral"} dot>{priorityLabel[t.priority]}</Tag>
                <span className="font-mono text-[11px] text-muted">{t.due_date ? formatDate(t.due_date) : "—"}</span>
                <Avatar initials={t.assignee?.initials} size="sm" ghost={!t.assignee} />
              </div>
            ))}
            {activeTasks.length === 0 && <div className="py-3 text-center text-[12.5px] text-faint">Nenhuma tarefa ativa.</div>}
          </Card>

          <ContractsCard clientId={client.id} contracts={contracts} />

          <Card className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2">
              <span className="label">FATURAS RECENTES</span>
            </div>
            <div className="grid grid-cols-[1fr_.8fr_.8fr_.8fr] gap-2 border-b border-border pb-1.5 font-mono text-[9.5px] font-semibold tracking-wide text-faint">
              <div>REFERÊNCIA</div>
              <div>VENCIMENTO</div>
              <div>VALOR</div>
              <div>STATUS</div>
            </div>
            {invoices.slice(0, 6).map((inv) => (
              <div key={inv.id} className="grid grid-cols-[1fr_.8fr_.8fr_.8fr] items-center gap-2 border-b border-border-soft py-2 text-[13px] last:border-b-0">
                <div>{inv.reference_period}</div>
                <div className="font-mono text-muted">venc. {formatDate(inv.due_date)}</div>
                <div>{formatCurrency(Number(inv.amount))}</div>
                <Tag tone={inv.status === "paid" ? "accent" : inv.status === "overdue" ? "red" : "neutral"}>
                  {inv.status === "paid" ? "Paga" : inv.status === "overdue" ? "Atrasada" : "Pendente"}
                </Tag>
              </div>
            ))}
            {invoices.length === 0 && <div className="py-3 text-center text-[12.5px] text-faint">Nenhuma fatura ainda.</div>}
          </Card>
        </div>

        <div className="flex min-h-0 flex-col gap-3.5">
          <Card className="flex flex-col gap-2.5 p-4">
            <span className="label">DADOS</span>
            <div className="grid grid-cols-[76px_1fr] gap-y-2 gap-x-3 text-[12.5px]">
              <span className="text-muted">Contato</span>
              <span>{client.contact_name ?? "—"}</span>
              <span className="text-muted">E-mail</span>
              <span>{client.contact_email ?? "—"}</span>
              <span className="text-muted">Telefone</span>
              <span className="font-mono">{client.contact_phone ?? "—"}</span>
              <span className="text-muted">Responsável</span>
              <span>{client.owner?.full_name ?? "—"}</span>
              <span className="text-muted">Segmento</span>
              <span>{client.segment ?? "—"}</span>
            </div>
          </Card>

          <Card className="flex flex-col gap-2 p-4">
            <span className="label">PLAYBOOKS APLICADOS</span>
            <div className="flex flex-col gap-2 text-[12.5px]">
              {runs.map((r) => (
                <div key={r.id} className="flex items-center justify-between">
                  <span>{r.playbook?.name ?? "—"}</span>
                  <Tag tone={r.status === "done" ? "accent" : "neutral"}>{r.status === "done" ? "Concluído" : "Em execução"}</Tag>
                </div>
              ))}
              {runs.length === 0 && <div className="text-faint">Nenhum playbook aplicado ainda.</div>}
            </div>
          </Card>

          <ContactHistoryCard contacts={contacts} />
        </div>
      </div>
    </PageBody>
  );
}

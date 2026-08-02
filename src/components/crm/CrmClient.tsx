"use client";

import { useState } from "react";
import Link from "next/link";
import { useTransition } from "react";
import { Kpi, Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { NewClientModal, NewDealModal, NewInvoiceModal } from "./CrmModals";
import { formatCurrency, formatDate } from "@/lib/format";
import { markInvoiceStatus, updateDealStage } from "@/lib/actions/crm";
import type { Tables } from "@/lib/supabase/database.types";

type ClientRow = Tables<"clients"> & { owner: { id: string; full_name: string; initials: string } | null };
type DealRow = Tables<"deals"> & { client: { id: string; name: string } | null; owner: { id: string; full_name: string; initials: string } | null };
type InvoiceRow = Tables<"invoices"> & { client: { id: string; name: string; color: string } | null };

const stages = [
  { id: "lead", label: "LEAD" },
  { id: "proposal", label: "PROPOSTA" },
  { id: "negotiation", label: "NEGOCIAÇÃO" },
  { id: "won", label: "FECHADO" },
] as const;

export function CrmClient({
  clients,
  deals,
  invoices,
  profiles,
  monthRevenue,
  overdueAmount,
  overdueCount,
  inadimplenciaPct,
  ticketMedio,
}: {
  clients: ClientRow[];
  deals: DealRow[];
  invoices: InvoiceRow[];
  profiles: { id: string; full_name: string }[];
  monthRevenue: number;
  overdueAmount: number;
  overdueCount: number;
  inadimplenciaPct: number;
  ticketMedio: number;
}) {
  const [tab, setTab] = useState<"overview" | "clientes" | "pipeline" | "faturas">("overview");
  const [modal, setModal] = useState<"client" | "deal" | "invoice" | null>(null);
  const [, startTransition] = useTransition();

  const activeClients = clients.filter((c) => c.status === "active");
  const pipelineValue = deals.filter((d) => d.stage !== "won" && d.stage !== "lost").reduce((s, d) => s + Number(d.value ?? 0), 0);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[21px] font-medium">CRM</h1>
          <div className="mt-0.5 text-[12.5px] text-muted">
            {activeClients.length} clientes ativos · {deals.filter((d) => d.stage !== "won" && d.stage !== "lost").length} oportunidades no pipeline
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tab === "pipeline" && <Button variant="ghost" onClick={() => setModal("deal")}>+ Novo negócio</Button>}
          {tab === "faturas" && <Button variant="ghost" onClick={() => setModal("invoice")}>+ Nova fatura</Button>}
          <Button onClick={() => setModal("client")}>+ Novo cliente</Button>
        </div>
      </div>

      <div className="flex gap-4.5 border-b border-border">
        {(["overview", "clientes", "pipeline", "faturas"] as const).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`pb-2.25 text-[12.5px] ${tab === tb ? "border-b-2 border-accent font-medium text-accent" : "text-muted"}`}
          >
            {tb === "overview" ? "Visão geral" : tb === "clientes" ? "Clientes" : tb === "pipeline" ? "Pipeline" : `Faturas · ${overdueCount}`}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto scrollbar-thin">
          <div className="grid grid-cols-4 gap-3">
            <Kpi label="FATURAMENTO (MÊS)" value={formatCurrency(monthRevenue)} />
            <Kpi label="TICKET MÉDIO" value={ticketMedio > 0 ? formatCurrency(Math.round(ticketMedio)) : "—"} />
            <Kpi label="PIPELINE ABERTO" value={formatCurrency(pipelineValue)} />
            <Kpi label="INADIMPLÊNCIA" value={`${inadimplenciaPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`} valueClassName={overdueCount > 0 ? "text-red" : undefined} labelClassName={overdueCount > 0 ? "text-red" : undefined} sub={overdueCount > 0 ? `${formatCurrency(overdueAmount)} · ${overdueCount} faturas` : "tudo em dia"} />
          </div>

          <Card className="flex-1 overflow-hidden p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="label">CLIENTES ATIVOS</span>
              <button onClick={() => setTab("clientes")} className="ml-auto font-mono text-[11px] text-muted hover:text-ink">ver todos →</button>
            </div>
            <div className="grid grid-cols-[1.6fr_1fr_1fr] gap-2 border-b border-border pb-2 font-mono text-[9.5px] font-semibold tracking-wide text-faint">
              <div>CLIENTE</div>
              <div>SEGMENTO</div>
              <div>RESPONSÁVEL</div>
            </div>
            <div className="overflow-y-auto scrollbar-thin">
              {activeClients.slice(0, 6).map((c) => (
                <Link key={c.id} href={`/crm/${c.id}`} className="grid grid-cols-[1.6fr_1fr_1fr] items-center gap-2 border-b border-border-soft py-2.5 text-[13px] hover:bg-neutral-tint">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-sm" style={{ background: c.color }} />
                    {c.name}
                  </div>
                  <div className="text-muted">{c.segment ?? "—"}</div>
                  <div className="flex items-center gap-2">
                    {c.owner ? <><Avatar initials={c.owner.initials} size="sm" ghost />{c.owner.full_name.split(" ")[0]}</> : "—"}
                  </div>
                </Link>
              ))}
              {activeClients.length === 0 && <div className="py-8 text-center text-[13px] text-faint">Nenhum cliente cadastrado ainda.</div>}
            </div>
          </Card>
        </div>
      )}

      {tab === "clientes" && (
        <Card className="flex-1 overflow-hidden p-4">
          <div className="grid grid-cols-[1.6fr_1fr_.9fr_1fr] gap-2 border-b border-border pb-2 font-mono text-[9.5px] font-semibold tracking-wide text-faint">
            <div>CLIENTE</div>
            <div>SEGMENTO</div>
            <div>STATUS</div>
            <div>DESDE</div>
          </div>
          <div className="overflow-y-auto scrollbar-thin">
            {clients.map((c) => (
              <Link key={c.id} href={`/crm/${c.id}`} className="grid grid-cols-[1.6fr_1fr_.9fr_1fr] items-center gap-2 border-b border-border-soft py-2.5 text-[13px] hover:bg-neutral-tint">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ background: c.color }} />
                  {c.name}
                </div>
                <div className="text-muted">{c.segment ?? "—"}</div>
                <Tag tone={c.status === "active" ? "accent" : "neutral"}>{c.status === "active" ? "Ativo" : "Inativo"}</Tag>
                <div className="font-mono text-muted">{c.client_since ? formatDate(c.client_since) : "—"}</div>
              </Link>
            ))}
            {clients.length === 0 && <div className="py-8 text-center text-[13px] text-faint">Nenhum cliente cadastrado ainda.</div>}
          </div>
        </Card>
      )}

      {tab === "pipeline" && (
        <div className="grid flex-1 grid-cols-4 gap-3 overflow-hidden">
          {stages.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage.id);
            const value = stageDeals.reduce((s, d) => s + Number(d.value ?? 0), 0);
            return (
              <div key={stage.id} className="flex min-h-0 flex-col gap-2 overflow-y-auto scrollbar-thin rounded-xl border border-neutral-tint-border bg-neutral-tint p-2.75">
                <div className="flex items-center justify-between px-0.5">
                  <span className="label">{stage.label} · {stageDeals.length}</span>
                  <span className="font-mono text-[11px] text-muted">{formatCurrency(value)}</span>
                </div>
                {stageDeals.map((d) => (
                  <div key={d.id} className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-surface p-2.5">
                    <div className="text-[12.5px] font-medium">{d.client?.name ?? d.name}</div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-muted">{d.value ? formatCurrency(Number(d.value)) : "—"}</span>
                      <Avatar initials={d.owner?.initials} size="sm" ghost />
                    </div>
                    <select
                      value={d.stage}
                      onChange={(e) => startTransition(async () => { await updateDealStage(d.id, e.target.value); })}
                      className="rounded border border-border bg-bone px-1.5 py-1 text-[11px] text-muted"
                    >
                      {stages.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                      <option value="lost">PERDIDO</option>
                    </select>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {tab === "faturas" && (
        <Card className="flex-1 overflow-hidden p-4">
          <div className="grid grid-cols-[1.4fr_1fr_.9fr_.9fr_.8fr] gap-2 border-b border-border pb-2 font-mono text-[9.5px] font-semibold tracking-wide text-faint">
            <div>CLIENTE</div>
            <div>REFERÊNCIA</div>
            <div>VENCIMENTO</div>
            <div>VALOR</div>
            <div>STATUS</div>
          </div>
          <div className="overflow-y-auto scrollbar-thin">
            {invoices.map((inv) => (
              <div key={inv.id} className="grid grid-cols-[1.4fr_1fr_.9fr_.9fr_.8fr] items-center gap-2 border-b border-border-soft py-2.5 text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ background: inv.client?.color ?? "#9A9890" }} />
                  {inv.client?.name ?? "—"}
                </div>
                <div className="text-muted">{inv.reference_period}</div>
                <div className="font-mono text-muted">{formatDate(inv.due_date)}</div>
                <div>{formatCurrency(Number(inv.amount))}</div>
                <select
                  value={inv.status}
                  onChange={(e) => startTransition(async () => { await markInvoiceStatus(inv.id, inv.client_id, e.target.value); })}
                  className="justify-self-start rounded-full border-0 bg-transparent text-[11px] font-medium"
                  style={{ color: inv.status === "paid" ? "#0B6B54" : inv.status === "overdue" ? "#C4574A" : "#5C5A52" }}
                >
                  <option value="pending">Pendente</option>
                  <option value="paid">Paga</option>
                  <option value="overdue">Atrasada</option>
                </select>
              </div>
            ))}
            {invoices.length === 0 && <div className="py-8 text-center text-[13px] text-faint">Nenhuma fatura registrada ainda.</div>}
          </div>
        </Card>
      )}

      {modal === "client" && <NewClientModal onClose={() => setModal(null)} />}
      {modal === "deal" && <NewDealModal clients={clients} profiles={profiles} onClose={() => setModal(null)} />}
      {modal === "invoice" && <NewInvoiceModal clients={clients} onClose={() => setModal(null)} />}
    </>
  );
}

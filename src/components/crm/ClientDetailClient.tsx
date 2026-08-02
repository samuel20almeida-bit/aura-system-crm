"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { NewContractModal, NewInvoiceModal } from "./CrmModals";
import { formatCurrency, formatDate } from "@/lib/format";
import { addClientContact } from "@/lib/actions/crm";
import { useRouter } from "next/navigation";

export function ClientHeaderActions({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [modal, setModal] = useState<"contact" | "invoice" | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" onClick={() => setModal("contact")}>Registrar contato</Button>
      <Button onClick={() => setModal("invoice")}>Nova fatura</Button>

      {modal === "contact" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/20 px-4" onClick={() => setModal(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              startTransition(async () => {
                await addClientContact(clientId, note.trim());
                setNote("");
                setModal(null);
                router.refresh();
              });
            }}
            className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-border bg-surface p-5.5"
          >
            <h2 className="text-base font-medium">Registrar contato</h2>
            <textarea
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Call de alinhamento, e-mail enviado…"
              className="resize-none rounded-lg border border-border bg-bone px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setModal(null)}>Cancelar</Button>
              <Button type="submit" disabled={pending}>Salvar</Button>
            </div>
          </form>
        </div>
      )}
      {modal === "invoice" && <NewInvoiceModal clients={[]} defaultClientId={clientId} onClose={() => setModal(null)} />}
    </div>
  );
}

export function ContractsCard({ clientId, contracts }: { clientId: string; contracts: { id: string; name: string; contract_type: string; value: number | null; status: string; start_date: string | null; end_date: string | null }[] }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const typeLabel: Record<string, string> = { annual: "Anual", monthly: "Mensal", project: "Projeto" };

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        <span className="label">CONTRATOS</span>
        <button onClick={() => setShowModal(true)} className="ml-auto font-mono text-[11px] text-muted hover:text-ink">+ adicionar</button>
      </div>
      <div className="grid grid-cols-[1.4fr_1fr_.9fr_.8fr] gap-2 border-b border-border pb-1.5 font-mono text-[9.5px] font-semibold tracking-wide text-faint">
        <div>CONTRATO</div>
        <div>VIGÊNCIA</div>
        <div>VALOR</div>
        <div>STATUS</div>
      </div>
      {contracts.map((c) => (
        <div key={c.id} className="grid grid-cols-[1.4fr_1fr_.9fr_.8fr] items-center gap-2 border-b border-border-soft py-2 text-[13px] last:border-b-0">
          <div>{c.name} <span className="text-muted">· {typeLabel[c.contract_type]}</span></div>
          <div className="font-mono text-muted">{c.start_date ? formatDate(c.start_date) : "—"}{c.end_date ? ` – ${formatDate(c.end_date)}` : ""}</div>
          <div>{c.value ? formatCurrency(Number(c.value)) : "—"}</div>
          <Tag tone={c.status === "active" ? "accent" : "neutral"}>{c.status === "active" ? "Ativo" : "Encerrado"}</Tag>
        </div>
      ))}
      {contracts.length === 0 && <div className="py-3 text-center text-[12.5px] text-faint">Nenhum contrato ainda.</div>}
      {showModal && <NewContractModal clientId={clientId} onClose={() => { setShowModal(false); router.refresh(); }} />}
    </Card>
  );
}

export function ContactHistoryCard({ contacts }: { contacts: { id: string; note: string; created_at: string; author: { full_name: string; initials: string } | null }[] }) {
  return (
    <Card className="flex flex-1 flex-col gap-2.5 overflow-hidden p-4">
      <span className="label">HISTÓRICO DE CONTATO</span>
      <div className="flex flex-col gap-2.5 overflow-y-auto scrollbar-thin text-[12.5px]">
        {contacts.map((c) => (
          <div key={c.id} className="flex gap-2.5">
            <Avatar initials={c.author?.initials} size="sm" ghost />
            <div>
              <span>{c.note}</span>
              <div className="mt-0.5 font-mono text-[11px] text-faint">{formatDate(c.created_at)}</div>
            </div>
          </div>
        ))}
        {contacts.length === 0 && <div className="py-2 text-faint">Nenhum registro ainda.</div>}
      </div>
    </Card>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Overlay";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { createClientRecord, createContract, createDeal, createInvoice } from "@/lib/actions/crm";
import { beginMutation } from "@/lib/realtime/mutation-gate";
import { useToast } from "@/components/ui/Toast";

/** Sem isto, uma falha ao criar deixava a janela aberta e muda: o botão voltava
 *  ao normal, nada era criado e nenhuma mensagem aparecia. O usuário concluía
 *  que o sistema não permite cadastrar. */
function useCreateHandler(onClose: () => void) {
  const router = useRouter();
  const { notify } = useToast();
  return async function run(what: string, action: () => Promise<unknown>) {
    const end = beginMutation();
    try {
      await action();
      router.refresh();
      onClose();
    } catch (error) {
      console.error(`[crm] falha ao criar ${what}:`, error);
      notify("error", `Não foi possível criar ${what}. Tente de novo — se persistir, me avise.`);
    } finally {
      end();
    }
  };
}

export function NewClientModal({ onClose }: { onClose: () => void }) {
  const run = useCreateHandler(onClose);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          startTransition(() =>
            run("o cliente", () =>
              createClientRecord({
                name: name.trim(),
                segment: segment || null,
                contactName: contactName || null,
                contactEmail: contactEmail || null,
              })
            )
          );
        }}
        className="flex flex-col gap-3.5 p-5.5"
      >
        <h2 className="text-base font-medium">Novo cliente</h2>
        <Field label="NOME DO CLIENTE">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="SEGMENTO">
          <Input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="SaaS B2B, Varejo…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CONTATO">
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </Field>
          <Field label="E-MAIL">
            <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </Field>
        </div>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar cliente"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function NewDealModal({
  clients,
  profiles,
  onClose,
}: {
  clients: { id: string; name: string }[];
  profiles: { id: string; full_name: string }[];
  onClose: () => void;
}) {
  const run = useCreateHandler(onClose);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [value, setValue] = useState("");
  const [ownerId, setOwnerId] = useState("");

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          startTransition(() =>
            run("o negócio", () =>
              createDeal({
                name: name.trim(),
                clientId: clientId || null,
                stage: "lead",
                value: value ? Number(value) : null,
                ownerId: ownerId || null,
              })
            )
          );
        }}
        className="flex flex-col gap-3.5 p-5.5"
      >
        <h2 className="text-base font-medium">Novo negócio</h2>
        <Field label="NOME DO NEGÓCIO">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="CLIENTE / LEAD EXISTENTE">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Novo lead (sem cliente ainda)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="VALOR POTENCIAL (R$)">
            <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Field label="RESPONSÁVEL">
            <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">—</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar negócio"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function NewInvoiceModal({
  clients,
  defaultClientId,
  onClose,
}: {
  clients: { id: string; name: string }[];
  defaultClientId?: string;
  onClose: () => void;
}) {
  const run = useCreateHandler(onClose);
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [referencePeriod, setReferencePeriod] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("pending");

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!clientId || !dueDate || !amount) return;
          startTransition(() =>
            run("a fatura", () =>
              createInvoice({
                clientId,
                referencePeriod: referencePeriod || dueDate.slice(0, 7),
                dueDate,
                amount: Number(amount),
                status,
              })
            )
          );
        }}
        className="flex flex-col gap-3.5 p-5.5"
      >
        <h2 className="text-base font-medium">Nova fatura</h2>
        {!defaultClientId && (
          <Field label="CLIENTE">
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              <option value="">Selecione…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="REFERÊNCIA">
            <Input value={referencePeriod} onChange={(e) => setReferencePeriod(e.target.value)} placeholder="Ago 2026" />
          </Field>
          <Field label="VENCIMENTO">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="VALOR (R$)">
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </Field>
          <Field label="STATUS">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="pending">Pendente</option>
              <option value="paid">Paga</option>
              <option value="overdue">Atrasada</option>
            </Select>
          </Field>
        </div>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Criar fatura"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function NewContractModal({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const run = useCreateHandler(onClose);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [contractType, setContractType] = useState("annual");
  const [value, setValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          startTransition(() =>
            run("o contrato", () =>
              createContract({
                clientId,
                name: name.trim(),
                contractType,
                value: value ? Number(value) : null,
                startDate: startDate || null,
                endDate: endDate || null,
              })
            )
          );
        }}
        className="flex flex-col gap-3.5 p-5.5"
      >
        <h2 className="text-base font-medium">Novo contrato</h2>
        <Field label="NOME">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Contrato 2026" required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="TIPO">
            <Select value={contractType} onChange={(e) => setContractType(e.target.value)}>
              <option value="annual">Anual</option>
              <option value="monthly">Mensal</option>
              <option value="project">Projeto</option>
            </Select>
          </Field>
          <Field label="VALOR (R$)">
            <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="INÍCIO">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="FIM">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Criar contrato"}</Button>
        </div>
      </form>
    </Modal>
  );
}

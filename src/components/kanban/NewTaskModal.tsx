"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { createTask } from "@/lib/actions/tasks";
import { beginMutation } from "@/lib/realtime/mutation-gate";
import type { Tables } from "@/lib/supabase/database.types";

type ClientLite = { id: string; name: string; color: string; code_prefix: string };

export function NewTaskModal({
  clients,
  profiles,
  onClose,
}: {
  clients: ClientLite[];
  profiles: Tables<"profiles">[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [isInternal, setIsInternal] = useState(clients.length === 0);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [area, setArea] = useState("Estúdio");
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const end = beginMutation();
      try {
        await createTask({
          title: title.trim(),
          clientId: isInternal ? null : clientId || null,
          isInternal,
          area: isInternal ? area : null,
          priority,
          assigneeId: assigneeId || null,
          dueDate: dueDate || null,
          description: description || null,
        });
        router.refresh();
        onClose();
      } finally {
        end();
      }
    });
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3.5 p-5.5">
        <h2 className="text-base font-medium">Nova tarefa</h2>

        <Field label="TÍTULO">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito?" required />
        </Field>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsInternal(false)}
            className={`flex-1 rounded-lg border px-3 py-2 text-[13px] ${!isInternal ? "border-ink bg-ink text-bone" : "border-border text-muted"}`}
          >
            Tarefa de cliente
          </button>
          <button
            type="button"
            onClick={() => setIsInternal(true)}
            className={`flex-1 rounded-lg border px-3 py-2 text-[13px] ${isInternal ? "border-ink bg-ink text-bone" : "border-border text-muted"}`}
          >
            Interna
          </button>
        </div>

        {isInternal ? (
          <Field label="ÁREA">
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Estúdio, Financeiro, Marketing…" />
          </Field>
        ) : (
          <Field label="CLIENTE">
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Selecione…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="PRIORIDADE">
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </Select>
          </Field>
          <Field label="RESPONSÁVEL">
            <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Sem responsável</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="PRAZO">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>

        <Field label="DESCRIÇÃO">
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Criando…" : "Criar tarefa"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

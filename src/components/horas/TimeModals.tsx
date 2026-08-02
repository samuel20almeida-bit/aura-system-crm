"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { startTimer, logManualTime } from "@/lib/actions/time";

type ClientLite = { id: string; name: string };
type TaskLite = { id: string; title: string; client_id: string | null };

export function StartTimerModal({
  clients,
  tasks,
  onClose,
}: {
  clients: ClientLite[];
  tasks: TaskLite[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState("");
  const [taskId, setTaskId] = useState("");

  const filteredTasks = tasks.filter((t) => !clientId || t.client_id === clientId);

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            await startTimer(taskId || null, clientId || null);
            router.refresh();
            onClose();
          });
        }}
        className="flex flex-col gap-3.5 p-5.5"
      >
        <h2 className="text-base font-medium">Iniciar timer</h2>
        <Field label="CLIENTE">
          <Select value={clientId} onChange={(e) => { setClientId(e.target.value); setTaskId(""); }}>
            <option value="">Interno / sem cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="TAREFA (OPCIONAL)">
          <Select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">Sem tarefa vinculada</option>
            {filteredTasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </Select>
        </Field>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Iniciando…" : "Iniciar"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function LogTimeModal({
  clients,
  tasks,
  onClose,
}: {
  clients: ClientLite[];
  tasks: TaskLite[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [hours, setHours] = useState("1");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [billable, setBillable] = useState(true);

  const filteredTasks = tasks.filter((t) => !clientId || t.client_id === clientId);

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const minutes = Math.round(parseFloat(hours.replace(",", ".")) * 60);
          if (!minutes || minutes <= 0) return;
          startTransition(async () => {
            await logManualTime({
              taskId: taskId || null,
              clientId: clientId || null,
              minutes,
              note: note || null,
              billable,
              date,
            });
            router.refresh();
            onClose();
          });
        }}
        className="flex flex-col gap-3.5 p-5.5"
      >
        <h2 className="text-base font-medium">Registrar horas</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="HORAS">
            <Input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="1,5" required />
          </Field>
          <Field label="DATA">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        </div>
        <Field label="CLIENTE">
          <Select value={clientId} onChange={(e) => { setClientId(e.target.value); setTaskId(""); }}>
            <option value="">Interno / sem cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="TAREFA (OPCIONAL)">
          <Select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">Sem tarefa vinculada</option>
            {filteredTasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </Select>
        </Field>
        <Field label="NOTA (OPCIONAL)">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
          Faturável
        </label>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Registrar"}</Button>
        </div>
      </form>
    </Modal>
  );
}

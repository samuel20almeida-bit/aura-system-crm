"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, ProgressBar } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { Field, Input, Select } from "@/components/ui/Field";
import { createGoal, deleteGoal, updateGoalProgress } from "@/lib/actions/goals";
import { beginMutation } from "@/lib/realtime/mutation-gate";
import type { GoalRow } from "@/lib/data/goals";
import { useToast } from "@/components/ui/Toast";

function formatValue(value: number, unit: string) {
  if (unit === "currency") return `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
  if (unit === "percent") return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  if (unit === "hours") return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function GoalRowItem({ goal }: { goal: GoalRow }) {
  const router = useRouter();
  const { notify } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(goal.current));
  const [pending, startTransition] = useTransition();
  const [optimisticCurrent, setOptimisticCurrent] = useOptimistic(goal.current);
  const pct = goal.target > 0 ? (optimisticCurrent / goal.target) * 100 : 0;

  return (
    <div className="group flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[13px]">
        <span>{goal.title}</span>
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = Number(value.replace(",", ".")) || 0;
              startTransition(async () => {
                setOptimisticCurrent(parsed);
                const end = beginMutation();
                try {
                  await updateGoalProgress(goal.id, parsed);
                  setEditing(false);
                  router.refresh();
                } catch {
                  notify("error", "Não foi possível atualizar o progresso da meta. Tente novamente.");
                } finally {
                  end();
                }
              });
            }}
            className="flex items-center gap-1"
          >
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => setEditing(false)}
              className="w-16 rounded border border-border bg-bone px-1.5 py-0.5 font-mono text-[12px]"
            />
            <button type="submit" className="text-[11px] text-accent">✓</button>
          </form>
        ) : (
          <button onClick={() => setEditing(true)} className="font-mono text-[13px] hover:text-accent">
            {formatValue(optimisticCurrent, goal.unit)}
            <span className="text-faint"> / {formatValue(goal.target, goal.unit)}</span>
          </button>
        )}
      </div>
      <ProgressBar percent={pct} danger={pct < 50} />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-muted">
          {goal.owner ? `resp. ${goal.owner.full_name.split(" ")[0]}` : "sem responsável"}
        </span>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              if (!confirm("Excluir meta?")) return;
              const end = beginMutation();
              try {
                await deleteGoal(goal.id);
                router.refresh();
              } catch {
                notify("error", "Não foi possível excluir a meta. Tente novamente.");
              } finally {
                end();
              }
            })
          }
          className="hidden font-mono text-[11px] text-faint hover:text-red group-hover:block"
        >
          excluir
        </button>
      </div>
    </div>
  );
}

export function NewGoalModal({
  quarter,
  profiles,
  areas,
  onClose,
}: {
  quarter: string;
  profiles: { id: string; full_name: string }[];
  areas: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [area, setArea] = useState(areas[0] ?? "Geral");
  const [customArea, setCustomArea] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("0");
  const [unit, setUnit] = useState("number");
  const [ownerId, setOwnerId] = useState("");

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const finalArea = area === "__new" ? customArea.trim() : area;
          if (!title.trim() || !finalArea || !target) return;
          startTransition(async () => {
            const end = beginMutation();
            try {
              await createGoal({
                quarter,
                area: finalArea,
                title: title.trim(),
                target: Number(target.replace(",", ".")),
                current: Number(current.replace(",", ".")) || 0,
                unit,
                ownerId: ownerId || null,
              });
              router.refresh();
              onClose();
            } finally {
              end();
            }
          });
        }}
        className="flex flex-col gap-3.5 p-5.5"
      >
        <h2 className="text-base font-medium">Nova meta · {quarter}</h2>
        <Field label="TÍTULO">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fechar 6 novos contratos" required />
        </Field>
        <Field label="ÁREA">
          <Select value={area} onChange={(e) => setArea(e.target.value)}>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            <option value="__new">+ Nova área…</option>
          </Select>
        </Field>
        {area === "__new" && (
          <Field label="NOME DA NOVA ÁREA">
            <Input value={customArea} onChange={(e) => setCustomArea(e.target.value)} required />
          </Field>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Field label="ATUAL">
            <Input value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label="META">
            <Input value={target} onChange={(e) => setTarget(e.target.value)} required />
          </Field>
          <Field label="UNIDADE">
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="number">Número</option>
              <option value="currency">Moeda (R$)</option>
              <option value="percent">Percentual</option>
              <option value="hours">Horas</option>
            </Select>
          </Field>
        </div>
        <Field label="RESPONSÁVEL">
          <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">—</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
        </Field>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar meta"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function AreaCard({ area, goals }: { area: string; goals: GoalRow[] }) {
  const onTrack = goals.filter((g) => g.target > 0 && g.current / g.target >= 0.7).length;
  const atRisk = goals.length - onTrack;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <span className="label">{area.toUpperCase()}</span>
        {atRisk === 0 ? (
          <Tag tone="accent">no caminho</Tag>
        ) : (
          <Tag tone={atRisk === goals.length ? "red" : "neutral"}>{atRisk} em risco</Tag>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {goals.map((g) => <GoalRowItem key={g.id} goal={g} />)}
      </div>
    </Card>
  );
}

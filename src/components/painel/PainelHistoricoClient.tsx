"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import { todayInAppTz, addDaysToDateStr, monthStartInAppTz, yearMonthInAppTz } from "@/lib/timezone";
import {
  calcularSerieNegociosGanhos,
  calcularSerieContasCriadas,
  calcularSerieImplantacoesConcluidas,
  calcularOrigemReceitaNoPeriodo,
} from "@/lib/painel-historico";
import type { NegocioParaPainel, ContaParaPainel, ImplantacaoParaPainel } from "@/lib/painel";

type Preset = "7d" | "30d" | "90d" | "ano" | "personalizado";

const PRESETS: { valor: Preset; rotulo: string }[] = [
  { valor: "7d", rotulo: "7 dias" },
  { valor: "30d", rotulo: "30 dias" },
  { valor: "90d", rotulo: "90 dias" },
  { valor: "ano", rotulo: "Este ano" },
  { valor: "personalizado", rotulo: "Personalizado" },
];

function periodoPreset(preset: Preset, hoje: Date): { inicio: Date; fim: Date } {
  if (preset === "7d") return { inicio: new Date(hoje.getTime() - 6 * 86_400_000), fim: hoje };
  if (preset === "30d") return { inicio: new Date(hoje.getTime() - 29 * 86_400_000), fim: hoje };
  if (preset === "90d") return { inicio: new Date(hoje.getTime() - 89 * 86_400_000), fim: hoje };
  const { year } = yearMonthInAppTz(hoje);
  return { inicio: monthStartInAppTz(year, 0), fim: hoje };
}

export function PainelHistoricoClient({
  negocios,
  contas,
  implantacoes,
}: {
  negocios: NegocioParaPainel[];
  contas: ContaParaPainel[];
  implantacoes: ImplantacaoParaPainel[];
}) {
  const hoje = useMemo(() => new Date(), []);
  const [preset, setPreset] = useState<Preset>("30d");
  const [deCustom, setDeCustom] = useState(() => addDaysToDateStr(todayInAppTz(hoje), -29));
  const [ateCustom, setAteCustom] = useState(() => todayInAppTz(hoje));

  const periodo = useMemo(() => {
    if (preset === "personalizado") {
      return { inicio: new Date(`${deCustom}T12:00:00Z`), fim: new Date(`${ateCustom}T12:00:00Z`) };
    }
    return periodoPreset(preset, hoje);
  }, [preset, deCustom, ateCustom, hoje]);

  const rangeCustomInvalido = preset === "personalizado" && (!deCustom || !ateCustom || deCustom > ateCustom);

  const serieGanhos = useMemo(
    () => calcularSerieNegociosGanhos(negocios, periodo.inicio, periodo.fim),
    [negocios, periodo]
  );
  const serieContas = useMemo(
    () => calcularSerieContasCriadas(contas, periodo.inicio, periodo.fim),
    [contas, periodo]
  );
  const serieImplantacoes = useMemo(
    () => calcularSerieImplantacoesConcluidas(implantacoes, periodo.inicio, periodo.fim),
    [implantacoes, periodo]
  );
  const origemPeriodo = useMemo(
    () => calcularOrigemReceitaNoPeriodo(negocios, contas, periodo.inicio, periodo.fim),
    [negocios, contas, periodo]
  );

  const configGanhos: ChartConfig = { mrrGanho: { label: "Mensalidade conquistada", color: "var(--color-accent)" } };
  const configContas: ChartConfig = { contas: { label: "Novas contas", color: "var(--color-accent)" } };
  const configImplantacoes: ChartConfig = {
    concluidas: { label: "Implantações concluídas", color: "var(--color-amber)" },
  };
  const configOrigem: ChartConfig = { mrr: { label: "Mensalidade", color: "var(--color-accent)" } };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[13px] font-medium">Tendência no período</div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-border">
          {PRESETS.map((p) => (
            <button
              key={p.valor}
              type="button"
              onClick={() => setPreset(p.valor)}
              className={clsx(
                "px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                preset === p.valor ? "bg-accent text-bone" : "bg-surface text-muted hover:text-ink"
              )}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        {preset === "personalizado" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={deCustom} max={ateCustom} onChange={(e) => setDeCustom(e.target.value)} />
            <span className="text-muted">até</span>
            <Input
              type="date"
              value={ateCustom}
              min={deCustom}
              max={todayInAppTz(hoje)}
              onChange={(e) => setAteCustom(e.target.value)}
            />
            {rangeCustomInvalido && <span className="text-[12px] text-red">período inválido</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="flex flex-col gap-2 p-4">
          <span className="text-[13px] font-medium">Mensalidade conquistada por período</span>
          <ChartContainer config={configGanhos} className="h-[220px]">
            <AreaChart data={serieGanhos}>
              <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--color-border)" />
              <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis hide />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={formatCurrency}
                    renderExtra={(dadoPonto) => {
                      const ganhos = (dadoPonto as { ganhos?: number } | undefined)?.ganhos;
                      if (ganhos === undefined) return null;
                      return `${ganhos} ${ganhos === 1 ? "negócio ganho" : "negócios ganhos"}`;
                    }}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="mrrGanho"
                stroke="var(--color-accent)"
                fill="var(--color-accent-tint)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </Card>

        <Card className="flex flex-col gap-2 p-4">
          <span className="text-[13px] font-medium">Novas contas por período</span>
          <ChartContainer config={configContas} className="h-[220px]">
            <BarChart data={serieContas}>
              <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--color-border)" />
              <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="contas" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </Card>

        <Card className="flex flex-col gap-2 p-4">
          <span className="text-[13px] font-medium">Origem → receita no período selecionado</span>
          {origemPeriodo.length === 0 ? (
            <div className="text-[12.5px] text-faint">Nenhum negócio criado nesse período.</div>
          ) : (
            <ChartContainer config={configOrigem} className="h-[220px]">
              <BarChart data={origemPeriodo} layout="vertical">
                <CartesianGrid horizontal={false} strokeDasharray="4 4" stroke="var(--color-border)" />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="origem" tickLine={false} axisLine={false} fontSize={11} width={90} />
                <ChartTooltip content={<ChartTooltipContent formatter={formatCurrencyCompact} />} />
                <Bar dataKey="mrr" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </Card>

        <Card className="flex flex-col gap-2 p-4">
          <span className="text-[13px] font-medium">Implantações concluídas por período</span>
          <ChartContainer config={configImplantacoes} className="h-[220px]">
            <BarChart data={serieImplantacoes}>
              <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--color-border)" />
              <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="concluidas" fill="var(--color-amber)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </Card>
      </div>
    </div>
  );
}

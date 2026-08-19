"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import clsx from "clsx";

/**
 * Wrapper fino sobre `recharts`, adaptado do componente de gráfico do
 * shadcn/ui (achado via busca de componentes prontos no 21st.dev) — mantém
 * só o que os gráficos do Painel usam: container responsivo com cor de
 * série por CSS var, e um tooltip simples. Removido do original: a
 * distinção light/dark (este projeto não tem modo escuro), `ChartLegend` e
 * o gerador de dado de exemplo (o Painel só mostra dado real, vindo do
 * Supabase).
 */

export type ChartConfig = {
  [chave: string]: { label: string; color: string };
};

type ChartContextValue = { config: ChartConfig };
const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChart(): ChartContextValue {
  const contexto = React.useContext(ChartContext);
  if (!contexto) throw new Error("useChart precisa estar dentro de <ChartContainer />");
  return contexto;
}

export function ChartContainer({
  config,
  className,
  children,
}: {
  config: ChartConfig;
  className?: string;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const id = React.useId();
  const chartId = `chart-${id.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div data-chart={chartId} className={clsx("aspect-auto w-full", className)}>
        <style
          dangerouslySetInnerHTML={{
            __html: `[data-chart=${chartId}] {\n${Object.entries(config)
              .map(([chave, item]) => `  --color-${chave}: ${item.color};`)
              .join("\n")}\n}`,
          }}
        />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

type ItemTooltip = {
  dataKey?: string | number;
  name?: string | number;
  value?: number;
  color?: string;
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: readonly ItemTooltip[];
  label?: string;
  formatter?: (value: number) => string;
}) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] shadow-lg">
      {label && <div className="mb-1 font-medium">{label}</div>}
      <div className="grid gap-1">
        {payload.map((item, index) => {
          const chave = String(item.dataKey ?? item.name ?? index);
          const itemConfig = config[chave];
          return (
            <div key={chave} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
              <span className="text-muted">{itemConfig?.label ?? chave}</span>
              <span className="ml-auto font-mono font-medium">
                {formatter && item.value !== undefined ? formatter(item.value) : item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

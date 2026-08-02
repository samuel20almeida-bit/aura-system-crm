import { PageBody } from "@/components/layout/PageBody";
import { Kpi, ProgressBar, Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { TimerBanner } from "@/components/horas/TimerBanner";
import { HorasActions } from "@/components/horas/HorasClient";
import { getHorasPageData, getRunningTimer } from "@/lib/data/time";
import { listClientsLite } from "@/lib/data/tasks";
import { requireProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";
import { monthStartInAppTz, yearMonthInAppTz } from "@/lib/timezone";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default async function HorasPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const { profile } = await requireProfile();

  let year: number;
  let monthIdx: number;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    year = y;
    monthIdx = m - 1;
  } else {
    ({ year, month0: monthIdx } = yearMonthInAppTz());
  }
  const monthStart = monthStartInAppTz(year, monthIdx);
  const monthEnd = monthStartInAppTz(year, monthIdx + 1);
  const prevMonth = monthStartInAppTz(year, monthIdx - 1);
  const nextMonth = monthStartInAppTz(year, monthIdx + 1);
  const monthKeyOf = (y: number, m0: number) => `${y}-${String(m0 + 1).padStart(2, "0")}`;
  const monthKey = (d: Date) => {
    const { year, month0 } = yearMonthInAppTz(d);
    return monthKeyOf(year, month0);
  };

  const [{ entries, profiles, clients, tasks, invoices }, running, clientsLite, supabase] = await Promise.all([
    getHorasPageData(monthStart, monthEnd),
    getRunningTimer(profile.id),
    listClientsLite(),
    createClient(),
  ]);

  const tasksLite = (await supabase.from("tasks").select("id, title, client_id")).data ?? [];

  const totalMinutes = entries.reduce((s, e) => s + (e.minutes ?? 0), 0);
  const billableMinutes = entries.reduce((s, e) => s + (e.billable ? e.minutes ?? 0 : 0), 0);
  const totalRevenue = invoices.reduce((s, i) => s + Number(i.amount), 0);
  const totalHours = totalMinutes / 60;
  const valorHora = totalHours > 0 ? totalRevenue / totalHours : 0;
  const uniquePeople = new Set(entries.map((e) => e.user_id)).size;

  const byClient = new Map<string, { name: string; color: string; minutes: number; budget: number; revenue: number }>();
  byClient.set("internal", { name: "Interno", color: "#1E1E1C", minutes: 0, budget: 0, revenue: 0 });
  for (const c of clients) byClient.set(c.id, { name: c.name, color: c.color, minutes: 0, budget: 0, revenue: 0 });
  for (const e of entries) {
    const key = e.client_id ?? "internal";
    const bucket = byClient.get(key) ?? { name: e.client?.name ?? "—", color: e.client?.color ?? "#9A9890", minutes: 0, budget: 0, revenue: 0 };
    bucket.minutes += e.minutes ?? 0;
    byClient.set(key, bucket);
  }
  for (const t of tasks) {
    const key = t.client_id ?? "internal";
    const bucket = byClient.get(key);
    if (bucket) bucket.budget += Number(t.estimated_hours ?? 0);
  }
  for (const inv of invoices) {
    const bucket = byClient.get(inv.client_id);
    if (bucket) bucket.revenue += Number(inv.amount);
  }
  const clientRows = [...byClient.values()].filter((c) => c.minutes > 0).sort((a, b) => b.minutes - a.minutes);

  const byPerson = profiles.map((p) => {
    const minutes = entries.filter((e) => e.user_id === p.id).reduce((s, e) => s + (e.minutes ?? 0), 0);
    const monthlyCapacity = p.weekly_capacity_hours * 4.345;
    return { profile: p, minutes, pct: monthlyCapacity > 0 ? (minutes / 60 / monthlyCapacity) * 100 : 0 };
  });

  const recent = entries.slice(0, 6);

  return (
    <PageBody>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[21px] font-medium">Horas &amp; rentabilidade</h1>
          <div className="mt-0.5 text-[12.5px] text-muted">
            {MONTH_NAMES[monthIdx]} {year} · {Math.round(totalHours)}h registradas por {uniquePeople} {uniquePeople === 1 ? "pessoa" : "pessoas"}
          </div>
        </div>
        <HorasActions
          clients={clientsLite}
          tasks={tasksLite}
          prevMonthHref={`/horas?month=${monthKey(prevMonth)}`}
          nextMonthHref={`/horas?month=${monthKey(nextMonth)}`}
          monthLabel={`${MONTH_NAMES[monthIdx].slice(0, 3)} ${year}`}
          csvHref={`/api/horas/export?month=${monthKey(monthStart)}`}
        />
      </div>

      {running && (
        <TimerBanner
          startedAt={running.started_at}
          label={`${running.task?.title ?? "Sem tarefa"} · ${running.client?.name ?? "Interno"} · ${profile.full_name}`}
        />
      )}

      <div className="grid grid-cols-4 gap-3">
        <Kpi label="HORAS NO MÊS" value={`${totalHours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`} />
        <Kpi
          label="FATURÁVEIS"
          value={`${(billableMinutes / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`}
          sub={totalMinutes > 0 ? `${Math.round((billableMinutes / totalMinutes) * 100)}%` : "—"}
        >
          {totalMinutes > 0 && <ProgressBar percent={(billableMinutes / totalMinutes) * 100} />}
        </Kpi>
        <Kpi label="VALOR/HORA MÉDIO" value={valorHora > 0 ? formatCurrency(Math.round(valorHora)) : "—"} />
        <Kpi label="RECEITA FATURADA" value={formatCurrency(totalRevenue)} />
      </div>

      <div className="grid flex-1 grid-cols-[1.75fr_1fr] gap-3.5 overflow-hidden">
        <Card className="flex flex-col gap-2 overflow-hidden p-4">
          <div className="flex items-center gap-2">
            <span className="label">POR CLIENTE</span>
          </div>
          <div className="grid grid-cols-[1.3fr_.7fr_.7fr_.9fr_1.1fr] gap-2 border-b border-border pb-2 font-mono text-[9.5px] font-semibold tracking-wide text-faint">
            <div>CLIENTE</div>
            <div>HORAS</div>
            <div>ORÇADO</div>
            <div>RECEITA</div>
            <div>CONSUMO</div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {clientRows.map((c) => (
              <div key={c.name} className="grid grid-cols-[1.3fr_.7fr_.7fr_.9fr_1.1fr] items-center gap-2 border-b border-border-soft py-2.5 text-[13px]">
                <div className="flex items-center gap-2 truncate">
                  <span className="h-2 w-2 flex-none rounded-sm" style={{ background: c.color }} />
                  {c.name}
                </div>
                <div className="font-mono">{(c.minutes / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h</div>
                <div className="font-mono text-muted">{c.budget > 0 ? `${c.budget}h` : "—"}</div>
                <div>{c.revenue > 0 ? formatCurrency(c.revenue) : "—"}</div>
                <ProgressBar percent={c.budget > 0 ? (c.minutes / 60 / c.budget) * 100 : 0} danger={c.budget > 0 && c.minutes / 60 > c.budget} />
              </div>
            ))}
            {clientRows.length === 0 && (
              <div className="py-8 text-center text-[13px] text-faint">Nenhum registro de horas neste mês.</div>
            )}
          </div>
        </Card>

        <div className="flex min-h-0 flex-col gap-3.5">
          <Card className="flex flex-col gap-3 p-4">
            <span className="label">POR PESSOA</span>
            <div className="flex flex-col gap-2.5">
              {byPerson.map(({ profile: p, minutes, pct }) => (
                <div key={p.id}>
                  <div className="flex items-center gap-2 text-[13px]">
                    <Avatar initials={p.initials} size="sm" />
                    {p.full_name.split(" ")[0]}
                    <span className={`ml-auto font-mono text-[12px] ${pct > 100 ? "text-red" : "text-muted"}`}>
                      {(minutes / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h · {Math.round(pct)}%
                    </span>
                  </div>
                  <ProgressBar percent={pct} danger={pct > 100} className="mt-1.5" />
                </div>
              ))}
            </div>
          </Card>
          <Card className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-4">
            <span className="label">ÚLTIMOS REGISTROS</span>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {recent.map((e) => (
                <div key={e.id} className="flex items-center justify-between border-b border-border-soft py-2 text-[12.5px]">
                  <span className="truncate">
                    {e.task?.title ?? e.client?.name ?? "Interno"} · {e.user?.initials}
                  </span>
                  <span className="font-mono text-muted">
                    {((e.minutes ?? 0) / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h
                  </span>
                </div>
              ))}
              {recent.length === 0 && <div className="py-4 text-center text-[12.5px] text-faint">Sem registros.</div>}
            </div>
          </Card>
        </div>
      </div>
    </PageBody>
  );
}

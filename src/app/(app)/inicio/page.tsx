import Link from "next/link";
import { PageBody } from "@/components/layout/PageBody";
import { Kpi, Card, ProgressBar } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { TaskQuickItem } from "@/components/inicio/TaskQuickItem";
import { InicioActions } from "@/components/inicio/InicioActions";
import { requireProfile } from "@/lib/data/profile";
import { getDashboardData } from "@/lib/data/dashboard";
import { listClientsLite } from "@/lib/data/tasks";
import { listProfiles } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, formatRelative } from "@/lib/format";

function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function greeting(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function InicioPage() {
  const { profile } = await requireProfile();
  const now = new Date();

  const [data, clients, profiles, supabase] = await Promise.all([
    getDashboardData(profile.id),
    listClientsLite(),
    listProfiles(),
    createClient(),
  ]);
  const tasksLite = (await supabase.from("tasks").select("id, title, client_id")).data ?? [];

  const dateLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(now);
  const dateLabelCap = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  const monthlyGoal = data.revenueGoal ? Number(data.revenueGoal.target) / 3 : null;
  const goalPct = monthlyGoal ? (data.monthRevenue / monthlyGoal) * 100 : null;

  const needsAttention = [
    ...data.overdueInvoices.slice(0, 2).map((inv) => ({
      key: `inv-${inv.id}`,
      color: "#C4574A",
      title: `${inv.client?.name ?? "Cliente"} · fatura vencida`,
      sub: `${formatCurrency(Number(inv.amount))} · venc. ${formatDate(inv.due_date)}`,
      href: `/crm/${inv.client_id}`,
      action: "Ver fatura →",
    })),
    ...data.endingContracts.slice(0, 2).map((c) => ({
      key: `ct-${c.id}`,
      color: "#D8B24A",
      title: `Contrato ${c.client?.name ?? ""} vence em breve`,
      sub: `${c.value ? formatCurrency(Number(c.value)) + " · " : ""}até ${formatDate(c.end_date!)}`,
      href: `/crm/${c.client_id}`,
      action: "Ver cliente →",
    })),
  ];

  return (
    <PageBody>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[21px] font-medium">{greeting(now.getHours())}, {profile.full_name.split(" ")[0]}</h1>
          <div className="mt-0.5 text-[12.5px] text-muted">
            {dateLabelCap} · Semana {isoWeek(now)}
            {data.openTasksThisWeek > 0 && (
              <> · <span className="accent-italic">{data.openTasksThisWeek} entregas até sexta</span></>
            )}
          </div>
        </div>
        <InicioActions clients={clients} profiles={profiles} tasks={tasksLite} />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Kpi label="FATURAMENTO DO MÊS" value={formatCurrency(data.monthRevenue)}>
          {goalPct !== null && (
            <>
              <ProgressBar percent={goalPct} className="mt-0.5" />
              <span className="font-mono text-[11px] text-muted">{Math.round(goalPct)}% da meta do mês</span>
            </>
          )}
        </Kpi>
        <Kpi label="MINHAS TAREFAS" value={data.myTasksToday + data.myTasksWeek}>
          <div className="flex gap-1.5">
            {data.myTasksToday > 0 && <span className="rounded-full bg-red-tint px-2 py-0.5 text-[11px] text-red">{data.myTasksToday} hoje</span>}
            {data.myTasksWeek > 0 && <span className="rounded-full bg-neutral-tint px-2 py-0.5 text-[11px] text-muted">{data.myTasksWeek} na semana</span>}
            {data.myTasksToday === 0 && data.myTasksWeek === 0 && <span className="font-mono text-[11px] text-faint">tudo em dia</span>}
          </div>
        </Kpi>
        <Kpi
          label="HORAS DA SEMANA"
          value={<>{data.myWeekHours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h <span className="text-[13px] font-normal text-muted">/ {profile.weekly_capacity_hours}h</span></>}
        >
          <ProgressBar percent={(data.myWeekHours / profile.weekly_capacity_hours) * 100} className="mt-0.5" />
          <span className="font-mono text-[11px] text-muted">{Math.round(data.myWeekBillablePct)}% faturáveis</span>
        </Kpi>
        <Kpi
          label="A COBRAR"
          value={formatCurrency(data.overdueAmount)}
          valueClassName={data.overdueInvoices.length > 0 ? "text-red" : undefined}
          labelClassName={data.overdueInvoices.length > 0 ? "text-red" : undefined}
          sub={data.overdueInvoices.length > 0 ? `${data.overdueInvoices.length} faturas atrasadas` : "tudo em dia"}
        />
      </div>

      <div className="grid flex-1 grid-cols-[1.55fr_1fr] gap-4 overflow-hidden">
        <Card className="flex flex-col gap-2.5 overflow-hidden p-4">
          <div className="flex items-center justify-between">
            <span className="label">MINHAS TAREFAS DE HOJE</span>
            <Link href="/kanban" className="font-mono text-[11px] text-muted hover:text-ink">ver todas →</Link>
          </div>
          <div>
            {data.myTasks.map((t) => (
              <TaskQuickItem key={t.id} task={t} />
            ))}
            {data.myTasks.length === 0 && <div className="py-3 text-center text-[12.5px] text-faint">Nenhuma tarefa pendente atribuída a você.</div>}
          </div>

          <div className="mt-1 flex items-center justify-between">
            <span className="label">CAPACIDADE DA EQUIPE</span>
            <span className="font-mono text-[11px] text-muted">semana {isoWeek(now)}</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {data.capacity.map(({ profile: p, hours, target }) => (
              <div key={p.id} className="grid grid-cols-[26px_76px_1fr_46px] items-center gap-2.5 text-[13px]">
                <Avatar initials={p.initials} size="sm" />
                <span className="truncate">{p.full_name.split(" ")[0]}</span>
                <ProgressBar percent={(hours / target) * 100} danger={hours > target} />
                <span className={`font-mono ${hours > target ? "text-red" : ""}`}>{hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex min-h-0 flex-col gap-3">
          <Card className="flex flex-col gap-2.5 p-4">
            <span className="label">PRECISA DE VOCÊ</span>
            {needsAttention.map((item) => (
              <Link key={item.key} href={item.href} className="flex items-start gap-2.5 hover:opacity-80">
                <span className="w-[3px] self-stretch rounded" style={{ background: item.color }} />
                <div>
                  <div className="text-[13px] font-medium">{item.title}</div>
                  <div className="font-mono text-[11px] text-muted">{item.sub}</div>
                  <div className="mt-1 font-mono text-[11px] text-accent">{item.action}</div>
                </div>
              </Link>
            ))}
            {needsAttention.length === 0 && <div className="text-[12.5px] text-faint">Tudo em dia por aqui.</div>}
          </Card>
          <Card className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden p-4">
            <span className="label">ATIVIDADE RECENTE</span>
            <div className="flex flex-col gap-2.5 overflow-y-auto scrollbar-thin text-[12.5px]">
              {data.activity.map((a) => (
                <div key={a.id} className="flex gap-2.5">
                  <Avatar initials={a.user?.initials} size="sm" ghost />
                  <div>
                    <span>
                      {a.user_id === profile.id ? "Você" : a.user?.full_name ?? "Alguém"} {a.verb} {a.detail && <b className="font-medium">{a.detail}</b>}
                    </span>
                    <div className="mt-0.5 font-mono text-[11px] text-faint">{formatRelative(a.created_at)}</div>
                  </div>
                </div>
              ))}
              {data.activity.length === 0 && <div className="text-faint">Nenhuma atividade ainda.</div>}
            </div>
          </Card>
        </div>
      </div>
    </PageBody>
  );
}

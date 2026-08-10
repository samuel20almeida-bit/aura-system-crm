import Link from "next/link";
import { PageBody } from "@/components/layout/PageBody";
import { Kpi, Card, ProgressBar } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { TaskQuickItem } from "@/components/inicio/TaskQuickItem";
import { InicioActions } from "@/components/inicio/InicioActions";
import { LiveActivity, type LiveActivityItem } from "@/components/inicio/LiveActivity";
import { CountUp } from "@/components/ui/CountUp";
import { Unavailable } from "@/components/ui/Unavailable";
import { requireProfile } from "@/lib/data/profile";
import { getDashboardData } from "@/lib/data/dashboard";
import { getNotifications } from "@/lib/data/notifications";
import { getRecentActivity } from "@/lib/data/activity";
import { listClientsLite } from "@/lib/data/tasks";
import { listProfiles } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { ALL_CLEAR, TONE_BG } from "@/lib/notifications";
import { describeActivity } from "@/lib/activity-feed";
import { APP_TIMEZONE, currentHourInAppTz, isoWeekInAppTz } from "@/lib/timezone";

function greeting(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function InicioPage() {
  const { profile } = await requireProfile();
  const now = new Date();

  const [data, notifications, activityRows, clients, profiles, supabase] = await Promise.all([
    getDashboardData(profile.id),
    getNotifications(profile.id),
    getRecentActivity(),
    listClientsLite(),
    listProfiles(),
    createClient(),
  ]);
  const tasksLite = (await supabase.from("tasks").select("id, title, client_id")).data ?? [];

  // Descrito aqui, no servidor, com o relógio do servidor — não dentro do
  // componente cliente. É o que garante que o primeiro quadro do cliente
  // mostre exatamente o mesmo "há N min" que já foi enviado no HTML.
  const activityItems: LiveActivityItem[] | null =
    activityRows === null
      ? null
      : activityRows.map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          initials: row.user?.initials ?? null,
          ...describeActivity(row, profile.id, now),
        }));

  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: APP_TIMEZONE,
  }).format(now);
  const dateLabelCap = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  const monthlyGoal = data.revenueGoal ? Number(data.revenueGoal.target) / 3 : null;
  const goalPct = monthlyGoal && data.monthRevenue !== null ? (data.monthRevenue / monthlyGoal) * 100 : null;
  // Um número que não pôde ser lido aparece como "—". Zero é uma afirmação.
  const DASH = "—";

  // O card mostra os primeiros; o resto continua no sino, contado em voz alta.
  const NEEDS_YOU_LIMIT = 4;
  const needsYou = notifications.slice(0, NEEDS_YOU_LIMIT);
  const needsYouRest = notifications.length - needsYou.length;

  return (
    <PageBody>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-[21px] font-medium">{greeting(currentHourInAppTz(now))}, {profile.full_name.split(" ")[0]}</h1>
          <div className="mt-0.5 text-[12.5px] text-muted">
            {dateLabelCap} · Semana {isoWeekInAppTz(now)}
            {data.openTasksThisWeek !== null && data.openTasksThisWeek > 0 && (
              <> · <span className="accent-italic">{data.openTasksThisWeek} entregas até sexta</span></>
            )}
          </div>
        </div>
        <InicioActions clients={clients} profiles={profiles} tasks={tasksLite} />
      </div>

      {data.unavailable && <Unavailable title="Alguns números não puderam ser carregados" />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="FATURAMENTO DO MÊS"
          value={data.monthRevenue === null ? DASH : <CountUp value={data.monthRevenue} format="currency" />}
        >
          {goalPct !== null && (
            <>
              <ProgressBar percent={goalPct} className="mt-0.5" />
              <span className="font-mono text-[11px] text-muted">{Math.round(goalPct)}% da meta do mês</span>
            </>
          )}
        </Kpi>
        <Kpi
          label="MINHAS TAREFAS"
          value={data.myTasksToday === null || data.myTasksWeek === null ? DASH : data.myTasksToday + data.myTasksWeek}
        >
          {data.myTasksToday !== null && data.myTasksWeek !== null && (
            <div className="flex gap-1.5">
              {data.myTasksToday > 0 && <span className="rounded-full bg-red-tint px-2 py-0.5 text-[11px] text-red">{data.myTasksToday} hoje</span>}
              {data.myTasksWeek > 0 && <span className="rounded-full bg-neutral-tint px-2 py-0.5 text-[11px] text-muted">{data.myTasksWeek} na semana</span>}
              {data.myTasksToday === 0 && data.myTasksWeek === 0 && <span className="font-mono text-[11px] text-faint">tudo em dia</span>}
            </div>
          )}
        </Kpi>
        <Kpi
          label="HORAS DA SEMANA"
          value={
            data.myWeekHours === null ? (
              DASH
            ) : (
              <>{data.myWeekHours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h <span className="text-[13px] font-normal text-muted">/ {profile.weekly_capacity_hours}h</span></>
            )
          }
        >
          {data.myWeekHours !== null && data.myWeekBillablePct !== null && (
            <>
              <ProgressBar percent={(data.myWeekHours / profile.weekly_capacity_hours) * 100} className="mt-0.5" />
              <span className="font-mono text-[11px] text-muted">{Math.round(data.myWeekBillablePct)}% faturáveis</span>
            </>
          )}
        </Kpi>
        <Kpi
          label="A COBRAR"
          value={data.overdueAmount === null ? DASH : <CountUp value={data.overdueAmount} format="currency" />}
          valueClassName={data.overdueInvoices && data.overdueInvoices.length > 0 ? "text-red" : undefined}
          labelClassName={data.overdueInvoices && data.overdueInvoices.length > 0 ? "text-red" : undefined}
          sub={
            data.overdueInvoices === null
              ? undefined
              : data.overdueInvoices.length > 0
                ? `${data.overdueInvoices.length} faturas atrasadas`
                : "tudo em dia"
          }
        />
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-[1.55fr_1fr]">
        <Card className="flex flex-col gap-2.5 overflow-hidden p-4">
          <div className="flex items-center justify-between">
            <span className="label">MINHAS TAREFAS DE HOJE</span>
            <Link href="/kanban" className="font-mono text-[11px] text-muted hover:text-ink">ver todas →</Link>
          </div>
          <div>
            {data.myTasks === null ? (
              <div className="py-3 text-center text-[12.5px] text-faint">Não foi possível carregar suas tarefas.</div>
            ) : (
              <>
                {data.myTasks.map((t) => (
                  <TaskQuickItem key={t.id} task={t} />
                ))}
                {data.myTasks.length === 0 && <div className="py-3 text-center text-[12.5px] text-faint">Nenhuma tarefa pendente atribuída a você.</div>}
              </>
            )}
          </div>

          <div className="mt-1 flex items-center justify-between">
            <span className="label">CAPACIDADE DA EQUIPE</span>
            <span className="font-mono text-[11px] text-muted">semana {isoWeekInAppTz(now)}</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {data.capacity === null && (
              <div className="text-[12.5px] text-faint">Não foi possível carregar a capacidade da equipe.</div>
            )}
            {(data.capacity ?? []).map(({ profile: p, hours, target }) => (
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
          {/* Mesma fonte do sino (buildNotifications), duas apresentações. Antes
              eram duas listas com o mesmo título e a mesma frase de vazio: o
              card cobria 2 categorias, o sino 5, e o card cortava em 2 sem
              avisar — dava para ler "Tudo em dia por aqui." com seis tarefas
              atrasadas no sino, logo acima. */}
          <Card className="flex flex-col gap-2.5 p-4">
            <span className="label">PRECISA DE VOCÊ</span>
            {needsYou.length === 0 && <div className="text-[12.5px] text-faint">{ALL_CLEAR}</div>}
            {needsYou.map((n) => {
              const body = (
                <>
                  <span className={"w-[3px] flex-none self-stretch rounded " + TONE_BG[n.tone]} />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{n.title}</div>
                    <div className="font-mono text-[11px] text-muted">{n.detail}</div>
                  </div>
                </>
              );
              return n.href ? (
                <Link key={n.id} href={n.href} className="flex items-start gap-2.5 hover:opacity-80">
                  {body}
                </Link>
              ) : (
                <div key={n.id} className="flex items-start gap-2.5">
                  {body}
                </div>
              );
            })}
            {needsYouRest > 0 && (
              <span className="font-mono text-[11px] text-faint">
                +{needsYouRest} {needsYouRest === 1 ? "outro aviso" : "outros avisos"} no sino
              </span>
            )}
          </Card>
          {activityItems === null ? (
            <Unavailable title="Não foi possível carregar a atividade recente" className="flex-1" />
          ) : (
            <LiveActivity items={activityItems} />
          )}
        </div>
      </div>
    </PageBody>
  );
}

import { PageBody, PageHeader } from "@/components/layout/PageBody";
import { EmptyState } from "@/components/ui/EmptyState";
import { AreaCard } from "@/components/metas/MetasClient";
import { MetasHeaderActions } from "@/components/metas/MetasHeaderActions";
import { currentQuarter, listGoals, quarterRange } from "@/lib/data/goals";
import { listProfiles } from "@/lib/data/profile";
import { todayInAppTz } from "@/lib/timezone";

export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<{ quarter?: string }>;
}) {
  const { quarter: quarterParam } = await searchParams;
  const year = Number(todayInAppTz().slice(0, 4));
  const quarter = quarterParam ?? currentQuarter();

  const [goals, profiles] = await Promise.all([listGoals(quarter), listProfiles()]);

  const { end } = quarterRange(quarter);
  // eslint-disable-next-line react-hooks/purity -- server component: current time is intentional per-request state
  const nowMs = Date.now();
  const weeksRemaining = Math.max(0, Math.ceil((end.getTime() - nowMs) / (7 * 86400000)));
  const onTrackCount = goals.filter((g) => g.target > 0 && g.current / g.target >= 0.7).length;

  const byArea = new Map<string, typeof goals>();
  for (const g of goals) {
    const list = byArea.get(g.area) ?? [];
    list.push(g);
    byArea.set(g.area, list);
  }
  const areaNames = [...byArea.keys()];

  const quarters = [1, 2, 3, 4].map((q) => ({
    key: `${year}-Q${q}`,
    label: `Q${q}`,
    href: `/metas?quarter=${year}-Q${q}`,
  }));

  return (
    <PageBody>
      {/* Esta era a única tela do app que desenhava o próprio cabeçalho em vez
          de usar `PageHeader` — daí o `text-[21px]` cru, que é o valor do
          `text-display`, e a linha de apoio a 12,5px contra os 12px das outras
          sete. Sem componente comum, mudar o ritmo do cabeçalho exigia lembrar
          desta exceção. */}
      <PageHeader
        title="Metas da empresa"
        sub={
          <>
            {quarter} · {weeksRemaining} semanas restantes
            {goals.length > 0 && (
              <> · <span className="accent-italic">{onTrackCount} de {goals.length} no caminho</span></>
            )}
          </>
        }
        actions={
          <MetasHeaderActions quarter={quarter} quarters={quarters} profiles={profiles} areas={areaNames} />
        }
      />

      <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto scrollbar-thin">
        {areaNames.map((area) => (
          <AreaCard key={area} area={area} goals={byArea.get(area)!} />
        ))}
        {areaNames.length === 0 && (
          <EmptyState
            className="col-span-2"
            title={`Nenhuma meta cadastrada para ${quarter} ainda.`}
            sub={'Clique em "+ Nova meta" para começar.'}
          />
        )}
      </div>
    </PageBody>
  );
}

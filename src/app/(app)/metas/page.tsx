import { PageBody } from "@/components/layout/PageBody";
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[21px] font-medium">Metas da empresa</h1>
          <div className="mt-0.5 text-[12.5px] text-muted">
            {quarter} · {weeksRemaining} semanas restantes
            {goals.length > 0 && (
              <> · <span className="accent-italic">{onTrackCount} de {goals.length} no caminho</span></>
            )}
          </div>
        </div>
        <MetasHeaderActions quarter={quarter} quarters={quarters} profiles={profiles} areas={areaNames} />
      </div>

      <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto scrollbar-thin">
        {areaNames.map((area) => (
          <AreaCard key={area} area={area} goals={byArea.get(area)!} />
        ))}
        {areaNames.length === 0 && (
          <div className="col-span-2 flex flex-1 items-center justify-center rounded-xl border border-dashed border-border p-10 text-center text-[13px] text-faint">
            Nenhuma meta cadastrada para {quarter} ainda. Clique em &quot;+ Nova meta&quot; para começar.
          </div>
        )}
      </div>
    </PageBody>
  );
}

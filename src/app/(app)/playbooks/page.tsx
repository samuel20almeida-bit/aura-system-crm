import { listCategoriesWithCounts, listPlaybooksInCategory, getPlaybookDetail } from "@/lib/data/playbooks";
import { listClientsLite } from "@/lib/data/tasks";
import { PlaybooksBody } from "@/components/playbooks/PlaybooksClient";

export default async function PlaybooksPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; playbook?: string }>;
}) {
  const { category, playbook } = await searchParams;
  const categories = await listCategoriesWithCounts();
  const activeCategoryId = category ?? categories[0]?.id ?? null;

  const [playbooks, clients] = await Promise.all([
    activeCategoryId ? listPlaybooksInCategory(activeCategoryId) : Promise.resolve([]),
    listClientsLite(),
  ]);

  const detail = playbook ? await getPlaybookDetail(playbook) : null;

  return (
    <PlaybooksBody
      categories={categories}
      activeCategoryId={activeCategoryId}
      playbooks={playbooks}
      activePlaybookId={playbook ?? null}
      detail={detail}
      clients={clients}
    />
  );
}

import { listCategoriesWithCounts, listAllPlaybooks, getPlaybookDetail } from "@/lib/data/playbooks";
import { listClientsLite } from "@/lib/data/tasks";
import { PlaybooksBody } from "@/components/playbooks/PlaybooksClient";

export default async function PlaybooksPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; playbook?: string }>;
}) {
  const { category, playbook } = await searchParams;
  const [categories, allPlaybooks, clients] = await Promise.all([
    listCategoriesWithCounts(),
    listAllPlaybooks(),
    listClientsLite(),
  ]);
  const activeCategoryId = category ?? categories[0]?.id ?? null;
  const playbooks = activeCategoryId ? allPlaybooks.filter((p) => p.category_id === activeCategoryId) : [];
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

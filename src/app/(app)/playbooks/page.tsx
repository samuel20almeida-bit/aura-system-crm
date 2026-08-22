import { listCategoriesWithCounts, listAllPlaybooks, getPlaybookDetail } from "@/lib/data/playbooks";
import { listContasLite } from "@/lib/data/tasks";
import { PlaybooksBody } from "@/components/playbooks/PlaybooksClient";

export default async function PlaybooksPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; playbook?: string }>;
}) {
  const { category, playbook } = await searchParams;
  const [categories, allPlaybooks, contasResult] = await Promise.all([
    listCategoriesWithCounts(),
    listAllPlaybooks(),
    listContasLite(),
  ]);
  // Mesmo motivo do Kanban (Task 4): `contasResult.ok === false` é falha de
  // leitura, não "zero contas". Rodar um playbook como interno não depende
  // de conta nenhuma, então a tela não pode cair inteira por isso — vira
  // lista vazia + flag para o seletor do modal de execução mostrar o
  // estado de indisponível em vez de mentir "sem contas cadastradas".
  const contas = contasResult.ok ? contasResult.contas : [];
  const contasIndisponiveis = !contasResult.ok;
  const activeCategoryId = category ?? categories[0]?.id ?? null;
  const detail = playbook ? await getPlaybookDetail(playbook) : null;

  return (
    <PlaybooksBody
      categories={categories}
      activeCategoryId={activeCategoryId}
      allPlaybooks={allPlaybooks}
      activePlaybookId={playbook ?? null}
      detail={detail}
      contas={contas}
      contasIndisponiveis={contasIndisponiveis}
    />
  );
}

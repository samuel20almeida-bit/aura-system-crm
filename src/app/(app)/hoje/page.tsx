import { PageBody } from "@/components/layout/PageBody";
import { HojeClient } from "@/components/hoje/HojeClient";
import { getItensHoje } from "@/lib/data/hoje";
import { listProfiles } from "@/lib/data/profile";

/**
 * O filtro por dono é URL, não estado de cliente — mesmo padrão de
 * `/metas` (`searchParams.quarter`), não o do Kanban (que usa `searchParams`
 * só para saber qual painel abrir via navegação client-side).
 *
 * Ainda não está no menu lateral: a navegação é a Task 6 desta fase, mesma
 * regra que já valeu para o Pipeline (Task 4).
 */
export default async function HojePage({
  searchParams,
}: {
  searchParams: Promise<{ dono?: string }>;
}) {
  const { dono } = await searchParams;
  const [dados, profiles] = await Promise.all([getItensHoje(dono), listProfiles()]);

  const donoOptions = [
    { key: "", label: "Todos", href: "/hoje" },
    ...profiles.map((p) => ({
      key: p.id,
      label: p.full_name.split(" ")[0],
      href: `/hoje?dono=${p.id}`,
    })),
  ];

  if (dados.unavailable) {
    return (
      <PageBody>
        <HojeClient
          negocios={[]}
          tarefas={[]}
          profiles={profiles}
          donoOptions={donoOptions}
          donoAtual={dono ?? ""}
          unavailable
        />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <HojeClient
        negocios={dados.negocios}
        tarefas={dados.tarefas}
        profiles={profiles}
        donoOptions={donoOptions}
        donoAtual={dono ?? ""}
      />
    </PageBody>
  );
}

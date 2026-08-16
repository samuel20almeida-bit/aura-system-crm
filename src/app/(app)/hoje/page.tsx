import { PageBody } from "@/components/layout/PageBody";
import { HojeClient } from "@/components/hoje/HojeClient";
import type { LiveActivityItem } from "@/components/hoje/LiveActivity";
import { getItensHoje } from "@/lib/data/hoje";
import { requireProfile, listProfiles } from "@/lib/data/profile";
import { getRecentActivity } from "@/lib/data/activity";
import { describeActivity } from "@/lib/activity-feed";

/**
 * O filtro por dono é URL, não estado de cliente — mesmo padrão de
 * `/metas` (`searchParams.quarter`), não o do Kanban (que usa `searchParams`
 * só para saber qual painel abrir via navegação client-side).
 *
 * Está no menu lateral desde a Task 6 da Fase 3A, que também trouxe o
 * `LiveActivity` para cá — ver o comentário na montagem, abaixo.
 */
export default async function HojePage({
  searchParams,
}: {
  searchParams: Promise<{ dono?: string }>;
}) {
  const { dono } = await searchParams;
  const { profile } = await requireProfile();
  const now = new Date();
  const [dados, profiles, activityRows] = await Promise.all([
    getItensHoje(dono),
    listProfiles(),
    getRecentActivity(),
  ]);

  // Mesmo padrão que a antiga /início usava: descrito aqui, no servidor, com
  // o relógio do servidor — não dentro do componente cliente. É o que garante
  // que o primeiro quadro do cliente mostre exatamente o mesmo "há N min" que
  // já foi enviado no HTML.
  const activityItems: LiveActivityItem[] | null =
    activityRows === null
      ? null
      : activityRows.map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          initials: row.user?.initials ?? null,
          ...describeActivity(row, profile.id, now),
        }));

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
          activityItems={activityItems}
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
        activityItems={activityItems}
      />
    </PageBody>
  );
}

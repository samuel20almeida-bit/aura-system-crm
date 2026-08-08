"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { NewTaskModal } from "@/components/kanban/NewTaskModal";
import { LogTimeModal } from "@/components/horas/TimeModals";
import type { Tables } from "@/lib/supabase/database.types";

type ClientLite = { id: string; name: string; color: string; code_prefix: string };

export function InicioActions({
  clients,
  profiles,
  tasks,
}: {
  clients: ClientLite[];
  profiles: Tables<"profiles">[];
  tasks: { id: string; title: string; client_id: string | null }[];
}) {
  const [modal, setModal] = useState<"task" | "hours" | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" onClick={() => setModal("hours")}>Registrar horas</Button>
      <Button onClick={() => setModal("task")}>+ Nova tarefa</Button>
      {modal === "task" && <NewTaskModal clients={clients} profiles={profiles} onClose={() => setModal(null)} />}
      {modal === "hours" && (
        <LogTimeModal
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          tasks={tasks}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

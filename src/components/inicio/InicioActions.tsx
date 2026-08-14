"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { NewTaskModal } from "@/components/kanban/NewTaskModal";
import type { Tables } from "@/lib/supabase/database.types";

type ClientLite = { id: string; name: string; color: string; code_prefix: string };

export function InicioActions({
  clients,
  profiles,
}: {
  clients: ClientLite[];
  profiles: Tables<"profiles">[];
}) {
  const [showNewTask, setShowNewTask] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => setShowNewTask(true)}>+ Nova tarefa</Button>
      {showNewTask && <NewTaskModal clients={clients} profiles={profiles} onClose={() => setShowNewTask(false)} />}
    </div>
  );
}

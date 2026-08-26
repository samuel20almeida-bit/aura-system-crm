"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { NewGoalModal } from "./MetasClient";

export function MetasHeaderActions({
  quarter,
  quarters,
  profiles,
  areas,
}: {
  quarter: string;
  quarters: { key: string; label: string; href: string }[];
  profiles: { id: string; full_name: string }[];
  areas: string[];
}) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <SegmentedControl
        rotuloAcessivel="Trimestre"
        valor={quarter}
        opcoes={quarters.map((q) => ({ valor: q.key, rotulo: q.label, href: q.href }))}
      />
      <Button onClick={() => setShowModal(true)}>+ Nova meta</Button>
      {showModal && (
        <NewGoalModal quarter={quarter} profiles={profiles} areas={areas.length ? areas : ["Geral"]} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}

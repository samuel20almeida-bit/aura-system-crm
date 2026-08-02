"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
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
      <div className="flex overflow-hidden rounded-lg border border-border bg-surface text-[12px] font-medium">
        {quarters.map((q) => (
          <Link
            key={q.key}
            href={q.href}
            className={`border-r border-border px-3.25 py-1.75 last:border-r-0 ${q.key === quarter ? "bg-ink text-bone" : "text-muted"}`}
          >
            {q.label}
          </Link>
        ))}
      </div>
      <Button onClick={() => setShowModal(true)}>+ Nova meta</Button>
      {showModal && (
        <NewGoalModal quarter={quarter} profiles={profiles} areas={areas.length ? areas : ["Geral"]} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}

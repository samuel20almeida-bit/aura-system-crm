"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/layout/PageBody";
import { useToast } from "@/components/ui/Toast";
import { deleteCredential } from "@/lib/actions/credenciais";
import { beginMutation } from "@/lib/realtime/mutation-gate";
import { CredentialModal } from "./CredentialModal";
import type { CredentialWithRelations } from "@/lib/data/credenciais";

type CategoriaLite = { id: string; nome: string };
type ClientLite = { id: string; name: string; color: string; code_prefix: string };

function CredentialCard({
  credential,
  onEdit,
}: {
  credential: CredentialWithRelations;
  onEdit: () => void;
}) {
  const { notify } = useToast();
  const [revelado, setRevelado] = useState(false);
  const [pending, startTransition] = useTransition();

  function excluir() {
    if (!confirm("Excluir credencial?")) return;
    startTransition(async () => {
      const end = beginMutation();
      try {
        await deleteCredential(credential.id);
      } catch {
        notify("error", "Não foi possível excluir a credencial. Tente novamente.");
      } finally {
        end();
      }
    });
  }

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[14px] font-medium">{credential.nome}</span>
        <Tag tone="neutral">{credential.categoria?.nome ?? "—"}</Tag>
      </div>
      <div className="text-[12px] text-muted">
        {credential.cliente ? credential.cliente.name : "Interna"}
      </div>
      {credential.usuario && (
        <div className="text-[13px]">
          <span className="text-faint">usuário: </span>
          {credential.usuario}
        </div>
      )}
      {credential.senha && (
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-faint">senha: </span>
          <span className="font-mono">{revelado ? credential.senha : "••••••••"}</span>
          <button
            type="button"
            onClick={() => setRevelado((r) => !r)}
            className="text-[11px] text-accent hover:underline"
          >
            {revelado ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      )}
      {credential.url && (
        <a
          href={credential.url}
          target="_blank"
          rel="noreferrer"
          className="truncate text-[12px] text-accent hover:underline"
        >
          {credential.url}
        </a>
      )}
      {credential.notas && <div className="text-[12px] text-muted">{credential.notas}</div>}
      <div className="mt-1 flex items-center justify-end gap-3">
        <button type="button" onClick={onEdit} className="font-mono text-[11px] text-faint hover:text-accent">
          editar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={excluir}
          className="font-mono text-[11px] text-faint hover:text-red"
        >
          excluir
        </button>
      </div>
    </Card>
  );
}

export function CredenciaisClient({
  credentials,
  categories,
  clients,
}: {
  credentials: CredentialWithRelations[];
  categories: CategoriaLite[];
  clients: ClientLite[];
}) {
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<CredentialWithRelations | null>(null);

  const filtradas = categoriaFiltro
    ? credentials.filter((c) => c.categoria_id === categoriaFiltro)
    : credentials;

  return (
    <>
      <PageHeader
        title="Credenciais"
        actions={
          <>
            <Select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="w-auto"
            >
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
            <Button
              onClick={() => {
                setEditando(null);
                setModalAberto(true);
              }}
            >
              + Nova credencial
            </Button>
          </>
        }
      />

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto scrollbar-thin md:grid-cols-2 lg:grid-cols-3">
        {filtradas.map((cred) => (
          <CredentialCard
            key={cred.id}
            credential={cred}
            onEdit={() => {
              setEditando(cred);
              setModalAberto(true);
            }}
          />
        ))}
        {filtradas.length === 0 && (
          <div className="col-span-full flex flex-1 items-center justify-center rounded-xl border border-dashed border-border p-10 text-center text-[13px] text-faint">
            {categoriaFiltro ? "Nenhuma credencial nesta categoria." : "Nenhuma credencial cadastrada ainda."}
          </div>
        )}
      </div>

      {modalAberto && (
        <CredentialModal
          credential={editando}
          categories={categories}
          clients={clients}
          onClose={() => setModalAberto(false)}
        />
      )}
    </>
  );
}

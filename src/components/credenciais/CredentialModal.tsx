"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { createCredential, updateCredential, createCredentialCategory } from "@/lib/actions/credenciais";
import { beginMutation } from "@/lib/realtime/mutation-gate";
import type { CredentialWithRelations } from "@/lib/data/credenciais";

type CategoriaLite = { id: string; nome: string };
type ClientLite = { id: string; name: string; color: string; code_prefix: string };

export function CredentialModal({
  credential,
  categories,
  clients,
  onClose,
}: {
  credential: CredentialWithRelations | null;
  categories: CategoriaLite[];
  clients: ClientLite[];
  onClose: () => void;
}) {
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [nome, setNome] = useState(credential?.nome ?? "");
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState(categories);
  const [categoriaId, setCategoriaId] = useState(
    credential?.categoria_id ?? categoriasDisponiveis[0]?.id ?? ""
  );
  const [mostrandoNovaCategoria, setMostrandoNovaCategoria] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [criandoCategoria, startCategoriaTransition] = useTransition();
  const [erroCategoria, setErroCategoria] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState(credential?.cliente_id ?? "");
  const [usuario, setUsuario] = useState(credential?.usuario ?? "");
  const [senha, setSenha] = useState(credential?.senha ?? "");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [url, setUrl] = useState(credential?.url ?? "");
  const [notas, setNotas] = useState(credential?.notas ?? "");

  function handleAddCategoria() {
    if (criandoCategoria || !novaCategoriaNome.trim()) return;
    setErroCategoria(null);
    startCategoriaTransition(async () => {
      const end = beginMutation();
      try {
        const nova = await createCredentialCategory(novaCategoriaNome.trim());
        setCategoriasDisponiveis((atual) =>
          atual.some((c) => c.id === nova.id) ? atual : [...atual, nova]
        );
        setCategoriaId(nova.id);
        setNovaCategoriaNome("");
        setMostrandoNovaCategoria(false);
      } catch {
        setErroCategoria("Não foi possível criar a categoria. Tente de novo.");
      } finally {
        end();
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !categoriaId) return;
    const dados = {
      nome: nome.trim(),
      categoriaId,
      clienteId: clienteId || null,
      usuario: usuario.trim() || null,
      senha: senha.trim() || null,
      url: url.trim() || null,
      notas: notas.trim() || null,
    };
    startTransition(async () => {
      const end = beginMutation();
      try {
        if (credential) {
          await updateCredential(credential.id, dados);
        } else {
          await createCredential(dados);
        }
        onClose();
      } catch {
        notify(
          "error",
          credential
            ? "Não foi possível salvar a credencial. Tente novamente."
            : "Não foi possível criar a credencial. Tente novamente."
        );
      } finally {
        end();
      }
    });
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3.5 p-5.5">
        <h2 className="text-base font-medium">{credential ? "Editar credencial" : "Nova credencial"}</h2>

        <Field label="NOME">
          <Input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Hospedagem do site, Painel do cliente X…"
            required
          />
        </Field>

        <Field label="CATEGORIA">
          {mostrandoNovaCategoria ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={novaCategoriaNome}
                  onChange={(e) => setNovaCategoriaNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCategoria();
                    }
                  }}
                  placeholder="Nome da nova categoria"
                />
                <Button
                  type="button"
                  disabled={criandoCategoria || !novaCategoriaNome.trim()}
                  onClick={handleAddCategoria}
                >
                  {criandoCategoria ? "Adicionando…" : "Adicionar"}
                </Button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMostrandoNovaCategoria(false);
                  setNovaCategoriaNome("");
                  setErroCategoria(null);
                }}
                className="self-start text-[12px] text-faint hover:text-ink"
              >
                Cancelar e voltar à lista
              </button>
              {erroCategoria && <p className="text-[12px] text-red">{erroCategoria}</p>}
            </div>
          ) : (
            <Select
              value={categoriaId}
              onChange={(e) => {
                if (e.target.value === "__nova__") {
                  setMostrandoNovaCategoria(true);
                } else {
                  setCategoriaId(e.target.value);
                }
              }}
            >
              {categoriasDisponiveis.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
              <option value="__nova__">+ Nova categoria…</option>
            </Select>
          )}
        </Field>

        <Field label="CLIENTE VINCULADO">
          <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Nenhum (interna)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="USUÁRIO">
            <Input value={usuario} onChange={(e) => setUsuario(e.target.value)} />
          </Field>
          <Field label="SENHA">
            <div className="flex gap-2">
              <Input
                type={mostrarSenha ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="flex-1"
              />
              <Button type="button" variant="ghost" onClick={() => setMostrarSenha((v) => !v)}>
                {mostrarSenha ? "Ocultar" : "Mostrar"}
              </Button>
            </div>
          </Field>
        </div>

        <Field label="URL">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </Field>

        <Field label="NOTAS">
          <Textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </Field>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || mostrandoNovaCategoria}>
            {pending ? "Salvando…" : credential ? "Salvar" : "Criar credencial"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

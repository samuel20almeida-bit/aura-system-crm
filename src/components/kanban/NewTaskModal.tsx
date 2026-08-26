"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Tag } from "@/components/ui/Tag";
import { createTask, createTaskArea } from "@/lib/actions/tasks";
import { beginMutation } from "@/lib/realtime/mutation-gate";
import type { Tables } from "@/lib/supabase/database.types";

type ContaLite = { id: string; nome: string };
type AreaLite = { id: string; nome: string };

export function NewTaskModal({
  contas,
  contasIndisponiveis,
  profiles,
  areas,
  onClose,
}: {
  contas: ContaLite[];
  contasIndisponiveis: boolean;
  profiles: Tables<"profiles">[];
  areas: AreaLite[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [isInternal, setIsInternal] = useState(contas.length === 0);
  const [contaId, setContaId] = useState(contas[0]?.id ?? "");
  const [areasDisponiveis, setAreasDisponiveis] = useState(areas);
  const [area, setArea] = useState(areasDisponiveis[0]?.nome ?? "");
  const [mostrandoNovaArea, setMostrandoNovaArea] = useState(false);
  const [novaAreaNome, setNovaAreaNome] = useState("");
  const [criandoArea, startAreaTransition] = useTransition();
  const [erroArea, setErroArea] = useState<string | null>(null);
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");

  function handleAddArea() {
    if (criandoArea || !novaAreaNome.trim()) return;
    setErroArea(null);
    startAreaTransition(async () => {
      const end = beginMutation();
      try {
        const nova = await createTaskArea(novaAreaNome.trim());
        setAreasDisponiveis((atual) =>
          atual.some((a) => a.id === nova.id) ? atual : [...atual, nova]
        );
        setArea(nova.nome);
        setNovaAreaNome("");
        setMostrandoNovaArea(false);
      } catch {
        setErroArea("Não foi possível criar a área. Tente de novo.");
      } finally {
        end();
      }
    });
  }

  // Tarefa de cliente sem conta escolhida seria gravada como
  // `is_internal: false, conta_id: null` — o estado incoerente espelhado do
  // "interna com conta": apareceria no escopo Clientes, rotulada "Interno", e
  // nenhum filtro de conta a alcançaria. O botão fica desabilitado por isto.
  const faltaConta = !isInternal && !contaId;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || faltaConta) return;
    startTransition(async () => {
      const end = beginMutation();
      try {
        await createTask({
          title: title.trim(),
          contaId: isInternal ? null : contaId || null,
          isInternal,
          area: isInternal ? area : null,
          priority,
          assigneeId: assigneeId || null,
          dueDate: dueDate || null,
          description: description || null,
        });
        onClose();
      } finally {
        end();
      }
    });
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3.5 p-5.5">
        <h2 className="text-base font-medium">Nova tarefa</h2>

        <Field label="TÍTULO">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito?" required />
        </Field>

        {/* Eram dois botões SEPARADOS, com um vão entre eles — o que lê como
            duas ações, e não como "escolha uma das duas". Juntos, e com o
            `role="group"` que o componente traz, a marcação passa a dizer o
            que a tela sempre quis dizer. Trocar de escopo continua limpando o
            rascunho de área nova: sem isso, marcar "interna", começar a
            digitar uma área e voltar para cliente deixava o formulário aberto
            e o erro na tela, sem campo a que se referir. */}
        <SegmentedControl
          preencher
          rotuloAcessivel="Escopo da tarefa"
          valor={isInternal ? "interna" : "cliente"}
          onChange={(v) => {
            const interna = v === "interna";
            setIsInternal(interna);
            if (!interna) {
              setMostrandoNovaArea(false);
              setNovaAreaNome("");
              setErroArea(null);
            }
          }}
          opcoes={[
            { valor: "cliente", rotulo: "Tarefa de cliente" },
            { valor: "interna", rotulo: "Interna" },
          ]}
        />

        {isInternal ? (
          <Field label="ÁREA">
            {mostrandoNovaArea ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    value={novaAreaNome}
                    onChange={(e) => setNovaAreaNome(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddArea();
                      }
                    }}
                    placeholder="Nome da nova área"
                  />
                  <Button
                    type="button"
                    disabled={criandoArea || !novaAreaNome.trim()}
                    onClick={handleAddArea}
                  >
                    {criandoArea ? "Adicionando…" : "Adicionar"}
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMostrandoNovaArea(false);
                    setNovaAreaNome("");
                    setErroArea(null);
                  }}
                  className="self-start text-small text-faint hover:text-ink"
                >
                  Cancelar e voltar à lista
                </button>
                {erroArea && <p className="text-small text-red">{erroArea}</p>}
              </div>
            ) : (
              <Select
                value={area}
                onChange={(e) => {
                  if (e.target.value === "__nova__") {
                    setMostrandoNovaArea(true);
                  } else {
                    setArea(e.target.value);
                  }
                }}
              >
                {areasDisponiveis.map((a) => (
                  <option key={a.id} value={a.nome}>
                    {a.nome}
                  </option>
                ))}
                <option value="__nova__">+ Nova área…</option>
              </Select>
            )}
          </Field>
        ) : (
          <Field label="CONTA">
            {contasIndisponiveis ? (
              // A leitura de contas falhou (mesmo caso do filtro da tela, dos
              // Playbooks e das Credenciais): um seletor só com "Selecione…"
              // seria de novo o beco sem saída que esta fase existe para
              // acabar — a pessoa escolhe "Tarefa de cliente" e não tem o que
              // escolher. O aviso diz a verdade; a tarefa interna continua
              // possível pelo outro botão.
              <Tag tone="amber">Contas indisponíveis</Tag>
            ) : (
              <>
                <Select value={contaId} onChange={(e) => setContaId(e.target.value)}>
                  <option value="">Selecione…</option>
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
                {/* Sem isto o botão "Criar tarefa" fica desabilitado sem dizer
                    por quê, que é o mesmo tipo de beco sem saída que esta fase
                    veio desfazer — só que menor. */}
                {faltaConta && (
                  <p className="mt-1 text-small text-muted">Escolha a conta ou marque a tarefa como interna.</p>
                )}
              </>
            )}
          </Field>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="PRIORIDADE">
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </Select>
          </Field>
          <Field label="RESPONSÁVEL">
            <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Sem responsável</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="PRAZO">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>

        <Field label="DESCRIÇÃO">
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || mostrandoNovaArea || faltaConta}>
            {pending ? "Criando…" : "Criar tarefa"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

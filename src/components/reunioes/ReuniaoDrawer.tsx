"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Slideover } from "@/components/ui/Overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { salvarAta, updateReuniao, deleteReuniao } from "@/lib/actions/reunioes";
import { createTask } from "@/lib/actions/tasks";
import { beginMutation } from "@/lib/realtime/mutation-gate";
import { formatarQuando, formatarDuracao, jaTerminou } from "@/lib/reunioes";
import { formatDate } from "@/lib/format";
import type { ReuniaoComTarefas } from "@/lib/data/reunioes";

export function ReuniaoDrawer({
  reuniao,
  contas,
  contasIndisponiveis,
  profiles,
  agora,
  onClose,
}: {
  reuniao: ReuniaoComTarefas;
  contas: { id: string; nome: string }[];
  contasIndisponiveis: boolean;
  profiles: { id: string; full_name: string }[];
  agora: Date;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const { pedirConfirmacao, dialogo } = useConfirm();
  const [pending, startTransition] = useTransition();
  const [ata, setAta] = useState(reuniao.ata ?? "");

  const terminou = jaTerminou(reuniao.aconteceEm, reuniao.duracaoMin, agora);

  function gravarAta(texto: string) {
    if (texto === (reuniao.ata ?? "")) return; // Nada mudou — não escreve.
    startTransition(async () => {
      const end = beginMutation();
      try {
        await salvarAta(reuniao.id, texto);
      } catch {
        notify("error", "Não foi possível salvar a ata. O texto continua na tela.");
      } finally {
        end();
      }
    });
  }

  return (
    <Slideover onClose={onClose}>
      {dialogo}

      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div className="min-w-0">
          <div className="truncate text-display font-medium">{reuniao.titulo}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-small text-muted">
            <span>{formatarQuando(reuniao.aconteceEm)}</span>
            {reuniao.duracaoMin !== null && <span>· {formatarDuracao(reuniao.duracaoMin)}</span>}
            {reuniao.conta && <Tag tone="neutral">{reuniao.conta.nome}</Tag>}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="flex-none text-title text-muted transition-colors duration-fast hover:text-ink"
        >
          ✕
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto scrollbar-thin p-5">
        <Agendamento
          reuniao={reuniao}
          contas={contas}
          contasIndisponiveis={contasIndisponiveis}
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="label">Ata</span>
            {/* Reunião que já aconteceu e não tem ata é o estado que esta tela
                existe para tornar visível. Antes dela acontecer, ata vazia é
                normal e não merece aviso nenhum. */}
            {terminou && !reuniao.ata && <span className="text-small text-red">ainda sem ata</span>}
          </div>
          <Textarea
            rows={10}
            value={ata}
            onChange={(e) => setAta(e.target.value)}
            // Salva ao sair do campo, como as gavetas do Pipeline e da
            // Implantação já fazem — não há botão de salvar aqui de propósito:
            // ata é texto que se escreve aos poucos durante a reunião.
            onBlur={(e) => gravarAta(e.target.value)}
            placeholder="O que foi decidido, e por quê."
          />
        </div>

        <ItensDeAcao reuniao={reuniao} profiles={profiles} />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border p-5">
        <button
          disabled={pending}
          onClick={() =>
            pedirConfirmacao({
              titulo: "Excluir reunião?",
              // A consequência exata, porque ela não é óbvia: o combinado
              // sobrevive à reunião.
              descricao: `"${reuniao.titulo}" sai da lista, junto com a pauta e a ata. As ${reuniao.tarefas.length === 1 ? "tarefa" : "tarefas"} que saíram dela continuam no Kanban, sem a origem. Não dá para desfazer.`,
              rotuloConfirmar: "Excluir reunião",
              tom: "perigo",
              aoConfirmar: () =>
                startTransition(async () => {
                  const end = beginMutation();
                  try {
                    await deleteReuniao(reuniao.id);
                    onClose();
                  } catch {
                    notify("error", "Não foi possível excluir a reunião. Tente novamente.");
                  } finally {
                    end();
                  }
                }),
            })
          }
          className="text-small text-faint transition-colors duration-fast hover:text-red"
        >
          Excluir reunião
        </button>
        {pending && <span className="text-small text-faint">salvando…</span>}
      </div>
    </Slideover>
  );
}

/**
 * Remarcar, trocar a conta, ajustar a duração e escrever a pauta.
 *
 * Existe porque sem ele a única forma de mudar o horário de uma reunião seria
 * apagar e criar outra — e isso levaria junto a ata e a ORIGEM dos itens de
 * ação, que é justamente o que o módulo existe para guardar. Uma reunião
 * adiada em dois dias é o caso mais banal que há.
 *
 * Salva com botão, e não no `onBlur` como a ata: são cinco campos que só
 * fazem sentido juntos. Um `onBlur` por campo gravaria "reunião às 14h da
 * Barbearia" no instante entre trocar a hora e trocar a conta.
 */
function Agendamento({
  reuniao,
  contas,
  contasIndisponiveis,
}: {
  reuniao: ReuniaoComTarefas;
  contas: { id: string; nome: string }[];
  contasIndisponiveis: boolean;
}) {
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState(reuniao.titulo);
  const [contaId, setContaId] = useState(reuniao.conta?.id ?? "");
  const [quando, setQuando] = useState(paraCampoLocal(reuniao.aconteceEm));
  const [duracao, setDuracao] = useState(reuniao.duracaoMin === null ? "" : String(reuniao.duracaoMin));
  const [pauta, setPauta] = useState(reuniao.pauta ?? "");

  if (!aberto) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="label">Pauta</span>
          <button
            onClick={() => setAberto(true)}
            className="text-small text-muted transition-colors duration-fast hover:text-accent"
          >
            Editar / remarcar
          </button>
        </div>
        {reuniao.pauta ? (
          // `whitespace-pre-wrap` porque a pauta foi escrita com quebras de
          // linha, e uma lista sem quebras vira parágrafo ilegível.
          <div className="whitespace-pre-wrap text-body text-muted">{reuniao.pauta}</div>
        ) : (
          <span className="text-body text-faint">Sem pauta escrita.</span>
        )}
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-card border border-border bg-bone p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (titulo.trim() === "" || quando === "") return;
        startTransition(async () => {
          const end = beginMutation();
          try {
            await updateReuniao(reuniao.id, {
              titulo: titulo.trim(),
              contaId: contaId || null,
              aconteceEm: new Date(quando).toISOString(),
              duracaoMin: duracao === "" ? null : Number(duracao),
              pauta: pauta.trim() === "" ? null : pauta.trim(),
            });
            setAberto(false);
          } catch {
            notify("error", "Não foi possível salvar. Os campos continuam como você deixou.");
          } finally {
            end();
          }
        });
      }}
    >
      <Field label="TÍTULO">
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </Field>

      <Field label="CONTA">
        {contasIndisponiveis ? (
          // A leitura de contas falhou: um seletor vazio diria "não há contas
          // cadastradas". O resto do formulário continua salvável, e `contaId`
          // mantém o valor que já estava — o que se perde é só a TROCA de
          // conta. Mesmo contrato das outras cinco superfícies.
          <Tag tone="amber">Contas indisponíveis</Tag>
        ) : (
          <Select value={contaId} onChange={(e) => setContaId(e.target.value)}>
            <option value="">Nenhuma (interna)</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="QUANDO">
          <Input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
        </Field>
        <Field label="DURAÇÃO (MIN)">
          <Input
            type="number"
            min={1}
            step={5}
            value={duracao}
            onChange={(e) => setDuracao(e.target.value)}
            placeholder="—"
          />
        </Field>
      </div>

      <Field label="PAUTA">
        <Textarea rows={5} value={pauta} onChange={(e) => setPauta(e.target.value)} />
      </Field>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending || titulo.trim() === "" || quando === ""}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

/**
 * O caminho de volta de `formatarQuando`: um instante ISO vira o
 * "YYYY-MM-DDTHH:mm" que `<input type="datetime-local">` entende, no fuso do
 * NAVEGADOR — que é o mesmo fuso em que o campo devolve o valor. Fazer a
 * conversão em `APP_TIMEZONE` aqui e deixar o navegador reinterpretar no dele
 * deslocaria o horário a cada abrir e salvar da gaveta.
 */
function paraCampoLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * O item de ação passa por `createTask` — a mesma função do modal do Kanban —
 * e não por um insert próprio. É ela que gera o código da tarefa, calcula a
 * posição na coluna, registra o histórico e revalida as rotas; duplicar o
 * insert aqui criaria uma tarefa sem nada disso.
 *
 * A conta da tarefa NASCE da conta da reunião: uma reunião com a Barbearia do
 * Ki gera tarefa daquela conta, e uma reunião interna gera tarefa interna.
 * Deixar escolher de novo permitiria a incoerência de uma reunião de cliente
 * gerar um combinado interno.
 */
function ItensDeAcao({
  reuniao,
  profiles,
}: {
  reuniao: ReuniaoComTarefas;
  profiles: { id: string; full_name: string }[];
}) {
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [donoId, setDonoId] = useState("");
  const [prazo, setPrazo] = useState("");

  // A conta vem da PRÓPRIA reunião, que já foi lida com sucesso — não da
  // lista de contas. Uma versão anterior disto bloqueava o formulário quando
  // `listContasLite` falhava; era engano meu: aqui não há seletor de conta, o
  // id já está em mãos, e criar o item de ação continua possível.
  const contaDaReuniao = reuniao.conta;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="label">Itens de ação</span>
        <span className="text-small text-faint">viram tarefas no Kanban</span>
      </div>

      {reuniao.tarefas.length === 0 ? (
        <EmptyState plain title="Nenhum combinado registrado." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {reuniao.tarefas.map((t) => (
            <Link
              key={t.id}
              href={`/kanban?task=${t.id}`}
              className="flex items-center gap-2.5 rounded-control border border-border-soft px-3 py-2 text-body transition-colors duration-fast hover:bg-neutral-tint"
            >
              <span className="font-mono text-label text-faint">{t.code}</span>
              <span
                className={clsx(
                  "min-w-0 flex-1 truncate",
                  t.status === "done" && "text-faint line-through"
                )}
              >
                {t.title}
              </span>
              {t.dueDate && <span className="flex-none font-mono text-label text-muted">{formatDate(t.dueDate)}</span>}
              {t.assignee && <span className="flex-none font-mono text-label text-faint">{t.assignee.initials}</span>}
            </Link>
          ))}
        </div>
      )}

      <form
          className="flex flex-col gap-2 rounded-card border border-dashed border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (titulo.trim() === "") return;
            startTransition(async () => {
              const end = beginMutation();
              try {
                await createTask({
                  title: titulo.trim(),
                  contaId: contaDaReuniao?.id ?? null,
                  isInternal: contaDaReuniao === null,
                  priority: "media",
                  assigneeId: donoId || null,
                  dueDate: prazo || null,
                  reuniaoId: reuniao.id,
                });
                setTitulo("");
                setPrazo("");
              } catch {
                notify("error", "Não foi possível criar a tarefa. Tente novamente.");
              } finally {
                end();
              }
            });
          }}
        >
          <Field label="NOVO ITEM">
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Mandar a proposta revisada"
            />
          </Field>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <Field label="RESPONSÁVEL">
              <Select value={donoId} onChange={(e) => setDonoId(e.target.value)}>
                <option value="">—</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="PRAZO">
              <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" disabled={pending || titulo.trim() === ""} className="self-end">
            {pending ? "Criando…" : "Criar tarefa"}
          </Button>
      </form>
    </div>
  );
}

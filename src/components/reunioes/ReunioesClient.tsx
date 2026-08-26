"use client";

import { useMemo, useState } from "react";
import { PageHeader, Section } from "@/components/layout/PageBody";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { EmptyState } from "@/components/ui/EmptyState";
import { Unavailable } from "@/components/ui/Unavailable";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { NovaReuniaoModal } from "./NovaReuniaoModal";
import { ReuniaoDrawer } from "./ReuniaoDrawer";
import { separarPorTempo, formatarQuando, formatarDuracao } from "@/lib/reunioes";
import type { ReuniaoComTarefas } from "@/lib/data/reunioes";

type Aba = "proximas" | "anteriores";

export function ReunioesClient({
  reunioes,
  unavailable,
  contas,
  contasIndisponiveis,
  profiles,
}: {
  reunioes: ReuniaoComTarefas[];
  unavailable: boolean;
  contas: { id: string; nome: string }[];
  contasIndisponiveis: boolean;
  profiles: { id: string; full_name: string }[];
}) {
  const [aba, setAba] = useState<Aba>("proximas");
  const [mostrarNova, setMostrarNova] = useState(false);
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);

  // Um instante só para a tela inteira, reancorado a cada leitura nova —
  // mesmo raciocínio de PipelineClient. Sem isso, uma aba aberta de um dia
  // para o outro continuaria mostrando a reunião de ontem em "Próximas".
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const agora = useMemo(() => new Date(), [reunioes]);

  const { proximas, anteriores } = useMemo(
    () => separarPorTempo(reunioes, agora),
    [reunioes, agora]
  );

  const lista = aba === "proximas" ? proximas : anteriores;

  // A gaveta lê da lista do servidor, não de uma cópia: depois de salvar, o
  // payload novo chega junto da resposta da Server Action (que revalida
  // /reunioes) e a gaveta acompanha sozinha.
  const selecionado = idSelecionado ? reunioes.find((r) => r.id === idSelecionado) ?? null : null;

  return (
    <>
      <PageHeader
        title="Reuniões"
        sub={
          unavailable
            ? "Marque uma reunião — a leitura da lista falhou, a escrita não."
            : `${proximas.length} ${proximas.length === 1 ? "marcada" : "marcadas"} · ${anteriores.length} no histórico`
        }
        actions={<Button onClick={() => setMostrarNova(true)}>+ Nova reunião</Button>}
      />

      {/* Uma falha de LEITURA não pode tirar a capacidade de ESCREVER: o aviso
          substitui a lista, o botão de marcar continua onde estava. Mesma
          regra do Pipeline. */}
      {unavailable && <Unavailable title="Não foi possível carregar as reuniões agora" />}

      {!unavailable && (
        <Section
          title={aba === "proximas" ? "Próximas" : "Histórico"}
          aside={
            <SegmentedControl
              rotuloAcessivel="Próximas ou anteriores"
              valor={aba}
              onChange={(v) => setAba(v as Aba)}
              opcoes={[
                { valor: "proximas", rotulo: `Próximas (${proximas.length})` },
                { valor: "anteriores", rotulo: `Anteriores (${anteriores.length})` },
              ]}
            />
          }
        >
          {lista.length === 0 ? (
            <EmptyState
              title={
                aba === "proximas"
                  ? "Nenhuma reunião marcada."
                  : "Nenhuma reunião aconteceu ainda."
              }
              sub={
                aba === "proximas"
                  ? 'Marque a primeira em "+ Nova reunião" — a pauta pode ser escrita agora e a ata depois.'
                  : "O histórico se enche sozinho conforme as reuniões marcadas acontecem."
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {lista.map((r) => (
                <LinhaReuniao key={r.id} reuniao={r} onOpen={() => setIdSelecionado(r.id)} />
              ))}
            </div>
          )}
        </Section>
      )}

      {mostrarNova && (
        <NovaReuniaoModal
          contas={contas}
          contasIndisponiveis={contasIndisponiveis}
          onClose={() => setMostrarNova(false)}
        />
      )}

      {selecionado && (
        <ReuniaoDrawer
          // Remontar ao trocar de reunião: sem a chave, a ata digitada numa
          // reapareceria na seguinte.
          key={selecionado.id}
          reuniao={selecionado}
          contas={contas}
          contasIndisponiveis={contasIndisponiveis}
          profiles={profiles}
          agora={agora}
          onClose={() => setIdSelecionado(null)}
        />
      )}
    </>
  );
}

function LinhaReuniao({
  reuniao,
  onOpen,
}: {
  reuniao: ReuniaoComTarefas;
  onOpen: () => void;
}) {
  const abertas = reuniao.tarefas.filter((t) => t.status !== "done").length;

  return (
    <Card
      onClick={onOpen}
      className="flex cursor-pointer items-center gap-3 p-4 shadow-raised transition-shadow duration-fast hover:shadow-layer"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-title font-medium">{reuniao.titulo}</span>
          {/* Interna x de cliente é a mesma distinção de tarefa e credencial,
              e o nome da conta é a resposta — "Interno" seria uma palavra a
              mais dizendo o que a ausência já diz. */}
          {reuniao.conta && <Tag tone="neutral">{reuniao.conta.nome}</Tag>}
        </div>
        <div className="mt-0.5 text-small text-muted">
          {formatarQuando(reuniao.aconteceEm)}
          {reuniao.duracaoMin !== null && <> · {formatarDuracao(reuniao.duracaoMin)}</>}
        </div>
      </div>

      <div className="flex flex-none items-center gap-2">
        {/* O estado que a tela existe para mostrar: reunião passada SEM ata é
            combinado que ninguém registrou. */}
        {reuniao.ata ? (
          <Tag tone="accent">com ata</Tag>
        ) : (
          <span className="text-small text-faint">sem ata</span>
        )}
        {reuniao.tarefas.length > 0 && (
          <Tag tone={abertas > 0 ? "amber" : "neutral"}>
            {abertas > 0
              ? `${abertas} de ${reuniao.tarefas.length} abertas`
              : `${reuniao.tarefas.length} concluídas`}
          </Tag>
        )}
      </div>
    </Card>
  );
}

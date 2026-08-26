"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ImplantacaoCard } from "./ImplantacaoCard";
import { moverEtapa } from "@/lib/actions/implantacoes";
import { beginInteraction, beginMutation } from "@/lib/realtime/mutation-gate";
import { findColumnIn, moveItem, type Columns } from "@/lib/optimistic";
import { useToast } from "@/components/ui/Toast";
import { useMediaQuery } from "@/lib/use-media-query";
import type { Etapa, ImplantacaoAberta } from "@/lib/data/implantacoes";
import { DropZone } from "@/components/ui/EmptyState";

/**
 * Diferença estrutural em relação a `PipelineBoard.tsx`: lá as colunas são o
 * `as const` `ESTAGIOS`, porque `negocio_estagio` é enum — código. Aqui as
 * colunas vêm de `implantacao_etapas`, que é DADO (editável sem deploy, é
 * literalmente o pedido do spec). `Columns<T, C extends string>` exige chave
 * string, mas `implantacao_etapas.posicao` é `int4` — a chave de coluna é
 * `String(etapa.posicao)`, convertida de volta com `Number(...)` na hora de
 * chamar `moverEtapa`. Sem `as const satisfies`, não há checagem de tipo
 * garantindo as 6 etapas — é o preço consciente de ser dado, não código.
 */
type EstadoDasColunas = Columns<ImplantacaoAberta, string>;

function agrupar(implantacoes: ImplantacaoAberta[], colunaIds: string[]): EstadoDasColunas {
  const colunas: EstadoDasColunas = {};
  for (const id of colunaIds) colunas[id] = [];
  for (const implantacao of implantacoes) {
    const chave = String(implantacao.etapa);
    // `implantacoes.etapa` é FK para `implantacao_etapas.posicao` — a chave
    // sempre existe entre as etapas lidas. Defensivo mesmo assim: uma
    // implantação cuja etapa não bate com nenhuma coluna lida simplesmente
    // não aparece, em vez de estourar o board.
    if (colunas[chave]) colunas[chave].push(implantacao);
  }
  return colunas;
}

function Coluna({
  id,
  etapa,
  implantacoes,
  agora,
  onOpen,
  dragDisabled,
}: {
  id: string;
  etapa: Etapa;
  implantacoes: ImplantacaoAberta[];
  agora: Date;
  onOpen: (id: string) => void;
  dragDisabled?: boolean;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="flex min-h-[120px] w-full flex-1 flex-col gap-2.25 rounded-card border border-neutral-tint-border bg-neutral-tint p-2.75"
    >
      <div className="flex items-center gap-2 px-0.5">
        <span className="label">{etapa.nome}</span>
        <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-label tabular-nums text-muted">
          {implantacoes.length}
        </span>
      </div>
      <SortableContext items={implantacoes.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2">
          {implantacoes.map((implantacao) => (
            <ImplantacaoCard
              key={implantacao.id}
              implantacao={implantacao}
              etapa={etapa}
              agora={agora}
              onOpen={() => onOpen(implantacao.id)}
              dragDisabled={dragDisabled}
            />
          ))}
          {implantacoes.length === 0 && (
            <DropZone />
          )}
        </div>
      </SortableContext>
    </div>
  );
}

/**
 * O mecanismo de arrastar é copiado de `PipelineBoard.tsx` linha por linha —
 * as três correções caras do dnd-kit (coluna de origem vinda do snapshot,
 * soltar fora reverte, `onDragCancel` separado de `onDragEnd`) são do
 * `@dnd-kit`, não do domínio, e continuam valendo aqui sem alteração. A única
 * adaptação é a chave de coluna: string derivada de `posicao`, não o enum.
 */
export function ImplantacaoBoard({
  implantacoes,
  etapas,
  agora,
  onOpenImplantacao,
}: {
  implantacoes: ImplantacaoAberta[];
  etapas: Etapa[];
  agora: Date;
  onOpenImplantacao: (id: string) => void;
}) {
  const colunaIds = useMemo(() => etapas.map((e) => String(e.posicao)), [etapas]);
  const etapaPorColuna = useMemo(() => {
    const mapa = new Map<string, Etapa>();
    for (const etapa of etapas) mapa.set(String(etapa.posicao), etapa);
    return mapa;
  }, [etapas]);

  const [implantacoesAnteriores, setImplantacoesAnteriores] = useState(implantacoes);
  const [colunas, setColunas] = useState<EstadoDasColunas>(() => agrupar(implantacoes, colunaIds));
  const [idAtivo, setIdAtivo] = useState<string | null>(null);
  const [colunasNoInicio, setColunasNoInicio] = useState<EstadoDasColunas | null>(null);
  const router = useRouter();
  const { notify } = useToast();

  if (implantacoes !== implantacoesAnteriores) {
    setImplantacoesAnteriores(implantacoes);
    setColunas(agrupar(implantacoes, colunaIds));
  }

  // A lista de sensores NUNCA muda de tamanho entre renderizações — o
  // `useSensors` do dnd-kit usa os sensores como array de dependências de um
  // `useMemo`. Quem é desabilitado no celular é o item arrastável
  // (`useSortable`/`disabled`), propagado por `dragDisabled`.
  const isMobile = useMediaQuery("(max-width: 767px)");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Segura a atualização por tempo real enquanto o cartão está na mão. Setado
  // no manipulador de evento, não em render. `implantacoes` não está
  // publicada para tempo real hoje, mas o contador é a convenção de todo
  // lugar que arrasta algo neste projeto, e a hora de acertar isso não é
  // depois de publicar.
  const encerrarInteracao = useRef<(() => void) | null>(null);

  function liberarInteracao() {
    encerrarInteracao.current?.();
    encerrarInteracao.current = null;
  }

  // Desmontar no meio de um arraste (navegar com o cartão na mão) não dispara
  // nem dragEnd nem dragCancel. Sem isto o contador ficaria preso até o cão de
  // guarda.
  useEffect(() => {
    return () => {
      encerrarInteracao.current?.();
      encerrarInteracao.current = null;
    };
  }, []);

  const implantacaoAtiva = useMemo(() => {
    if (!idAtivo) return null;
    for (const colunaId of colunaIds) {
      const achada = colunas[colunaId]?.find((i) => i.id === idAtivo);
      if (achada) return achada;
    }
    return null;
  }, [idAtivo, colunas, colunaIds]);

  function colunaDe(id: string): string | null {
    for (const colunaId of colunaIds) {
      if (colunas[colunaId]?.some((i) => i.id === id)) return colunaId;
    }
    // Soltar sobre a coluna vazia: o `over.id` é o id da própria coluna.
    if (colunaIds.includes(id)) return id;
    return null;
  }

  function handleDragStart(e: DragStartEvent) {
    liberarInteracao();
    encerrarInteracao.current = beginInteraction();
    setIdAtivo(String(e.active.id));
    setColunasNoInicio(colunas);
  }

  // O dnd-kit dispara `onDragCancel` — e NÃO `onDragEnd` — quando o arraste é
  // abortado (Escape, por exemplo). Sem tratar isto, o contador ficaria preso
  // e o cartão continuaria pendurado no `DragOverlay`.
  function handleDragCancel() {
    liberarInteracao();
    const inicio = colunasNoInicio;
    setIdAtivo(null);
    setColunasNoInicio(null);
    if (inicio) setColunas(inicio);
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const colunaAtiva = colunaDe(String(active.id));
    const colunaAlvo = colunaDe(String(over.id));
    if (!colunaAtiva || !colunaAlvo || colunaAtiva === colunaAlvo) return;

    setColunas((anterior) => moveItem(anterior, colunaIds, String(active.id), colunaAlvo, String(over.id)));
  }

  function handleDragEnd(e: DragEndEvent) {
    // O try/finally existe só para o contador de interação: qualquer saída
    // antecipada abaixo precisa devolvê-lo, senão o tempo real de todas as
    // telas fica represado.
    try {
      handleDragEndInner(e);
    } finally {
      liberarInteracao();
    }
  }

  function handleDragEndInner(e: DragEndEvent) {
    const { active, over } = e;
    const inicio = colunasNoInicio;
    setIdAtivo(null);
    setColunasNoInicio(null);

    if (!over) {
      // Solto fora de qualquer coluna: desfaz o que o handleDragOver já aplicou.
      if (inicio) setColunas(inicio);
      return;
    }

    const colunaAlvo = colunaDe(String(over.id));
    if (!colunaAlvo) {
      // Solto sobre algo que não é coluna nem cartão: mesmo caso de soltar
      // fora — o que o handleDragOver aplicou não pode ficar na tela.
      if (inicio) setColunas(inicio);
      return;
    }

    // A coluna de origem vem do estado do INÍCIO do arraste, não do atual: o
    // handleDragOver já moveu o cartão, e ler o estado corrente diria que ele
    // sempre nasceu na coluna de destino — nenhuma mudança de etapa seria
    // gravada.
    const colunaOrigem = inicio ? findColumnIn(inicio, colunaIds, String(active.id)) : null;

    if (!inicio || !colunaOrigem) {
      // Sem snapshot não dá para saber o que mudou. O quadro volta ao que o
      // servidor mandou, em vez de exibir um movimento que ninguém gravou.
      setColunas(agrupar(implantacoes, colunaIds));
      return;
    }

    if (colunaOrigem === colunaAlvo) {
      // Mesma coluna: não há o que gravar. A ordem dentro da coluna é do
      // leitor (não existe coluna de posição dentro da etapa), então um
      // reordenamento local só mentiria até a próxima leitura.
      setColunas(inicio);
      return;
    }

    // O portão segura a atualização por tempo real até a escrita terminar. Não
    // dá para usar try/finally aqui porque a promessa não é aguardada — quem
    // fecha o portão é o `.finally()` dela.
    const end = beginMutation();
    moverEtapa(String(active.id), Number(colunaAlvo))
      .catch(() => {
        if (inicio) setColunas(inicio);
        notify("error", "Não foi possível mover a implantação. Ela voltou para a etapa anterior.");
        router.refresh();
      })
      .finally(end);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* No celular as colunas empilham e quem rola é a grade; no desktop a
          grade fica parada e cada coluna rola por dentro. */}
      {/* O número de colunas é dado (`etapas.length`) e chega por `--colunas`;
          o ponto de corte mora em `globals.css`, não aqui — ver `.board-etapas`. */}
      <div
        className="board-etapas flex-1 gap-3.5 overflow-y-auto scrollbar-thin md:overflow-hidden"
        style={{ "--colunas": Math.max(etapas.length, 1) } as CSSProperties}
      >
        {etapas.map((etapa) => {
          const id = String(etapa.posicao);
          return (
            <div key={id} className="flex min-h-0 flex-col md:overflow-y-auto md:scrollbar-thin">
              <Coluna
                id={id}
                etapa={etapa}
                implantacoes={colunas[id] ?? []}
                agora={agora}
                onOpen={onOpenImplantacao}
                dragDisabled={isMobile}
              />
            </div>
          );
        })}
      </div>
      <DragOverlay>
        {implantacaoAtiva && etapaPorColuna.has(String(implantacaoAtiva.etapa)) ? (
          <ImplantacaoCard
            implantacao={implantacaoAtiva}
            etapa={etapaPorColuna.get(String(implantacaoAtiva.etapa))!}
            agora={agora}
            onOpen={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

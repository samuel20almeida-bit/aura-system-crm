"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { NegocioCard } from "./NegocioCard";
import { moverNegocioParaEstagio } from "@/lib/actions/deals";
import { beginInteraction, beginMutation } from "@/lib/realtime/mutation-gate";
import { findColumnIn, moveItem, type Columns } from "@/lib/optimistic";
import { useToast } from "@/components/ui/Toast";
import { useMediaQuery } from "@/lib/use-media-query";
import type { NegocioAberto } from "@/lib/data/deals";
import type { Database } from "@/lib/supabase/database.types";
import { DropZone } from "@/components/ui/EmptyState";

/**
 * Os cinco estágios do funil, na ordem. **Não existe coluna de ganho**: ganhar é
 * passagem de bastão para a implantação, e mora na gaveta do negócio.
 *
 * Exportado para `NegocioDrawer.tsx` reusar nos rótulos do seletor de estágio —
 * um segundo lugar com esses cinco nomes divergiria com o tempo, o mesmo
 * raciocínio que já se aplicou ao cálculo de dias de calendário e ao
 * movimento entre colunas nesta fase.
 */
export const ESTAGIOS = [
  { id: "lead", label: "LEAD" },
  { id: "contato", label: "CONTATO" },
  { id: "qualificado", label: "QUALIFICADO" },
  { id: "diagnostico", label: "DIAGNÓSTICO" },
  { id: "proposta", label: "PROPOSTA" },
] as const satisfies { id: Database["public"]["Enums"]["negocio_estagio"]; label: string }[];

export type EstagioId = (typeof ESTAGIOS)[number]["id"];
const ESTAGIO_IDS = ESTAGIOS.map((e) => e.id);

type EstadoDasColunas = Columns<NegocioAberto, EstagioId>;

function agrupar(negocios: NegocioAberto[]): EstadoDasColunas {
  return {
    lead: negocios.filter((n) => n.estagio === "lead"),
    contato: negocios.filter((n) => n.estagio === "contato"),
    qualificado: negocios.filter((n) => n.estagio === "qualificado"),
    diagnostico: negocios.filter((n) => n.estagio === "diagnostico"),
    proposta: negocios.filter((n) => n.estagio === "proposta"),
  };
}

function Coluna({
  id,
  label,
  negocios,
  agora,
  onOpen,
  dragDisabled,
}: {
  id: EstagioId;
  label: string;
  negocios: NegocioAberto[];
  agora: Date;
  onOpen: (id: string) => void;
  dragDisabled?: boolean;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="flex min-h-[120px] w-full flex-1 flex-col gap-2.25 rounded-xl border border-neutral-tint-border bg-neutral-tint p-2.75"
    >
      <div className="flex items-center gap-2 px-0.5">
        <span className="label">{label}</span>
        <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted">{negocios.length}</span>
      </div>
      <SortableContext items={negocios.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2">
          {negocios.map((negocio) => (
            <NegocioCard
              key={negocio.id}
              negocio={negocio}
              agora={agora}
              onOpen={() => onOpen(negocio.id)}
              dragDisabled={dragDisabled}
            />
          ))}
          {negocios.length === 0 && (
            <DropZone />
          )}
        </div>
      </SortableContext>
    </div>
  );
}

/**
 * O mecanismo de arrastar é o do `KanbanBoard.tsx`, adaptado aos tipos do
 * Pipeline: as três correções que ele carrega custaram caro e estão comentadas
 * uma a uma abaixo — coluna de origem vinda do snapshot, soltar fora reverte, e
 * `onDragCancel` como evento separado de `onDragEnd`.
 *
 * A diferença de fundo em relação ao Kanban: `negocios` **não tem coluna de
 * posição**. Ordem dentro da coluna é regra do leitor (o mais parado no topo),
 * não arrasto — então reordenar dentro da mesma coluna não é gravável, e o que
 * o arraste grava é só a mudança de estágio.
 */
export function PipelineBoard({
  negocios,
  agora,
  onOpenNegocio,
}: {
  negocios: NegocioAberto[];
  agora: Date;
  onOpenNegocio: (id: string) => void;
}) {
  const [negociosAnteriores, setNegociosAnteriores] = useState(negocios);
  const [colunas, setColunas] = useState<EstadoDasColunas>(() => agrupar(negocios));
  const [idAtivo, setIdAtivo] = useState<string | null>(null);
  const [colunasNoInicio, setColunasNoInicio] = useState<EstadoDasColunas | null>(null);
  const router = useRouter();
  const { notify } = useToast();

  if (negocios !== negociosAnteriores) {
    setNegociosAnteriores(negocios);
    setColunas(agrupar(negocios));
  }

  // A lista de sensores NUNCA muda de tamanho entre renderizações — o
  // `useSensors` do dnd-kit usa os sensores como array de dependências de um
  // `useMemo`. Quem é desabilitado no celular é o item arrastável
  // (`useSortable`/`disabled`), propagado por `dragDisabled`.
  const isMobile = useMediaQuery("(max-width: 767px)");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Segura a atualização por tempo real enquanto o cartão está na mão. Setado no
  // manipulador de evento, não em render. Hoje `negocios` não está publicada
  // para tempo real, mas o contador é a convenção de todo lugar que arrasta algo
  // neste projeto, e a hora de acertar isso não é depois de publicar.
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

  const negocioAtivo = useMemo(() => {
    if (!idAtivo) return null;
    for (const estagio of ESTAGIO_IDS) {
      const achado = colunas[estagio].find((n) => n.id === idAtivo);
      if (achado) return achado;
    }
    return null;
  }, [idAtivo, colunas]);

  function colunaDe(id: string): EstagioId | null {
    for (const estagio of ESTAGIO_IDS) {
      if (colunas[estagio].some((n) => n.id === id)) return estagio;
    }
    // Soltar sobre a coluna vazia: o `over.id` é o id da própria coluna.
    if ((ESTAGIO_IDS as readonly string[]).includes(id)) return id as EstagioId;
    return null;
  }

  function handleDragStart(e: DragStartEvent) {
    liberarInteracao();
    encerrarInteracao.current = beginInteraction();
    setIdAtivo(String(e.active.id));
    setColunasNoInicio(colunas);
  }

  // O dnd-kit dispara `onDragCancel` — e NÃO `onDragEnd` — quando o arraste é
  // abortado (Escape, por exemplo). Sem tratar isto, o contador ficaria preso e
  // o cartão continuaria pendurado no `DragOverlay`.
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

    setColunas((anterior) => moveItem(anterior, ESTAGIO_IDS, String(active.id), colunaAlvo, String(over.id)));
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
    // sempre nasceu na coluna de destino — nenhuma mudança de estágio seria
    // gravada.
    const colunaOrigem = inicio ? findColumnIn(inicio, ESTAGIO_IDS, String(active.id)) : null;

    if (!inicio || !colunaOrigem) {
      // Sem snapshot não dá para saber o que mudou. O quadro volta ao que o
      // servidor mandou, em vez de exibir um movimento que ninguém gravou.
      setColunas(agrupar(negocios));
      return;
    }

    if (colunaOrigem === colunaAlvo) {
      // Mesma coluna: não há o que gravar. A ordem dentro da coluna é do leitor
      // (não existe coluna de posição em `negocios`), então um reordenamento
      // local só mentiria até a próxima leitura.
      setColunas(inicio);
      return;
    }

    // O portão segura a atualização por tempo real até a escrita terminar. Não
    // dá para usar try/finally aqui porque a promessa não é aguardada — quem
    // fecha o portão é o `.finally()` dela.
    const end = beginMutation();
    moverNegocioParaEstagio(String(active.id), colunaAlvo)
      .catch(() => {
        if (inicio) setColunas(inicio);
        notify("error", "Não foi possível mover o negócio. Ele voltou para o estágio anterior.");
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
      {/* No celular as cinco colunas empilham e quem rola é a grade; no
          desktop a grade fica parada e cada coluna rola por dentro. */}
      <div className="grid flex-1 grid-cols-1 gap-3.5 overflow-y-auto scrollbar-thin md:grid-cols-5 md:overflow-hidden">
        {ESTAGIOS.map((estagio) => (
          <div key={estagio.id} className="flex min-h-0 flex-col md:overflow-y-auto md:scrollbar-thin">
            <Coluna
              id={estagio.id}
              label={estagio.label}
              negocios={colunas[estagio.id]}
              agora={agora}
              onOpen={onOpenNegocio}
              dragDisabled={isMobile}
            />
          </div>
        ))}
      </div>
      <DragOverlay>
        {negocioAtivo ? <NegocioCard negocio={negocioAtivo} agora={agora} onOpen={() => {}} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

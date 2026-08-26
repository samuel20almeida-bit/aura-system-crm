"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageBody";
import { Unavailable } from "@/components/ui/Unavailable";
import { ImplantacaoBoard } from "./ImplantacaoBoard";
import { ImplantacaoDrawer } from "./ImplantacaoDrawer";
import { saudeDaImplantacao, vencimentoDaEtapa } from "@/lib/implantacoes";
import type { Etapa, ImplantacaoAberta } from "@/lib/data/implantacoes";
import { EmptyState } from "@/components/ui/EmptyState";

export function ImplantacaoClient({
  implantacoes,
  etapas,
  unavailable = false,
}: {
  implantacoes: ImplantacaoAberta[];
  etapas: Etapa[];
  unavailable?: boolean;
}) {
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);

  // Um instante só para a tela inteira: cartões, gaveta e resumo têm que
  // concordar sobre que horas são. Reancorado a cada leitura nova (mesmo
  // raciocínio de `PipelineClient.tsx`: uma aba deixada aberta de um dia
  // para o outro não pode continuar mostrando "em dia" depois que o SLA
  // vence).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const agora = useMemo(() => new Date(), [implantacoes]);

  const etapaPorPosicao = useMemo(() => {
    const mapa = new Map<number, Etapa>();
    for (const etapa of etapas) mapa.set(etapa.posicao, etapa);
    return mapa;
  }, [etapas]);

  const saudeDeCada = implantacoes.map((implantacao) => {
    const etapa = etapaPorPosicao.get(implantacao.etapa);
    if (!etapa) return null;
    const vencimento = vencimentoDaEtapa(implantacao.etapa_desde, etapa.sla_dias);
    return { saude: saudeDaImplantacao(vencimento, etapa.espera, agora), espera: etapa.espera };
  });

  const podres = saudeDeCada.filter((s) => s?.saude === "podre").length;
  // Achado na revisão final: etapa esperando cliente nunca vira "podre" (de
  // propósito — não é atraso nosso), então "N apodrecendo" sozinho deixava
  // uma implantação travada há semanas invisível no resumo. Um segundo
  // número cobre exatamente o que o primeiro não pode contar.
  const esperandoCliente = saudeDeCada.filter((s) => s?.espera === "cliente" && s.saude === "atencao").length;

  const selecionado = idSelecionado ? implantacoes.find((i) => i.id === idSelecionado) ?? null : null;
  const etapaDoSelecionado = selecionado ? etapaPorPosicao.get(selecionado.etapa) ?? null : null;

  return (
    <>
      <PageHeader
        title="Implantação"
        sub={
          unavailable
            ? "A leitura da esteira falhou — recarregue a página em instantes."
            : `${implantacoes.length} ${implantacoes.length === 1 ? "implantação em andamento" : "implantações em andamento"} · ${podres} apodrecendo · ${esperandoCliente} travadas esperando cliente`
        }
      />

      {unavailable && <Unavailable title="Não foi possível carregar a esteira de implantação agora" />}

      {!unavailable && implantacoes.length === 0 && (
        <EmptyState
          title="Nenhuma implantação em andamento."
          sub="Uma implantação nasce sozinha quando um negócio é ganho no Pipeline."
        />
      )}

      {!unavailable && implantacoes.length > 0 && (
        <ImplantacaoBoard
          implantacoes={implantacoes}
          etapas={etapas}
          agora={agora}
          onOpenImplantacao={setIdSelecionado}
        />
      )}

      {selecionado && etapaDoSelecionado && (
        <ImplantacaoDrawer
          // Remontar ao trocar de implantação: sem a chave, campos digitados
          // numa implantação reapareceriam na seguinte.
          key={selecionado.id}
          implantacao={selecionado}
          etapas={etapas}
          agora={agora}
          onClose={() => setIdSelecionado(null)}
        />
      )}
    </>
  );
}

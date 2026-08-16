"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { formatActivityWhen } from "@/lib/activity-feed";
import { useLiveRefresh } from "@/lib/realtime/useLiveRefresh";

export type LiveActivityItem = {
  id: string;
  who: string;
  verb: string;
  detail: string | null;
  when: string;
  createdAt: string;
  initials: string | null;
};

/** Mesma cadência do relógio do sino — não precisa ser mais fino que isto. */
const REFRESH_INTERVAL_MS = 60_000;

/**
 * O painel monta SEMPRE, inclusive quando a consulta do servidor falhou — daí
 * `error` ser prop e o aviso ser desenhado aqui dentro, em vez de a página
 * trocar o componente inteiro por um `<Unavailable>`.
 *
 * A razão não é estética. Este componente é o único do sistema que chama
 * `useLiveRefresh`; se ele não montasse, um blip de rede numa única consulta
 * derrubaria a atualização ao vivo de `/hoje` inteira — e para sempre, porque
 * sem o canal não chega evento nenhum que refaça o payload. O canal morreria
 * exatamente na condição em que é mais útil. Montado, o próximo refresh cura o
 * painel sozinho.
 *
 * Vale como padrão, não como detalhe desta tela: qualquer coisa que venha a
 * pendurar-se neste mecanismo herdaria o acoplamento e ficaria muda justamente
 * quando precisa falar.
 *
 * NOTA DE ESCOPO: este é o ÚNICO consumidor de `useLiveRefresh` no app. A Parte I
 * parou em 3 de 7 tarefas, então "ao vivo" é esta tela, não o sistema — Kanban,
 * Pipeline, Metas e Playbooks continuam se comportando como antes, sem assinatura.
 *
 * Transplantado de `/início` para `/hoje` na Task 6 da Fase 3A, quando
 * `/início` virou redirect puro: era o único consumidor de `useLiveRefresh`
 * do app, e a rota original ia sumir sem dar um novo lar a ele.
 */
export function LiveActivity({ items, error = false }: { items: LiveActivityItem[]; error?: boolean }) {
  useLiveRefresh(["activity_log"]);

  // `null` até o primeiro tick do cliente: nesse estado o texto exibido é
  // sempre `item.when`, o valor que o servidor já calculou e mandou no HTML.
  // Se em vez disso o primeiro render chamasse `formatActivityWhen(..., new
  // Date())`, o servidor e o cliente calculariam o relativo em instantes
  // reais diferentes: o valor do servidor é a única fonte até o cliente montar.
  const [clientNow, setClientNow] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setClientNow(Date.now()), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Só a entrada que chegou depois da montagem ganha a animação de entrada —
  // recarregar a página não deve fazer a lista inteira deslizar para dentro.
  const previousIds = useRef<Set<string> | null>(null);
  // Instante da linha mais nova já vista. Id ausente da lista anterior NÃO
  // basta para chamar de novidade: `activity_log.task_id` é `on delete
  // cascade`, então apagar uma tarefa com 3 registros encurta a lista e puxa
  // para dentro da janela de 12 três linhas ANTIGAS, que nunca tinham sido
  // vistas e deslizariam como se acabassem de acontecer. Novidade é id nova E
  // mais recente que tudo que já passou por aqui.
  const newestSeen = useRef(Number.NEGATIVE_INFINITY);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const maisNovoDaVez = items.reduce(
      (max, item) => Math.max(max, Date.parse(item.createdAt)),
      Number.NEGATIVE_INFINITY
    );
    if (previousIds.current) {
      const corte = newestSeen.current;
      const fresh = items
        .filter((item) => !previousIds.current!.has(item.id) && Date.parse(item.createdAt) > corte)
        .map((item) => item.id);
      setFreshIds(new Set(fresh));
    }
    previousIds.current = new Set(items.map((item) => item.id));
    newestSeen.current = Math.max(newestSeen.current, maisNovoDaVez);
  }, [items]);

  return (
    <Card className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden p-4">
      <span className="label">ATIVIDADE RECENTE</span>
      <div className="flex flex-col gap-2.5 overflow-y-auto scrollbar-thin text-[12.5px]">
        {error && (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-red">Não foi possível carregar a atividade recente.</span>
            <span className="font-mono text-[11px] text-muted">
              A consulta ao banco falhou — a próxima atualização tenta de novo.
            </span>
          </div>
        )}
        {!error && items.length === 0 && <div className="text-faint">Nada aconteceu por aqui ainda.</div>}
        {items.map((item) => (
          <div key={item.id} className={clsx("flex gap-2.5", freshIds.has(item.id) && "animate-slide-in")}>
            <Avatar initials={item.initials} size="sm" ghost />
            <div>
              {/* O detalhe vem separado do verbo para poder ser destacado: é a
                  parte que o olho procura na frase ("moveu Finalizar o CRM
                  para **Em andamento**"). Sem `detail`, nada é renderizado —
                  não sobra espaço no fim da linha. */}
              <span>
                {item.who} {item.verb}
                {item.detail === null ? null : <> <b className="font-medium">{item.detail}</b></>}
              </span>
              <div className="mt-0.5 font-mono text-[11px] text-faint">
                {clientNow === null ? item.when : formatActivityWhen(item.createdAt, new Date(clientNow))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

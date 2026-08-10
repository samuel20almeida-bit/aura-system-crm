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
  text: string;
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
 * derrubaria a atualização ao vivo da `/início` inteira — e para sempre, porque
 * sem o canal não chega evento nenhum que refaça o payload. O canal morreria
 * exatamente na condição em que é mais útil. Montado, o próximo refresh cura o
 * painel sozinho.
 *
 * Vale como padrão, não como detalhe desta tela: quem pendurar a faixa de
 * defasagem neste mesmo mecanismo herdaria o acoplamento e ficaria mudo
 * justamente quando precisa falar.
 */
export function LiveActivity({ items, error = false }: { items: LiveActivityItem[]; error?: boolean }) {
  useLiveRefresh(["activity_log"]);

  // `null` até o primeiro tick do cliente: nesse estado o texto exibido é
  // sempre `item.when`, o valor que o servidor já calculou e mandou no HTML.
  // Se em vez disso o primeiro render chamasse `formatActivityWhen(..., new
  // Date())`, o servidor e o cliente calculariam o relativo em instantes
  // reais diferentes — a mesma armadilha que o TimerWidget evita começando
  // `elapsedMs` em 0 e só corrigindo depois de montado, num efeito.
  const [clientNow, setClientNow] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setClientNow(Date.now()), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Só a entrada que chegou depois da montagem ganha a animação de entrada —
  // recarregar a página não deve fazer a lista inteira deslizar para dentro.
  const previousIds = useRef<Set<string> | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(items.map((item) => item.id));
    if (previousIds.current) {
      const fresh = items.filter((item) => !previousIds.current!.has(item.id)).map((item) => item.id);
      setFreshIds(new Set(fresh));
    }
    previousIds.current = currentIds;
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
              <span>
                {item.who} {item.text}
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

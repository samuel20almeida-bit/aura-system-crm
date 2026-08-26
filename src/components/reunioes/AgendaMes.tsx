"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  gradeDoMes,
  agruparPorDia,
  rotuloDoMes,
  rotuloDoDia,
  hojeComoChave,
  DIAS_DA_SEMANA,
} from "@/lib/agenda";
import { formatarDuracao, jaTerminou } from "@/lib/reunioes";
import { APP_TIMEZONE } from "@/lib/timezone";
import type { ReuniaoComTarefas } from "@/lib/data/reunioes";

/** Só a hora, porque o dia já está no cabeçalho da coluna ao lado. */
function apenasHora(aconteceEm: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(new Date(aconteceEm));
}

/**
 * O tom de cada reunião. NÃO é uma paleta nova: a referência do 21st.dev usa
 * azul/verde/laranja arbitrários, e cor arbitrária num CRM é cor que ninguém
 * sabe ler. Aqui o tom responde a uma pergunta que o Aura já faz em toda tela:
 *
 *   vermelho — já aconteceu e ninguém escreveu a ata (o estado que a tela
 *              existe para tornar visível)
 *   verde    — é de uma conta
 *   neutro   — interna
 */
function tomDaReuniao(r: ReuniaoComTarefas, agora: Date) {
  if (jaTerminou(r.aconteceEm, r.duracaoMin, agora) && !r.ata) {
    return { ponto: "bg-red", fundo: "bg-red-tint", hora: "text-red" };
  }
  if (r.conta) {
    return { ponto: "bg-accent", fundo: "bg-accent-tint", hora: "text-accent" };
  }
  return { ponto: "bg-faint", fundo: "bg-neutral-tint", hora: "text-muted" };
}

export function AgendaMes({
  reunioes,
  agora,
  onAbrir,
  onNovaNoDia,
}: {
  reunioes: ReuniaoComTarefas[];
  agora: Date;
  onAbrir: (id: string) => void;
  /** Marcar uma reunião já com o dia escolhido preenchido. */
  onNovaNoDia: (chave: string) => void;
}) {
  const hoje = useMemo(() => hojeComoChave(agora), [agora]);
  const [mesVisivel, setMesVisivel] = useState(() => ({
    ano: Number(hoje.slice(0, 4)),
    mes0: Number(hoje.slice(5, 7)) - 1,
  }));
  const [diaEscolhido, setDiaEscolhido] = useState(hoje);

  const grade = useMemo(
    () => gradeDoMes(mesVisivel.ano, mesVisivel.mes0),
    [mesVisivel]
  );
  const porDia = useMemo(() => agruparPorDia(reunioes), [reunioes]);
  const doDia = porDia.get(diaEscolhido) ?? [];

  function andarMes(passo: number) {
    setMesVisivel(({ ano, mes0 }) => {
      const d = new Date(Date.UTC(ano, mes0 + passo, 15, 12));
      return { ano: d.getUTCFullYear(), mes0: d.getUTCMonth() };
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(280px,340px)_1fr]">
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-title font-medium first-letter:uppercase">
            {rotuloDoMes(mesVisivel.ano, mesVisivel.mes0)}
          </span>
          <div className="flex items-center gap-1">
            <BotaoMes rotulo="Mês anterior" onClick={() => andarMes(-1)}>
              ‹
            </BotaoMes>
            <button
              onClick={() => {
                setMesVisivel({ ano: Number(hoje.slice(0, 4)), mes0: Number(hoje.slice(5, 7)) - 1 });
                setDiaEscolhido(hoje);
              }}
              className="rounded-control px-2 py-1 text-small text-muted transition-colors duration-fast hover:bg-neutral-tint hover:text-ink"
            >
              hoje
            </button>
            <BotaoMes rotulo="Próximo mês" onClick={() => andarMes(1)}>
              ›
            </BotaoMes>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {DIAS_DA_SEMANA.map((letra, i) => (
            // A chave leva o índice porque as letras se repetem (S de segunda
            // e de sábado, Q de quarta e de quinta).
            <div key={`${letra}-${i}`} className="pb-1 text-center text-label text-faint">
              {letra}
            </div>
          ))}

          {grade.map((dia) => {
            const quantas = porDia.get(dia.chave)?.length ?? 0;
            const escolhido = dia.chave === diaEscolhido;
            const ehHoje = dia.chave === hoje;
            return (
              <button
                key={dia.chave}
                onClick={() => setDiaEscolhido(dia.chave)}
                aria-pressed={escolhido}
                aria-label={`${dia.numero}${quantas > 0 ? `, ${quantas} ${quantas === 1 ? "reunião" : "reuniões"}` : ""}`}
                className={clsx(
                  "relative flex aspect-square flex-col items-center justify-center rounded-control text-small tabular-nums transition-colors duration-fast",
                  // O dia de fora do mês recua, mas continua LEGÍVEL: ele é
                  // clicável, e `text-faint/60` daria ~2,6:1. `text-faint`
                  // sozinho dá 4,76:1 (medido na etapa B) e já se distingue
                  // bem do `text-ink` dos dias do mês. Sumir com eles não é
                  // opção: a primeira semana perderia a âncora de onde o mês
                  // começa.
                  !dia.doMes && "text-faint",
                  escolhido
                    ? "bg-ink font-medium text-bone"
                    : ehHoje
                      ? "bg-accent-tint font-medium text-accent"
                      : "hover:bg-neutral-tint"
                )}
              >
                {dia.numero}
                {quantas > 0 && (
                  // O ponto some sob a seleção preta se for verde; sobre ela,
                  // vira claro. Mesma correção da pílula do menu.
                  <span
                    aria-hidden
                    className={clsx(
                      "absolute bottom-1 h-1 w-1 rounded-full",
                      escolhido ? "bg-bone" : "bg-accent"
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-title font-medium first-letter:uppercase">
            {rotuloDoDia(diaEscolhido)}
          </span>
          <button
            onClick={() => onNovaNoDia(diaEscolhido)}
            className="text-small text-muted transition-colors duration-fast hover:text-accent"
          >
            + marcar neste dia
          </button>
        </div>

        {doDia.length === 0 ? (
          <EmptyState plain title="Nada marcado neste dia." className="my-auto" />
        ) : (
          <div className="flex flex-col gap-2">
            {doDia.map((r) => {
              const tom = tomDaReuniao(r, agora);
              return (
                <button
                  key={r.id}
                  onClick={() => onAbrir(r.id)}
                  className={clsx(
                    "flex items-center gap-3 rounded-control px-3 py-2.5 text-left transition-opacity duration-fast hover:opacity-80",
                    tom.fundo
                  )}
                >
                  <span aria-hidden className={clsx("h-1.5 w-1.5 flex-none rounded-full", tom.ponto)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium">{r.titulo}</span>
                    {r.conta && <span className="block truncate text-small text-muted">{r.conta.nome}</span>}
                  </span>
                  <span className={clsx("flex-none font-mono text-label tabular-nums", tom.hora)}>
                    {apenasHora(r.aconteceEm)}
                    {r.duracaoMin !== null && <> · {formatarDuracao(r.duracaoMin)}</>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function BotaoMes({
  rotulo,
  onClick,
  children,
}: {
  rotulo: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={rotulo}
      className="flex h-6 w-6 items-center justify-center rounded-control text-muted transition-colors duration-fast hover:bg-neutral-tint hover:text-ink"
    >
      {children}
    </button>
  );
}

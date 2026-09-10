"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Unavailable } from "@/components/ui/Unavailable";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { beginMutation } from "@/lib/realtime/mutation-gate";
import { adicionarNota, listarNotasDaConta, removerNota, type NotaDaConta } from "@/lib/actions/notas";
import { formatDate } from "@/lib/format";

/**
 * O diário da conta: o que aconteceu, em ordem, com data e autor.
 *
 * Uma linha por acontecimento, e não um campo de texto grande, porque é assim
 * que a prospecção realmente se acumula — ver o cabeçalho de
 * `0024_conta_notas.sql`. A nota é da CONTA e não do negócio: sobrevive ao
 * negócio ser perdido e continua valendo na próxima tentativa.
 */
export function NotasDaConta({ contaId }: { contaId: string }) {
  const { notify } = useToast();
  const { pedirConfirmacao, dialogo } = useConfirm();
  const [pendente, startTransition] = useTransition();

  const [notas, setNotas] = useState<NotaDaConta[] | null>(null);
  const [falhouAoLer, setFalhouAoLer] = useState(false);
  const [texto, setTexto] = useState("");

  // Volta ao estado de carregando quando a conta muda, ANTES de pintar — e não
  // dentro do efeito. Zerar no efeito faria a tela desenhar uma vez com as
  // notas da conta anterior e só então apagá-las, que é a renderização em
  // cascata que o lint acusa. É o mesmo padrão do `PipelineBoard`, e a única
  // situação em que o React admite `setState` durante o render: derivar estado
  // de uma prop que mudou.
  const [contaCarregada, setContaCarregada] = useState<string | null>(null);
  if (contaCarregada !== contaId) {
    setContaCarregada(contaId);
    setNotas(null);
    setFalhouAoLer(false);
  }

  // A leitura acontece ao abrir a aba, não junto do quadro: ver o comentário
  // de `listarNotasDaConta`. `contaId` nas dependências porque a gaveta
  // remonta por negócio, mas a mesma conta pode aparecer em dois.
  useEffect(() => {
    let cancelado = false;

    listarNotasDaConta(contaId)
      .then((lidas) => {
        // Sem esta guarda, fechar a gaveta antes da resposta chegar dispara um
        // setState em componente desmontado — e, pior, uma resposta antiga
        // poderia sobrescrever a de uma conta aberta depois.
        if (!cancelado) setNotas(lidas);
      })
      .catch((erro) => {
        console.error("[pipeline] falha ao ler as notas da conta:", erro);
        if (!cancelado) setFalhouAoLer(true);
      });

    return () => {
      cancelado = true;
    };
  }, [contaId]);

  const textoValido = texto.trim() !== "";

  function registrar() {
    if (!textoValido) return;
    startTransition(async () => {
      const end = beginMutation();
      try {
        await adicionarNota(contaId, texto);
        // Relê em vez de empurrar a nota na lista local: quem carimba a data e
        // resolve o autor é o banco, e inventar os dois aqui produziria uma
        // linha que muda de aparência no próximo carregamento.
        setNotas(await listarNotasDaConta(contaId));
        setTexto("");
      } catch (erro) {
        console.error("[pipeline] falha ao registrar a nota:", erro);
        notify("error", "Não foi possível registrar. Tente de novo — se persistir, me avise.");
      } finally {
        end();
      }
    });
  }

  function remover(nota: NotaDaConta) {
    pedirConfirmacao({
      titulo: "Apagar esta anotação?",
      descricao: "Ela some para os dois, e não dá para desfazer.",
      rotuloConfirmar: "Apagar",
      aoConfirmar: () =>
        startTransition(async () => {
          const end = beginMutation();
          try {
            await removerNota(nota.id);
            setNotas((atuais) => (atuais ?? []).filter((n) => n.id !== nota.id));
          } catch (erro) {
            console.error("[pipeline] falha ao apagar a nota:", erro);
            notify("error", "Não foi possível apagar. Tente de novo — se persistir, me avise.");
          } finally {
            end();
          }
        }),
    });
  }

  return (
    <div className="flex flex-col gap-3.5">
      {dialogo}

      <div className="flex flex-col gap-2">
        <Textarea
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Liguei, falei com o balconista. O dono chega depois das 14h."
          // Ctrl/Cmd+Enter envia. Enter sozinho continua quebrando linha: o
          // campo é de várias linhas, e roubar o Enter num textarea é a forma
          // mais rápida de fazer alguém perder o que estava escrevendo.
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              registrar();
            }
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-label text-faint">⌘/Ctrl + Enter</span>
          <Button onClick={registrar} disabled={pendente || !textoValido}>
            {pendente ? "Registrando…" : "Registrar"}
          </Button>
        </div>
      </div>

      {falhouAoLer && <Unavailable title="Não foi possível carregar as anotações" />}

      {/* Esqueleto e não "carregando…": a lista tem forma conhecida, e o
          esqueleto evita o salto de layout quando as linhas chegam. */}
      {!falhouAoLer && notas === null && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      )}

      {!falhouAoLer && notas !== null && notas.length === 0 && (
        <EmptyState
          plain
          title="Nada anotado ainda."
          sub="O que foi dito numa ligação some da cabeça em dois dias — e é o que faz a próxima valer mais."
        />
      )}

      {!falhouAoLer && notas !== null && notas.length > 0 && (
        <ol className="flex flex-col gap-2">
          {notas.map((nota) => (
            <li
              key={nota.id}
              className="group flex gap-2.5 rounded-card border border-border-soft bg-neutral-tint p-3"
            >
              <Avatar initials={nota.autor?.initials} size="sm" ghost={!nota.autor} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-small font-medium">{nota.autor?.full_name ?? "Alguém"}</span>
                  <span className="font-mono text-label text-faint">
                    {formatDate(nota.criado_em, { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </span>
                </div>
                {/* `whitespace-pre-wrap`: quem escreve em linhas espera lê-las
                    em linhas. Sem isto o parágrafo digitado vira um bloco só. */}
                <p className="mt-1 whitespace-pre-wrap break-words text-body">{nota.texto}</p>
              </div>
              {/* Aparece no hover no desktop e fica sempre visível no toque,
                  onde não existe hover — `group-hover` sozinho deixaria o
                  botão inalcançável no celular. */}
              <button
                type="button"
                onClick={() => remover(nota)}
                disabled={pendente}
                aria-label={`Apagar a anotação de ${nota.autor?.full_name ?? "alguém"}`}
                className="flex-none self-start text-small text-faint opacity-100 transition-opacity duration-fast hover:text-red md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

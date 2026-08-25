"use client";

import { useCallback, useState } from "react";
import { Modal } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";

type Pedido = {
  titulo: string;
  descricao?: string;
  /** O texto do botão que confirma. Diga a AÇÃO, não "OK". */
  rotuloConfirmar: string;
  /** `perigo` deixa o botão vermelho e o foco começa em Cancelar. */
  tom?: "perigo" | "acao";
  aoConfirmar: () => void;
};

/**
 * Confirmação de ação consequente, no lugar do `confirm()` do navegador.
 *
 * Havia cinco: excluir tarefa, excluir meta, excluir credencial, ganhar
 * negócio e concluir implantação. Todos funcionavam — a caixa nativa é
 * acessível e bloqueia de verdade —, mas ela é o elemento que mais denuncia
 * "sistema interno": fonte do sistema operacional, o domínio da Vercel no
 * cabeçalho, botões em inglês em máquina com idioma diferente, e nenhuma
 * chance de dizer o que vai acontecer além de uma linha.
 *
 * O que a troca preserva: continua sendo BLOQUEANTE em intenção — nada
 * acontece até alguém confirmar — e continua sendo o último passo antes de
 * uma ação irreversível.
 *
 * O que a troca ganha: um título e uma descrição separados, o texto do
 * botão dizendo a ação ("Excluir tarefa" em vez de "OK"), Escape para
 * desistir, e o foco começando em Cancelar quando a ação é destrutiva —
 * de modo que apertar Enter por reflexo não apague nada.
 */
export function useConfirm() {
  const [pedido, setPedido] = useState<Pedido | null>(null);

  const pedirConfirmacao = useCallback((p: Pedido) => setPedido(p), []);

  const dialogo = pedido ? (
    <ConfirmDialog
      pedido={pedido}
      aoFechar={() => setPedido(null)}
      aoConfirmar={() => {
        // Fecha ANTES de executar: a ação costuma abrir um `startTransition`
        // que desmonta a tela inteira (excluir tarefa fecha o painel), e o
        // diálogo não pode tentar se fechar depois de já ter sumido junto.
        const executar = pedido.aoConfirmar;
        setPedido(null);
        executar();
      }}
    />
  ) : null;

  return { pedirConfirmacao, dialogo };
}

function ConfirmDialog({
  pedido,
  aoFechar,
  aoConfirmar,
}: {
  pedido: Pedido;
  aoFechar: () => void;
  aoConfirmar: () => void;
}) {
  const perigo = pedido.tom === "perigo";
  return (
    <Modal onClose={aoFechar} widthClass="w-full md:w-[400px]">
      <div className="flex flex-col gap-4 p-5.5">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-title font-medium">{pedido.titulo}</h2>
          {pedido.descricao && (
            <p className="text-small leading-relaxed text-muted">{pedido.descricao}</p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          {/* Numa ação destrutiva o foco começa aqui: Enter por reflexo
              desiste, não apaga. Numa ação positiva o foco vai no confirmar. */}
          <Button variant="ghost" onClick={aoFechar} autoFocus={perigo}>
            Cancelar
          </Button>
          <Button
            variant={perigo ? "danger" : "primary"}
            onClick={aoConfirmar}
            autoFocus={!perigo}
          >
            {pedido.rotuloConfirmar}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

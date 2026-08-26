"use client";

import { useEffect, useRef } from "react";

/**
 * O que pode receber foco por teclado dentro de uma camada. O
 * `:not([disabled])` importa: o botão "Criar tarefa" fica desabilitado
 * enquanto falta a conta, e prender o Tab nele deixaria a pessoa sem saída.
 */
const FOCAVEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * O comportamento de teclado que faltava em toda camada do app: sair no
 * `Escape`, receber o foco ao abrir, devolvê-lo a quem abriu ao fechar, e
 * não deixar o Tab escapar para a página atrás — que continua lá, rolável
 * e clicável, mas inerte enquanto a camada está aberta.
 *
 * O ouvinte fica no painel, não no `document`, para que duas camadas
 * empilhadas (o painel da tarefa com um modal por cima) fechem uma de cada
 * vez, na ordem em que a pessoa as abriu.
 */
function useCamada(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const painel = ref.current;
    if (!painel) return;
    const anterior = document.activeElement as HTMLElement | null;

    // Só puxa o foco se ninguém dentro já o tiver: `autoFocus` (o título em
    // "Nova tarefa", o nome em "Novo negócio") roda antes deste efeito, e
    // roubá-lo de volta desfaria a intenção de quem escreveu a tela.
    if (!painel.contains(document.activeElement)) painel.focus();

    return () => {
      // Se quem abriu saiu do DOM — o cartão de uma tarefa que o próprio
      // fechamento removeu, por exemplo — `focus` não faz nada, e tudo bem.
      anterior?.focus?.();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Escape" && e.key !== "Tab") return;

    // A camada de cima é dona do teclado. Sem isto, um diálogo de
    // confirmação aberto DENTRO de uma gaveta (é o caso de "Ganhar" no
    // Pipeline e "Concluir" na Implantação) deixaria os dois painéis
    // reagindo à mesma tecla: o Escape fecharia os dois de uma vez, e o
    // Tab seria corrigido duas vezes, porque a lista de focáveis da gaveta
    // inclui os botões do diálogo — que é descendente dela no DOM.
    e.stopPropagation();

    if (e.key === "Escape") {
      onClose();
      return;
    }

    const painel = ref.current;
    if (!painel) return;

    // `offsetParent` nulo é o jeito barato de descartar o que está
    // escondido: vários botões de excluir só aparecem no hover do grupo, e
    // parar o Tab num deles seria parar num lugar invisível.
    const itens = Array.from(painel.querySelectorAll<HTMLElement>(FOCAVEL)).filter(
      (el) => el.offsetParent !== null
    );
    if (itens.length === 0) return;

    const primeiro = itens[0];
    const ultimo = itens[itens.length - 1];
    const atual = document.activeElement;

    if (e.shiftKey && (atual === primeiro || atual === painel)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && atual === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  return { ref, onKeyDown };
}

/**
 * `widthClass` sempre precisa de um valor `w-full` (ou equivalente) abaixo
 * de `md:` — a versão fixa em pixel vale só a partir de `md:` (768px), o
 * mesmo limite que o resto do app (Sidebar, Topbar, os quadros) já usa para
 * celular vs desktop. Sem isso, a gaveta/modal estoura a tela em qualquer
 * celular em retrato.
 */
export function Slideover({
  onClose,
  children,
  widthClass = "w-full md:w-[520px]",
}: {
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}) {
  const { ref, onKeyDown } = useCamada(onClose);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/20" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        // A sombra da gaveta fica FORA da escala, de propósito: `shadow-overlay`
        // lança para baixo, e esta gaveta encosta na borda direita da janela —
        // uma sombra vertical some contra a borda. Esta lança para a esquerda,
        // que é o lado por onde ela precisa se separar da página. É o único
        // lugar do app com sombra direcional, então ela vive aqui em vez de
        // virar um quarto token que ninguém mais usaria.
        className={`flex h-full ${widthClass} flex-col border-l border-border bg-surface shadow-[-14px_0_40px_rgba(30,30,28,.12)] outline-none animate-slide-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * `widthClass` sempre precisa de um valor `w-full` (ou equivalente) abaixo
 * de `md:` — a versão fixa em pixel vale só a partir de `md:` (768px), o
 * mesmo limite que o resto do app (Sidebar, Topbar, os quadros) já usa para
 * celular vs desktop. Sem isso, a gaveta/modal estoura a tela em qualquer
 * celular em retrato.
 */
export function Modal({
  onClose,
  children,
  widthClass = "w-full md:w-[480px]",
}: {
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}) {
  const { ref, onKeyDown } = useCamada(onClose);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/20 px-4"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`max-h-[88vh] ${widthClass} overflow-y-auto rounded-card border border-border bg-surface shadow-overlay outline-none animate-fade-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

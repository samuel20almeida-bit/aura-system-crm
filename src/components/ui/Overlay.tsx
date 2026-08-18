"use client";

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
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/20" onClick={onClose}>
      <div
        className={`flex h-full ${widthClass} flex-col border-l border-border bg-surface shadow-[-14px_0_40px_rgba(30,30,28,.12)] animate-slide-in`}
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
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/20 px-4" onClick={onClose}>
      <div
        className={`max-h-[88vh] ${widthClass} overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl animate-fade-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

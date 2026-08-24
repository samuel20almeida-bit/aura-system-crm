"use client";

import clsx from "clsx";
import { createContext, useContext, useId } from "react";

const inputClass =
  "rounded-lg border border-border bg-bone px-3 py-2 text-sm outline-none focus:border-accent";

/**
 * O `id` que o `Field` sorteia para ligar o rótulo ao controle.
 *
 * É contexto, e não `cloneElement` no filho, porque há `Field` cujo filho
 * não é um elemento único: `CATEGORIA` (CredentialModal) e `ÁREA`
 * (NewTaskModal) alternam entre um `Input` e um `Select` conforme o painel
 * de "cadastrar novo" esteja aberto. Clonar exigiria filho único e
 * quebraria nesses dois; o contexto atravessa qualquer aninhamento e é
 * simplesmente ignorado por quem não é campo — o `Tag` de "Contas
 * indisponíveis", por exemplo, vive dentro de um `Field` e não usa nada.
 *
 * Um `Field` com DOIS controles visíveis ao mesmo tempo faria os dois
 * receberem o mesmo `id`, que é HTML inválido. Hoje isso não acontece: os
 * dois casos com dois controles são ramos mutuamente exclusivos. Se algum
 * dia precisar de dois de verdade, passe `id` explícito em pelo menos um —
 * o `id` recebido por prop sempre vence o do contexto.
 */
const FieldIdContext = createContext<string | undefined>(undefined);

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <FieldIdContext.Provider value={id}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="label">
          {label}
        </label>
        {children}
      </div>
    </FieldIdContext.Provider>
  );
}

export function Input({
  id,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const fieldId = useContext(FieldIdContext);
  return <input id={id ?? fieldId} className={clsx(inputClass, className)} {...rest} />;
}

export function Textarea({
  id,
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const fieldId = useContext(FieldIdContext);
  return (
    <textarea
      id={id ?? fieldId}
      className={clsx(inputClass, "resize-none", className)}
      {...rest}
    />
  );
}

export function Select({
  id,
  className,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const fieldId = useContext(FieldIdContext);
  return <select id={id ?? fieldId} className={clsx(inputClass, className)} {...rest} />;
}

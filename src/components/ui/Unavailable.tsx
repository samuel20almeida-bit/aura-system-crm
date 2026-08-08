import { Card } from "@/components/ui/Card";

/**
 * O que a tela mostra quando a consulta ao banco falhou. Existe para que
 * nenhuma página precise inventar um "0" ou um "nada por aqui" a partir de uma
 * resposta que nunca chegou — o mesmo princípio da sentinela do sino
 * (src/lib/data/notifications.ts), com a mesma frase.
 */
export function Unavailable({ title, className }: { title: string; className?: string }) {
  return (
    <Card danger className={className ? `flex flex-col gap-1 p-4 ${className}` : "flex flex-col gap-1 p-4"}>
      <span className="text-[13px] font-medium">{title}</span>
      <span className="font-mono text-[11px] text-muted">
        A consulta ao banco falhou — recarregue a página em instantes.
      </span>
    </Card>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { vincularSalao } from "@/lib/actions/clubcut";
import { formatCurrencyCompact } from "@/lib/format";
import type { Frescor } from "@/lib/clubcut";

export type LinhaDaOperacao = {
  contaId: string;
  contaNome: string;
  salaoNome: string;
  salaoAtivo: boolean;
  frescor: Frescor | null;
  /** Nulo = vínculo existe, mas nenhum dia da janela chegou para este salão. */
  resumo: {
    barbeiros: number;
    conversas: number;
    agendamentosAgente: number;
    agendamentosTotal: number;
    participacao: number | null;
    valorGerado: number;
    custoIaUsd: number | null;
    diasComCusto: number;
    dias: number;
    execucoesErro: number;
  } | null;
};

export type OpcaoDeConta = { id: string; nome: string };
export type OpcaoDeSalao = { salon_id: string; nome: string };

function TagDoFrescor({ frescor }: { frescor: Frescor | null }) {
  if (!frescor) return <span className="text-faint">nunca</span>;
  if (frescor.estado === "ok") {
    return <span className="text-muted">{frescor.dias === 0 ? "hoje" : "ontem"}</span>;
  }
  // Atrasado e parado viram tag, e não texto cinza, porque são a falha
  // silenciosa desta tela: sem destaque, um sincronizador parado se lê como
  // um cliente que deixou de usar.
  return (
    <Tag tone={frescor.estado === "parado" ? "red" : "amber"} dot>
      há {frescor.dias} dias
    </Tag>
  );
}

function Numero({ children, forte = false }: { children: React.ReactNode; forte?: boolean }) {
  return (
    <td className={forte ? "py-2 pr-3 tabular-nums font-medium" : "py-2 pr-3 tabular-nums text-muted"}>
      {children}
    </td>
  );
}

export function OperacaoClient({
  linhas,
  contasSemVinculo,
  saloesLivres,
  janelaDias,
}: {
  linhas: LinhaDaOperacao[];
  contasSemVinculo: OpcaoDeConta[];
  saloesLivres: OpcaoDeSalao[];
  janelaDias: number;
}) {
  const { notify } = useToast();
  const { pedirConfirmacao, dialogo } = useConfirm();
  const [pendente, startTransition] = useTransition();
  const [contaEscolhida, setContaEscolhida] = useState("");
  const [salaoEscolhido, setSalaoEscolhido] = useState("");

  function desvincular(linha: LinhaDaOperacao) {
    pedirConfirmacao({
      titulo: "Desligar do ClubCut?",
      descricao: `"${linha.contaNome}" deixa de mostrar a operação de "${linha.salaoNome}". O uso já recebido continua guardado, e religar traz tudo de volta.`,
      rotuloConfirmar: "Desligar",
      tom: "perigo",
      aoConfirmar: () =>
        startTransition(async () => {
          try {
            await vincularSalao(linha.contaId, null);
            notify("success", "Conta desligada do ClubCut.");
          } catch {
            notify("error", "Não foi possível desligar a conta. Tente novamente.");
          }
        }),
    });
  }

  function vincular(e: React.FormEvent) {
    e.preventDefault();
    if (!contaEscolhida || !salaoEscolhido) return;
    startTransition(async () => {
      try {
        await vincularSalao(contaEscolhida, salaoEscolhido);
        setContaEscolhida("");
        setSalaoEscolhido("");
        notify("success", "Conta ligada ao ClubCut.");
      } catch {
        notify("error", "Não foi possível ligar a conta. Tente novamente.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {dialogo}

      <Card className="p-0">
        {linhas.length === 0 ? (
          <EmptyState
            plain
            title="Nenhuma conta ligada ao ClubCut ainda"
            sub="Ligue uma conta a um salão abaixo para ver a operação dela aqui."
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[760px] text-body">
              <thead>
                <tr className="text-left">
                  {["Conta", "Barbeiros", "Conversas", "Agendamentos", "Valor gerado", "Custo de IA", "Sincronizado", ""].map(
                    (coluna, i) => (
                      <th
                        key={coluna || `acao-${i}`}
                        className="label bg-surface py-2 pr-3 shadow-[inset_0_-1px_0_var(--color-border)]"
                      >
                        {coluna}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => (
                  <tr key={linha.contaId} className="group border-b border-border-soft last:border-b-0">
                    <td className="py-2 pr-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{linha.contaNome}</span>
                        <span className="text-small text-faint">
                          {linha.salaoNome}
                          {!linha.salaoAtivo && " · inativo lá"}
                        </span>
                      </div>
                    </td>
                    {linha.resumo === null ? (
                      // Vínculo sem dado é um estado real e diferente de zero:
                      // ou o salão foi ligado agora, ou o sincronizador não
                      // mandou nada desta janela.
                      <td colSpan={5} className="py-2 pr-3 text-small text-faint">
                        Sem uso recebido nos últimos {janelaDias} dias.
                      </td>
                    ) : (
                      <>
                        <Numero>{linha.resumo.barbeiros}</Numero>
                        <Numero>{linha.resumo.conversas}</Numero>
                        <Numero>
                          {linha.resumo.agendamentosAgente}
                          <span className="text-faint"> / {linha.resumo.agendamentosTotal}</span>
                          {linha.resumo.participacao !== null && (
                            <span className="ml-1.5 text-small text-faint">
                              {Math.round(linha.resumo.participacao * 100)}%
                            </span>
                          )}
                        </Numero>
                        <Numero forte>{formatCurrencyCompact(linha.resumo.valorGerado)}</Numero>
                        <td className="py-2 pr-3 tabular-nums text-muted">
                          {linha.resumo.diasComCusto === 0 ? (
                            // "—" e não "US$ 0,00": ninguém mediu. A instrumentação
                            // (`consumo_ia`, no ClubCut) ainda não existe, e um zero
                            // aqui viraria margem inventada na conversa de preço.
                            <span className="text-faint" title="O ClubCut ainda não registra custo de IA">
                              —
                            </span>
                          ) : (
                            <>
                              US$ {linha.resumo.custoIaUsd!.toFixed(2)}
                              {linha.resumo.diasComCusto < linha.resumo.dias && (
                                <span className="ml-1 text-small text-faint">
                                  ({linha.resumo.diasComCusto}/{linha.resumo.dias} dias)
                                </span>
                              )}
                            </>
                          )}
                        </td>
                      </>
                    )}
                    <td className="py-2 pr-3 text-small">
                      <TagDoFrescor frescor={linha.frescor} />
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => desvincular(linha)}
                        disabled={pendente}
                        // Mesmo padrão dos outros destrutivos da casa: escondido
                        // no hover só onde há hover. No toque, `md:opacity-0`
                        // não vale e o botão fica sempre visível — senão não
                        // haveria como desligar pelo celular.
                        className="font-mono text-label text-faint transition-opacity duration-fast hover:text-red md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
                      >
                        desligar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <form onSubmit={vincular} className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <Field label="Conta do CRM">
              <Select
                value={contaEscolhida}
                onChange={(e) => setContaEscolhida(e.target.value)}
                disabled={contasSemVinculo.length === 0}
              >
                <option value="">
                  {contasSemVinculo.length === 0 ? "Todas as contas já estão ligadas" : "Escolha a conta…"}
                </option>
                {contasSemVinculo.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Salão no ClubCut">
              <Select
                value={salaoEscolhido}
                onChange={(e) => setSalaoEscolhido(e.target.value)}
                disabled={saloesLivres.length === 0}
              >
                <option value="">
                  {saloesLivres.length === 0 ? "Nenhum salão livre" : "Escolha o salão…"}
                </option>
                {saloesLivres.map((s) => (
                  <option key={s.salon_id} value={s.salon_id}>
                    {s.nome}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="submit" disabled={pendente || !contaEscolhida || !salaoEscolhido}>
            {pendente ? "Ligando…" : "Ligar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Slideover } from "@/components/ui/Overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { beginMutation } from "@/lib/realtime/mutation-gate";
import { atualizarConta, atualizarNegocio, ganharNegocio, moverNegocioParaEstagio, perderNegocio } from "@/lib/actions/deals";
import { normalizeLinkUrl } from "@/lib/links";
import { ROTULO_DA_SAUDE, diasParado, rotuloVencimento, saudeDoNegocio } from "@/lib/negocios";
import { useAutoSave } from "@/lib/use-autosave";
import { ESTAGIOS, type EstagioId } from "./PipelineBoard";
import type { NegocioAberto } from "@/lib/data/deals";
import { useConfirm } from "@/components/ui/ConfirmDialog";

/**
 * A gaveta do negócio: abre sobre o quadro, não navega.
 *
 * O pai monta este componente com `key={negocio.id}`, então trocar de negócio
 * remonta e os campos abaixo voltam a nascer do dado do servidor — sem isso o
 * texto digitado num negócio apareceria no seguinte.
 */
export function NegocioDrawer({
  negocio,
  agora,
  onClose,
}: {
  negocio: NegocioAberto;
  agora: Date;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const [pendente, startTransition] = useTransition();
  const { pedirConfirmacao, dialogo } = useConfirm();
  // Transição própria para o seletor otimista: `pendente` é o estado dos
  // botões "Ganhar"/"Perder" do rodapé, e uma troca de estágio não pode
  // desabilitá-los nem trocar seus rótulos enquanto nada está sendo ganho ou
  // perdido.
  const [, startTrocaEstagio] = useTransition();

  // O estágio responde no clique. `useOptimistic` reverte sozinho quando a
  // transição termina: se a escrita deu certo, o payload novo da action já
  // traz `negocio.estagio` igual ao otimista e a troca é imperceptível; se
  // falhou, o valor volta ao anterior e o toast explica. Mesmo padrão do
  // progresso da meta (`MetasClient.tsx`) e do arraste dos quadros.
  const [estagioOtimista, setEstagioOtimista] = useOptimistic(negocio.estagio);

  function trocarEstagio(novo: EstagioId) {
    startTrocaEstagio(async () => {
      setEstagioOtimista(novo);
      const end = beginMutation();
      try {
        await moverNegocioParaEstagio(negocio.id, novo);
      } catch (erro) {
        console.error("[pipeline] falha ao mover o negócio de estágio:", erro);
        notify("error", "Não foi possível mover o negócio de estágio. Tente de novo — se persistir, me avise.");
      } finally {
        end();
      }
    });
  }

  const [proximoPasso, setProximoPasso] = useState(negocio.proximo_passo ?? "");
  const [proximoPassoEm, setProximoPassoEm] = useState(negocio.proximo_passo_em ?? "");
  const [setup, setSetup] = useState(negocio.setup === null ? "" : String(negocio.setup));
  const [mrr, setMrr] = useState(negocio.mrr === null ? "" : String(negocio.mrr));
  const [pedindoMotivo, setPedindoMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [acaoAtual, setAcaoAtual] = useState<"ganhar" | "perder" | null>(null);

  const [contaNome, setContaNome] = useState(negocio.conta?.nome ?? "");
  const [contaNicho, setContaNicho] = useState(negocio.conta?.nicho ?? "");
  const [contaCidade, setContaCidade] = useState(negocio.conta?.cidade ?? "");
  const [contaUf, setContaUf] = useState(negocio.conta?.uf ?? "");
  const [contaDecisor, setContaDecisor] = useState(negocio.conta?.decisor_nome ?? "");
  const [contaSoftware, setContaSoftware] = useState(negocio.conta?.software_atual ?? "");
  const [contaOrigem, setContaOrigem] = useState(negocio.conta?.origem ?? "");
  const [contaEmail, setContaEmail] = useState(negocio.conta?.email ?? "");
  const [contaTelefone, setContaTelefone] = useState(negocio.conta?.telefone ?? "");
  const [contaSite, setContaSite] = useState(negocio.conta?.site ?? "");

  const contaNomeValido = contaNome.trim() !== "";
  const contaAutoSaveStatus = useAutoSave({
    value: {
      nome: contaNome,
      nicho: contaNicho,
      cidade: contaCidade,
      uf: contaUf,
      decisorNome: contaDecisor,
      softwareAtual: contaSoftware,
      origem: contaOrigem,
      email: contaEmail,
      telefone: contaTelefone,
      site: contaSite,
    },
    enabled: contaNomeValido,
    isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    onSave: async (v) => {
      // Mesmo padrão de `executar()` (beginMutation/end, sem refresh — ver o
      // comentário ali) — o autosave não é uma exceção à regra do portão. Sem
      // `catch` aqui de propósito: o erro precisa SUBIR para `createAutoSaver`
      // decidir que o save falhou e chamar `onError` — engolir o erro aqui
      // faria o módulo achar que salvou com sucesso.
      const end = beginMutation();
      try {
        await atualizarConta({
          contaId: negocio.conta_id,
          nome: v.nome,
          nicho: v.nicho.trim() || null,
          cidade: v.cidade.trim() || null,
          uf: v.uf.trim() || null,
          decisorNome: v.decisorNome.trim() || null,
          softwareAtual: v.softwareAtual.trim() || null,
          origem: v.origem.trim() || null,
          email: v.email.trim() || null,
          telefone: v.telefone.trim() || null,
          site: v.site.trim() || null,
        });
      } finally {
        end();
      }
    },
    onError: (erro) => {
      console.error("[pipeline] falha ao salvar a conta:", erro);
      notify("error", "Não foi possível salvar a conta. Tente de novo — se persistir, me avise.");
    },
  });
  const contaEmErro = !contaNomeValido || contaAutoSaveStatus === "erro";
  const contaStatusTexto = !contaNomeValido
    ? "nome não pode ficar vazio"
    : contaAutoSaveStatus === "erro"
      ? "não foi possível salvar"
      : contaAutoSaveStatus === "salvando"
        ? "salvando…"
        : contaAutoSaveStatus === "salvo"
          ? "salvo"
          : "";

  const saude = saudeDoNegocio(
    {
      proximoPasso: negocio.proximo_passo,
      proximoPassoEm: negocio.proximo_passo_em,
      mexidoEm: negocio.mexido_em,
    },
    agora
  );
  const vencimento = rotuloVencimento(negocio.proximo_passo_em, agora);

  // Sem `router.refresh()`: as actions que passam por aqui (`ganharNegocio`,
  // `perderNegocio`) chamam `revalidatePath("/pipeline")`, e o Next devolve o
  // payload novo desta rota junto com a resposta da action. Um refresh depois
  // disso renderizaria a rota inteira uma segunda vez — ~9 idas ao servidor
  // repetidas com a gaveta travada. Ver a auditoria action × rota no plano da
  // 5F. `moverNegocioParaEstagio` segue o mesmo raciocínio, mas por um
  // caminho e uma transição próprios — `trocarEstagio`/`startTrocaEstagio`,
  // acima — porque a resposta some no `useOptimistic` em vez de passar por
  // aqui.
  /** As escritas da gaveta que não têm valor otimista próprio passam por aqui: portão, aviso em caso de falha, e a janela continua aberta. */
  function executar(oQue: string, acao: () => Promise<unknown>, depois?: () => void) {
    startTransition(async () => {
      const end = beginMutation();
      try {
        await acao();
        depois?.();
      } catch (erro) {
        console.error(`[pipeline] falha ao ${oQue}:`, erro);
        notify("error", `Não foi possível ${oQue}. Tente de novo — se persistir, me avise.`);
        setAcaoAtual(null);
      } finally {
        end();
      }
    });
  }

  function numeroOuNulo(valor: string): number | null {
    const limpo = valor.trim();
    if (limpo === "") return null;
    const numero = Number(limpo);
    return Number.isFinite(numero) ? numero : null;
  }

  // Os campos têm `min="0"`, mas os botões não estão dentro de um `<form>` — a
  // restrição nativa do navegador nunca dispara. O servidor recusa o valor
  // negativo, mas sem isto o toast de erro que o usuário veria é o genérico
  // ("não foi possível salvar"), que não diz o que corrigir. Barrar aqui é o
  // mesmo raciocínio do botão "Confirmar perda", desabilitado até o motivo
  // deixar de estar vazio.
  const valoresInvalidos = (numeroOuNulo(setup) ?? 0) < 0 || (numeroOuNulo(mrr) ?? 0) < 0;

  const negocioAutoSaveStatus = useAutoSave({
    value: { proximoPasso, proximoPassoEm, setup, mrr },
    enabled: !valoresInvalidos,
    isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    onSave: async (v) => {
      // Mesmo padrão de `executar()` (beginMutation/end, sem refresh); sem
      // `catch` pelo mesmo motivo do onSave da conta acima — o erro precisa
      // chegar em `createAutoSaver`.
      const end = beginMutation();
      try {
        await atualizarNegocio({
          negocioId: negocio.id,
          proximoPasso: v.proximoPasso.trim() || null,
          proximoPassoEm: v.proximoPassoEm || null,
          setup: numeroOuNulo(v.setup),
          mrr: numeroOuNulo(v.mrr),
        });
      } finally {
        end();
      }
    },
    onError: (erro) => {
      console.error("[pipeline] falha ao salvar o próximo passo:", erro);
      notify("error", "Não foi possível salvar o próximo passo. Tente de novo — se persistir, me avise.");
    },
  });
  const negocioEmErro = valoresInvalidos || negocioAutoSaveStatus === "erro";
  const negocioStatusTexto = valoresInvalidos
    ? "valores não podem ser negativos"
    : negocioAutoSaveStatus === "erro"
      ? "não foi possível salvar"
      : negocioAutoSaveStatus === "salvando"
        ? "salvando…"
        : negocioAutoSaveStatus === "salvo"
          ? "salvo"
          : "";

  // Vira link só quando o valor digitado dá um endereço de verdade — mesma
  // normalização do link de anexo (src/lib/links.ts), aqui só para decidir se
  // o "abrir site" aparece, não para validar (isso o servidor já faz ao
  // salvar).
  const emailHref = contaEmail.trim() ? `mailto:${contaEmail.trim()}` : null;
  const telefoneHref = contaTelefone.trim() ? `tel:${contaTelefone.trim()}` : null;
  const siteNormalizado = contaSite.trim() ? normalizeLinkUrl(contaSite) : null;
  const siteHref = siteNormalizado?.ok ? siteNormalizado.url : null;

  return (
    <Slideover onClose={onClose}>
      {dialogo}
      <div className="flex items-start gap-2.5 border-b border-border px-5.5 py-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-medium">{negocio.conta?.nome ?? "Conta sem nome"}</div>
          <div className="mt-0.5 font-mono text-[11px] text-muted">
            {ROTULO_DA_SAUDE[saude]} · parado há {diasParado(negocio.mexido_em, agora)}d
          </div>
        </div>
        <Avatar initials={negocio.dono?.initials} size="sm" ghost={!negocio.dono} />
        <button onClick={onClose} className="text-[15px] text-muted hover:text-ink" aria-label="Fechar">
          ✕
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4.5 overflow-y-auto scrollbar-thin px-5.5 py-4">
        <div className="flex flex-col gap-3.5">
          <div className="label">A CONTA</div>
          <Field label="NOME">
            <Input value={contaNome} onChange={(e) => setContaNome(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="NICHO">
              <Input value={contaNicho} onChange={(e) => setContaNicho(e.target.value)} />
            </Field>
            <div className="grid grid-cols-[1fr_72px] gap-3">
              <Field label="CIDADE">
                <Input value={contaCidade} onChange={(e) => setContaCidade(e.target.value)} />
              </Field>
              <Field label="UF">
                <Input value={contaUf} onChange={(e) => setContaUf(e.target.value.toUpperCase())} maxLength={2} />
              </Field>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="DECISOR">
              <Input value={contaDecisor} onChange={(e) => setContaDecisor(e.target.value)} />
            </Field>
            <Field label="SOFTWARE ATUAL">
              <Input value={contaSoftware} onChange={(e) => setContaSoftware(e.target.value)} />
            </Field>
          </div>
          <Field label="ORIGEM">
            <Input value={contaOrigem} onChange={(e) => setContaOrigem(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="E-MAIL">
              <Input type="email" value={contaEmail} onChange={(e) => setContaEmail(e.target.value)} />
              {emailHref && (
                <a href={emailHref} className="text-[11px] text-accent hover:underline">
                  enviar e-mail
                </a>
              )}
            </Field>
            <Field label="TELEFONE">
              <Input type="tel" value={contaTelefone} onChange={(e) => setContaTelefone(e.target.value)} />
              {telefoneHref && (
                <a href={telefoneHref} className="text-[11px] text-accent hover:underline">
                  ligar
                </a>
              )}
            </Field>
          </div>
          <Field label="SITE">
            <Input value={contaSite} onChange={(e) => setContaSite(e.target.value)} placeholder="cliente.com.br" />
            {siteHref && (
              <a
                href={siteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-accent hover:underline"
              >
                abrir site
              </a>
            )}
          </Field>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-muted">Dono: {negocio.dono?.full_name ?? "—"}</span>
            <span className={`font-mono text-[11px] ${contaEmErro ? "text-red" : "text-muted"}`}>
              {contaStatusTexto}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="label">O NEGÓCIO</div>
          {/* Único jeito de mudar de estágio sem arrastar: o quadro não tem
              KeyboardSensor, e o arraste fica desabilitado no celular. Sem
              isto, o Pipeline vira somente-leitura fora do desktop com mouse. */}
          <Field label="ESTÁGIO">
            <Select value={estagioOtimista} onChange={(e) => trocarEstagio(e.target.value as EstagioId)}>
              {ESTAGIOS.map((estagio) => (
                <option key={estagio.id} value={estagio.id}>
                  {estagio.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="PRÓXIMO PASSO">
            <Textarea
              rows={2}
              value={proximoPasso}
              onChange={(e) => setProximoPasso(e.target.value)}
              placeholder="Ligar para confirmar a proposta"
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="QUANDO">
              <Input type="date" value={proximoPassoEm} onChange={(e) => setProximoPassoEm(e.target.value)} />
            </Field>
            <div className="flex items-end pb-2 font-mono text-[11px] text-muted">
              {vencimento ? `vence ${vencimento}` : "sem data"}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="SETUP (R$)">
              <Input type="number" min="0" step="0.01" value={setup} onChange={(e) => setSetup(e.target.value)} />
            </Field>
            <Field label="MENSALIDADE (R$)">
              <Input type="number" min="0" step="0.01" value={mrr} onChange={(e) => setMrr(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end">
            <span className={`font-mono text-[11px] ${negocioEmErro ? "text-red" : "text-muted"}`}>
              {negocioStatusTexto}
            </span>
          </div>
        </div>

        {pedindoMotivo && (
          <Field label="MOTIVO DA PERDA">
            <Textarea
              autoFocus
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Preço, concorrente, sumiu…"
            />
          </Field>
        )}
      </div>

      {/* `disabled` aqui não é espera de leitura — é guarda contra clique
          duplo numa ação que muda a fase da conta. O seletor de estágio,
          acima, tem transição própria (`startTrocaEstagio`) e não mexe em
          `pendente`: trocar de estágio não pode deixar "Ganhar"/"Perder"
          desabilitados ou trocando de rótulo. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5.5 py-3">
        {pedindoMotivo ? (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setPedindoMotivo(false);
                setMotivo("");
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={pendente || motivo.trim() === ""}
              onClick={() => {
                setAcaoAtual("perder");
                executar("marcar o negócio como perdido", () => perderNegocio(negocio.id, motivo.trim()), onClose);
              }}
            >
              {pendente && acaoAtual === "perder" ? "Marcando como perdido…" : "Confirmar perda"}
            </Button>
          </>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              disabled={pendente}
              onClick={() =>
                pedirConfirmacao({
                  titulo: "Marcar como ganho?",
                  descricao:
                    "O negócio sai do funil e vira uma implantação na esteira. É assim que a venda vira trabalho.",
                  rotuloConfirmar: "Marcar como ganho",
                  aoConfirmar: () => {
                    setAcaoAtual("ganhar");
                    executar("marcar o negócio como ganho", () => ganharNegocio(negocio.id), onClose);
                  },
                })
              }
            >
              {pendente && acaoAtual === "ganhar" ? "Marcando como ganho…" : "Ganhar"}
            </Button>
            <Button variant="danger" disabled={pendente} onClick={() => setPedindoMotivo(true)}>
              Perder
            </Button>
          </div>
        )}
      </div>
    </Slideover>
  );
}

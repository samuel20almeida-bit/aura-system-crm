"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { beginMutation } from "@/lib/realtime/mutation-gate";
import { criarContaComNegocio } from "@/lib/actions/deals";

/**
 * Por onde um negócio entra no sistema — conta e negócio numa operação só.
 *
 * O próximo passo pode ficar vazio, e isso é correto: um negócio que nasce sem
 * próximo passo definido nasce podre, e o quadro vai gritar isso na hora. O
 * sistema existe para não deixar o Samuel esquecer o que vem depois; esconder o
 * esquecimento no cadastro seria desligar o alarme na origem.
 *
 * Não há seleção de plano: `planos` está vazio (o catálogo ainda não foi
 * cadastrado) e setup/mensalidade são digitados. `plano_id` fica nulo.
 */
export function NovoNegocioModal({
  profiles,
  onClose,
}: {
  profiles: { id: string; full_name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pendente, startTransition] = useTransition();

  const [nome, setNome] = useState("");
  const [nicho, setNicho] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [decisor, setDecisor] = useState("");
  const [software, setSoftware] = useState("");
  const [origem, setOrigem] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [site, setSite] = useState("");
  const [setup, setSetup] = useState("");
  const [mrr, setMrr] = useState("");
  const [proximoPasso, setProximoPasso] = useState("");
  const [proximoPassoEm, setProximoPassoEm] = useState("");
  const [donoId, setDonoId] = useState("");

  function numeroOuNulo(valor: string): number | null {
    const limpo = valor.trim();
    if (limpo === "") return null;
    const numero = Number(limpo);
    return Number.isFinite(numero) ? numero : null;
  }

  function textoOuNulo(valor: string): string | null {
    return valor.trim() === "" ? null : valor.trim();
  }

  return (
    <Modal onClose={onClose} widthClass="w-[560px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!nome.trim()) return;
          startTransition(async () => {
            // Mesma disciplina do `useCreateHandler` do CRM: uma falha ao criar
            // não pode deixar a janela aberta e muda — o usuário concluiria que
            // o sistema não permite cadastrar.
            const end = beginMutation();
            try {
              await criarContaComNegocio({
                nome: nome.trim(),
                nicho: textoOuNulo(nicho),
                cidade: textoOuNulo(cidade),
                uf: textoOuNulo(uf.toUpperCase()),
                decisorNome: textoOuNulo(decisor),
                softwareAtual: textoOuNulo(software),
                origem: textoOuNulo(origem),
                email: textoOuNulo(email),
                telefone: textoOuNulo(telefone),
                site: textoOuNulo(site),
                setup: numeroOuNulo(setup),
                mrr: numeroOuNulo(mrr),
                proximoPasso: textoOuNulo(proximoPasso),
                proximoPassoEm: proximoPassoEm || null,
                donoId: donoId || null,
              });
              router.refresh();
              onClose();
            } catch (erro) {
              console.error("[pipeline] falha ao criar o negócio:", erro);
              notify("error", "Não foi possível criar o negócio. Tente de novo — se persistir, me avise.");
            } finally {
              end();
            }
          });
        }}
        className="flex flex-col gap-3.5 p-5.5"
      >
        <h2 className="text-base font-medium">Novo negócio</h2>

        <Field label="CONTA">
          <Input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Clínica, barbearia…"
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="NICHO">
            <Input value={nicho} onChange={(e) => setNicho(e.target.value)} placeholder="Odontologia, barbearia…" />
          </Field>
          <div className="grid grid-cols-[1fr_72px] gap-3">
            <Field label="CIDADE">
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </Field>
            <Field label="UF">
              <Input value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="DECISOR">
            <Input value={decisor} onChange={(e) => setDecisor(e.target.value)} />
          </Field>
          <Field label="SOFTWARE ATUAL">
            <Input value={software} onChange={(e) => setSoftware(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="ORIGEM">
            <Input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Indicação, prospecção…" />
          </Field>
          <Field label="DONO">
            <Select value={donoId} onChange={(e) => setDonoId(e.target.value)}>
              <option value="">—</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="E-MAIL">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@cliente.com" />
          </Field>
          <Field label="TELEFONE">
            <Input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
          </Field>
        </div>
        <Field label="SITE">
          <Input value={site} onChange={(e) => setSite(e.target.value)} placeholder="cliente.com.br" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="SETUP (R$)">
            <Input type="number" min="0" step="0.01" value={setup} onChange={(e) => setSetup(e.target.value)} />
          </Field>
          <Field label="MENSALIDADE (R$)">
            <Input type="number" min="0" step="0.01" value={mrr} onChange={(e) => setMrr(e.target.value)} />
          </Field>
        </div>

        <Field label="PRÓXIMO PASSO">
          <Textarea
            rows={2}
            value={proximoPasso}
            onChange={(e) => setProximoPasso(e.target.value)}
            placeholder="Sem próximo passo, o negócio já nasce apodrecendo"
          />
        </Field>
        <Field label="QUANDO">
          <Input type="date" value={proximoPassoEm} onChange={(e) => setProximoPassoEm(e.target.value)} />
        </Field>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pendente}>
            {pendente ? "Criando…" : "Criar negócio"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

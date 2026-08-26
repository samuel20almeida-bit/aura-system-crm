"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { createReuniao } from "@/lib/actions/reunioes";
import { beginMutation } from "@/lib/realtime/mutation-gate";

/**
 * O horário vem de um `<input type="datetime-local">`, que devolve
 * "YYYY-MM-DDTHH:mm" SEM fuso. `new Date(...)` sobre esse formato interpreta
 * no fuso do NAVEGADOR — que é o que se quer aqui: quem digita "14:00" quer
 * 14:00 onde está. O `toISOString()` converte para UTC na hora de gravar, e
 * `formatarQuando` converte de volta para o fuso do app ao exibir.
 */
function paraISO(local: string): string {
  return new Date(local).toISOString();
}

/**
 * "YYYY-MM-DDTHH:mm" para o campo já nascer preenchido.
 *
 * Sem `dia`, é a próxima hora cheia — o botão do topo não sabe de que dia se
 * está falando. Com `dia` (o quadrado clicado na agenda), é aquele dia às 10h:
 * quem clicou num quadrado já escolheu o dia, e ter de digitá-lo de novo é a
 * pergunta repetida que a agenda existe para evitar. 10h porque é hora de
 * expediente e some do caminho — quem quiser outra troca só a hora.
 */
function valorInicial(dia?: string): string {
  const p = (n: number) => String(n).padStart(2, "0");
  if (dia) return `${dia}T10:00`;
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function NovaReuniaoModal({
  diaSugerido,
  contas,
  contasIndisponiveis,
  onClose,
}: {
  /** "YYYY-MM-DD" do quadrado clicado na agenda. Ausente = veio do botão do topo. */
  diaSugerido?: string;
  contas: { id: string; nome: string }[];
  contasIndisponiveis: boolean;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [contaId, setContaId] = useState("");
  const [quando, setQuando] = useState(() => valorInicial(diaSugerido));
  const [duracao, setDuracao] = useState("60");
  const [pauta, setPauta] = useState("");

  const faltaTitulo = titulo.trim() === "";
  const faltaQuando = quando === "";

  return (
    <Modal onClose={onClose}>
      <form
        className="flex flex-col gap-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (faltaTitulo || faltaQuando) return;
          startTransition(async () => {
            const end = beginMutation();
            try {
              await createReuniao({
                titulo: titulo.trim(),
                contaId: contaId || null,
                aconteceEm: paraISO(quando),
                duracaoMin: duracao === "" ? null : Number(duracao),
                pauta: pauta.trim() === "" ? null : pauta.trim(),
              });
              onClose();
            } catch {
              notify("error", "Não foi possível marcar a reunião. Tente novamente.");
            } finally {
              end();
            }
          });
        }}
      >
        <div className="text-title font-medium">Nova reunião</div>

        <Field label="TÍTULO">
          <Input
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Alinhamento semanal"
          />
        </Field>

        <Field label="CONTA">
          {contasIndisponiveis ? (
            // Mesmo contrato das outras cinco superfícies: um seletor vazio
            // diria "não há contas cadastradas" quando a consulta é que
            // falhou. A reunião interna continua podendo ser marcada.
            <Tag tone="amber">Contas indisponíveis</Tag>
          ) : (
            <Select value={contaId} onChange={(e) => setContaId(e.target.value)}>
              <option value="">Nenhuma (interna)</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="QUANDO">
            <Input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
          </Field>
          <Field label="DURAÇÃO (MIN)">
            <Input
              type="number"
              min={1}
              step={5}
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
              placeholder="60"
            />
          </Field>
        </div>

        <Field label="PAUTA">
          <Textarea
            rows={4}
            value={pauta}
            onChange={(e) => setPauta(e.target.value)}
            placeholder="O que precisa ser decidido nesta reunião."
          />
        </Field>

        <div className="mt-1 flex items-center justify-end gap-2">
          {/* O botão espera os dois campos obrigatórios em vez de deixar
              submeter e falhar no servidor — o modal não tem onde mostrar
              erro de validação sem empurrar o resto da tela. */}
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || faltaTitulo || faltaQuando}>
            {pending ? "Marcando…" : "Marcar reunião"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

import { saudeDoNegocio, type SaudeNegocio } from "./negocios";
import { todayInAppTz } from "./timezone";

/**
 * A unificação de `/hoje`: negócio (próximo passo) e tarefa (não concluída)
 * viram a mesma forma, para que uma lista só saiba ordenar as duas sem saber
 * de onde cada uma veio.
 */
export type ItemHoje = {
  id: string;
  /** Próximo passo do negócio, ou título da tarefa. */
  texto: string;
  /** Nome da conta, ou nome do cliente/"Interno" da tarefa. */
  contexto: string | null;
  donoId: string | null;
  /** `proximo_passo_em` do negócio, ou `due_date` da tarefa. */
  vencimento: string | null;
  /** Reusa o vocabulário de `saudeDoNegocio` — não um segundo léxico de cores. */
  saude: SaudeNegocio;
  origem: "negocio" | "tarefa";
};

/**
 * A saúde de uma tarefa, no mesmo vocabulário de `saudeDoNegocio`.
 *
 * Assimétrica com negócio DE PROPÓSITO: lá, sem próximo passo é `"podre"`
 * desde o nascimento. Aqui, tarefa sem `due_date` é `"ok"` — nenhuma tela do
 * projeto jamais tratou tarefa sem prazo como alarme (`TaskCard.tsx`:
 * `task.due_date && ...` curto-circuita em falso), e esta função só isola o
 * comportamento que já está em produção, não inventa um novo.
 */
export function saudeDaTarefa(dueDate: string | null, agora: Date = new Date()): SaudeNegocio {
  if (!dueDate) return "ok";
  const hoje = todayInAppTz(agora);
  if (dueDate < hoje) return "podre";
  if (dueDate === hoje) return "atencao";
  return "ok";
}

export type NegocioParaItemHoje = {
  id: string;
  proximoPasso: string | null;
  proximoPassoEm: string | null;
  mexidoEm: string;
  donoId: string | null;
  contaNome: string | null;
};

export function negocioParaItemHoje(negocio: NegocioParaItemHoje, agora: Date = new Date()): ItemHoje {
  const semProximoPasso = !negocio.proximoPasso || negocio.proximoPasso.trim() === "";
  return {
    id: negocio.id,
    // Mesmo rótulo do cartão do Pipeline (NegocioCard.tsx) para o mesmo estado.
    texto: semProximoPasso ? "Sem próximo passo" : (negocio.proximoPasso as string),
    contexto: negocio.contaNome,
    donoId: negocio.donoId,
    vencimento: negocio.proximoPassoEm,
    saude: saudeDoNegocio(
      {
        proximoPasso: negocio.proximoPasso,
        proximoPassoEm: negocio.proximoPassoEm,
        mexidoEm: negocio.mexidoEm,
      },
      agora
    ),
    origem: "negocio",
  };
}

export type TarefaParaItemHoje = {
  id: string;
  titulo: string;
  dueDate: string | null;
  donoId: string | null;
  clienteNome: string | null;
};

export function tarefaParaItemHoje(tarefa: TarefaParaItemHoje, agora: Date = new Date()): ItemHoje {
  return {
    id: tarefa.id,
    texto: tarefa.titulo,
    contexto: tarefa.clienteNome ?? "Interno",
    donoId: tarefa.donoId,
    vencimento: tarefa.dueDate,
    saude: saudeDaTarefa(tarefa.dueDate, agora),
    origem: "tarefa",
  };
}

const ORDEM_SAUDE: Record<SaudeNegocio, number> = { podre: 0, atencao: 1, ok: 2 };

/**
 * Ordena por urgência sem saber nada sobre a origem do item — só olha
 * `saude`, `vencimento` e, por último, `texto`. É esta função, e não as duas
 * de mapeamento acima, que aceita uma terceira fonte (implantação, Fase 3B)
 * sem reescrita: quem chamar monta o array de `ItemHoje` a partir de três
 * fontes em vez de duas e passa pra cá — a urgência não muda uma linha.
 */
export function ordenarPorUrgencia(itens: ItemHoje[]): ItemHoje[] {
  return [...itens].sort((a, b) => {
    const diffSaude = ORDEM_SAUDE[a.saude] - ORDEM_SAUDE[b.saude];
    if (diffSaude !== 0) return diffSaude;

    if (a.vencimento !== b.vencimento) {
      if (a.vencimento === null) return 1;
      if (b.vencimento === null) return -1;
      return a.vencimento < b.vencimento ? -1 : 1;
    }

    // localeCompare, não `<`/`>` ordinal: o desempate é o único lugar em que
    // a ordem chega a depender de acento, e `<`/`>` ordena por code point,
    // não pela ordem alfabética que um leitor em pt-BR espera.
    return a.texto.localeCompare(b.texto, "pt-BR");
  });
}

import { saudeDaTarefa, saudeDoNegocio, type SaudeNegocio } from "./negocios";
import { saudeDaImplantacao, vencimentoDaEtapa } from "./implantacoes";

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
  origem: "negocio" | "tarefa" | "implantacao";
};

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

export type ImplantacaoParaItemHoje = {
  id: string;
  etapaNome: string;
  etapaDesde: string;
  slaDias: number;
  espera: "nos" | "cliente";
  donoId: string | null;
  contaNome: string | null;
};

export function implantacaoParaItemHoje(implantacao: ImplantacaoParaItemHoje, agora: Date = new Date()): ItemHoje {
  const vencimento = vencimentoDaEtapa(implantacao.etapaDesde, implantacao.slaDias);
  return {
    id: implantacao.id,
    texto: implantacao.etapaNome,
    contexto: implantacao.contaNome,
    donoId: implantacao.donoId,
    vencimento,
    saude: saudeDaImplantacao(vencimento, implantacao.espera, agora),
    origem: "implantacao",
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

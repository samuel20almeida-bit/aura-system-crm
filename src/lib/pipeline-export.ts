import { montarCsv, dataParaCsv, type Coluna } from "./csv";
import { ROTULO_DA_SAUDE, diasParado, saudeDoNegocio } from "./negocios";
import { todayInAppTz } from "./timezone";
import type { Database } from "./supabase/database.types";

/**
 * O export do Pipeline: uma linha por negócio, com a empresa e o contato
 * juntos.
 *
 * Empresa e contato numa linha só, e não em dois arquivos, porque é assim que
 * o arquivo é usado — abrir a planilha e sair ligando. Normalizar em duas
 * tabelas obrigaria a cruzar por id antes de usar, e ninguém faz PROCV para
 * ligar para uma barbearia.
 */

type LinhaExportavel = {
  estagio: Database["public"]["Enums"]["negocio_estagio"];
  mexido_em: string;
  proximo_passo: string | null;
  proximo_passo_em: string | null;
  setup: number | string | null;
  mrr: number | string | null;
  criado_em?: string | null;
  conta: {
    nome: string | null;
    nicho: string | null;
    cidade: string | null;
    uf: string | null;
    decisor_nome: string | null;
    software_atual: string | null;
    origem: string | null;
    email: string | null;
    telefone: string | null;
    site: string | null;
  } | null;
  dono: { full_name: string | null } | null;
};

/**
 * Em caixa de frase, e não a caixa alta de `ESTAGIOS` no `PipelineBoard`: lá o
 * rótulo é cabeçalho de coluna do quadro, aqui é conteúdo de célula. Mesmo
 * vocabulário, tipografias diferentes — por isso são dois mapas e não uma
 * duplicação por descuido.
 *
 * O `satisfies` é o que impede a divergência silenciosa: criar um estágio novo
 * no enum do banco sem nomeá-lo aqui vira erro de tipo, não uma célula vazia
 * descoberta meses depois numa planilha.
 */
export const ROTULO_DO_ESTAGIO = {
  lead: "Lead",
  contato: "Contato",
  qualificado: "Qualificado",
  diagnostico: "Diagnóstico",
  proposta: "Proposta",
} as const satisfies Record<Database["public"]["Enums"]["negocio_estagio"], string>;

/** Número que veio do Postgres como `numeric` chega em texto. */
function numero(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export function colunasDoPipeline(agora: Date): Coluna<LinhaExportavel>[] {
  return [
    { titulo: "Empresa", valor: (n) => n.conta?.nome ?? "" },
    { titulo: "Nicho", valor: (n) => n.conta?.nicho ?? "" },
    { titulo: "Cidade", valor: (n) => n.conta?.cidade ?? "" },
    { titulo: "UF", valor: (n) => n.conta?.uf ?? "" },
    { titulo: "Decisor", valor: (n) => n.conta?.decisor_nome ?? "" },
    { titulo: "E-mail", valor: (n) => n.conta?.email ?? "" },
    { titulo: "Telefone", valor: (n) => n.conta?.telefone ?? "" },
    { titulo: "Site", valor: (n) => n.conta?.site ?? "" },
    { titulo: "Origem", valor: (n) => n.conta?.origem ?? "" },
    { titulo: "Software atual", valor: (n) => n.conta?.software_atual ?? "" },
    { titulo: "Estágio", valor: (n) => ROTULO_DO_ESTAGIO[n.estagio] ?? n.estagio },
    { titulo: "Setup (R$)", valor: (n) => numero(n.setup) },
    { titulo: "Mensalidade (R$)", valor: (n) => numero(n.mrr) },
    { titulo: "Próximo passo", valor: (n) => n.proximo_passo ?? "" },
    { titulo: "Próximo passo em", valor: (n) => dataParaCsv(n.proximo_passo_em) },
    { titulo: "Dono", valor: (n) => n.dono?.full_name ?? "" },
    // As duas últimas são derivadas, não colunas do banco: são exatamente o
    // que o cartão mostra na tela. Um export que não traz a saúde obrigaria a
    // recalcular "há quanto tempo isto está parado" fora do sistema.
    {
      titulo: "Situação",
      valor: (n) =>
        ROTULO_DA_SAUDE[
          saudeDoNegocio(
            { proximoPasso: n.proximo_passo, proximoPassoEm: n.proximo_passo_em, mexidoEm: n.mexido_em },
            agora
          )
        ],
    },
    { titulo: "Dias parado", valor: (n) => diasParado(n.mexido_em, agora) },
  ];
}

export function montarCsvDoPipeline(negocios: readonly LinhaExportavel[], agora: Date = new Date()): string {
  return montarCsv(colunasDoPipeline(agora), negocios);
}

/**
 * A data no nome do arquivo é o que evita `pipeline (3).csv` na pasta de
 * downloads — e o que permite comparar o de hoje com o da semana passada.
 */
export function nomeDoArquivoDoPipeline(agora: Date = new Date()): string {
  return `pipeline-aura-${todayInAppTz(agora)}.csv`;
}

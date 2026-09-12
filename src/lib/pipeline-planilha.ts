import { ROTULO_DA_SAUDE, diasParado, saudeDoNegocio } from "./negocios";
import { todayInAppTz } from "./timezone";
import type { Database } from "./supabase/database.types";

/**
 * A planilha do Pipeline: um .xlsx de verdade, com duas abas.
 *
 * POR QUE XLSX E NÃO CSV. Um CSV bem feito abre certo no Excel (era o que
 * existia aqui antes), mas não carrega três coisas que esta planilha precisa:
 * número que já chega como número, data que já chega como data, e mais de uma
 * aba. A pergunta que originou este arquivo — "todos os clientes parados" — é
 * um recorte; jogá-lo no mesmo plano do funil inteiro obrigaria a filtrar à
 * mão logo depois de exportar.
 *
 * POR QUE DUAS ABAS, E NÃO SÓ A DOS PARADOS. O recorte só significa alguma
 * coisa ao lado do todo: "58 parados" não diz nada sem saber se o funil tem 60
 * ou 600. As duas viajam juntas no mesmo arquivo, e a aba dos parados vem
 * primeira porque é a que se abre.
 */

export type NegocioParaPlanilha = {
  estagio: Database["public"]["Enums"]["negocio_estagio"];
  mexido_em: string;
  proximo_passo: string | null;
  proximo_passo_em: string | null;
  setup: number | string | null;
  mrr: number | string | null;
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
 * rótulo é cabeçalho de coluna do quadro, aqui é conteúdo de célula.
 *
 * O `satisfies` impede a divergência silenciosa: criar um estágio novo no enum
 * do banco sem nomeá-lo aqui vira erro de tipo, e não uma célula vazia
 * descoberta meses depois numa planilha.
 */
export const ROTULO_DO_ESTAGIO = {
  lead: "Lead",
  contato: "Contato",
  qualificado: "Qualificado",
  diagnostico: "Diagnóstico",
  proposta: "Proposta",
} as const satisfies Record<Database["public"]["Enums"]["negocio_estagio"], string>;

/**
 * PARADO É `podre`, e não um critério novo inventado para o export.
 *
 * É exatamente o que o cabeçalho do Pipeline já conta em "230 apodrecendo" e o
 * que pinta o ponto vermelho no cartão. Um segundo critério aqui faria a
 * planilha discordar da tela que a originou — e a primeira pessoa a notar
 * seria quem confiasse na planilha.
 *
 * Da regra de `saudeDoNegocio`, três caminhos levam a parado: negócio sem
 * próximo passo definido, próximo passo com data já vencida, ou mais de 7 dias
 * sem ninguém mexer.
 */
export function estaParado(negocio: NegocioParaPlanilha, agora: Date): boolean {
  return (
    saudeDoNegocio(
      {
        proximoPasso: negocio.proximo_passo,
        proximoPassoEm: negocio.proximo_passo_em,
        mexidoEm: negocio.mexido_em,
      },
      agora
    ) === "podre"
  );
}

/** Do mais esquecido para o menos. Numa lista de cobrança, a ordem é a pauta. */
export function negociosParados(negocios: readonly NegocioParaPlanilha[], agora: Date): NegocioParaPlanilha[] {
  return negocios
    .filter((n) => estaParado(n, agora))
    .sort((a, b) => diasParado(b.mexido_em, agora) - diasParado(a.mexido_em, agora));
}

/** `numeric` do Postgres chega em texto pelo PostgREST. */
function numero(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/**
 * Meio-dia UTC, e não meia-noite. Uma data "2026-09-12" lida como meia-noite
 * fica a um fuso de distância de virar o dia anterior na planilha de quem
 * abrir; ao meio-dia, nenhum deslocamento de fuso realista atravessa a
 * fronteira do dia. É o mesmo truque que o `PainelHistoricoClient` usa.
 */
function dataOuNulo(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

type TipoDeCelula = "texto" | "dinheiro" | "inteiro" | "data";

type ColunaDaPlanilha = {
  titulo: string;
  largura: number;
  tipo: TipoDeCelula;
  valor: (negocio: NegocioParaPlanilha, agora: Date) => string | number | Date | null;
};

/**
 * "Todas as informações" — tudo que a conta e o negócio guardam, mais as três
 * derivadas que a tela mostra e o banco não tem (situação, dias parado,
 * última movimentação legível).
 *
 * As larguras são a diferença entre uma planilha que se lê e uma em que toda
 * coluna precisa ser arrastada antes do primeiro uso.
 */
export const COLUNAS: ColunaDaPlanilha[] = [
  { titulo: "Empresa", largura: 32, tipo: "texto", valor: (n) => n.conta?.nome ?? null },
  { titulo: "Nicho", largura: 16, tipo: "texto", valor: (n) => n.conta?.nicho ?? null },
  { titulo: "Cidade", largura: 18, tipo: "texto", valor: (n) => n.conta?.cidade ?? null },
  { titulo: "UF", largura: 6, tipo: "texto", valor: (n) => n.conta?.uf ?? null },
  { titulo: "Decisor", largura: 22, tipo: "texto", valor: (n) => n.conta?.decisor_nome ?? null },
  { titulo: "E-mail", largura: 28, tipo: "texto", valor: (n) => n.conta?.email ?? null },
  { titulo: "Telefone", largura: 18, tipo: "texto", valor: (n) => n.conta?.telefone ?? null },
  { titulo: "Site", largura: 26, tipo: "texto", valor: (n) => n.conta?.site ?? null },
  { titulo: "Origem", largura: 18, tipo: "texto", valor: (n) => n.conta?.origem ?? null },
  { titulo: "Software atual", largura: 20, tipo: "texto", valor: (n) => n.conta?.software_atual ?? null },
  { titulo: "Estágio", largura: 14, tipo: "texto", valor: (n) => ROTULO_DO_ESTAGIO[n.estagio] ?? n.estagio },
  { titulo: "Setup (R$)", largura: 13, tipo: "dinheiro", valor: (n) => numero(n.setup) },
  { titulo: "Mensalidade (R$)", largura: 16, tipo: "dinheiro", valor: (n) => numero(n.mrr) },
  { titulo: "Próximo passo", largura: 40, tipo: "texto", valor: (n) => n.proximo_passo ?? null },
  { titulo: "Próximo passo em", largura: 16, tipo: "data", valor: (n) => dataOuNulo(n.proximo_passo_em) },
  { titulo: "Dono", largura: 18, tipo: "texto", valor: (n) => n.dono?.full_name ?? null },
  { titulo: "Situação", largura: 13, tipo: "texto", valor: (n, agora) =>
      ROTULO_DA_SAUDE[
        saudeDoNegocio(
          { proximoPasso: n.proximo_passo, proximoPassoEm: n.proximo_passo_em, mexidoEm: n.mexido_em },
          agora
        )
      ] },
  { titulo: "Dias parado", largura: 12, tipo: "inteiro", valor: (n, agora) => diasParado(n.mexido_em, agora) },
  { titulo: "Última movimentação", largura: 18, tipo: "data", valor: (n) => dataOuNulo(n.mexido_em) },
];

/**
 * A célula no formato do `write-excel-file`, mas descrita com tipos nossos:
 * assim o teste roda sem carregar a biblioteca, e trocar de biblioteca não
 * obriga a reescrever a definição das colunas.
 */
type CelulaBase = { format?: string; fontWeight?: "bold" };
export type Celula =
  | (CelulaBase & { value: string | null; type: StringConstructor })
  | (CelulaBase & { value: number | null; type: NumberConstructor })
  | (CelulaBase & { value: Date | null; type: DateConstructor });

const FORMATO: Record<TipoDeCelula, { format?: string }> = {
  // Sem `format`: a biblioteca só aceita "@" como formato de texto e recusa
  // qualquer outro, então declarar um aqui seria um erro em tempo de escrita.
  texto: {},
  // Duas casas e separador de milhar: é dinheiro, e `1500` sem formato na
  // planilha lê pior que `1.500,00`. O símbolo fica no título da coluna para
  // a célula continuar sendo número puro, que soma e filtra.
  dinheiro: { format: "#,##0.00" },
  inteiro: { format: "0" },
  // A máscara é a do Excel, e é ela — não o valor — que decide o que se lê.
  data: { format: "dd/mm/yyyy" },
};

export function linhasDaPlanilha(negocios: readonly NegocioParaPlanilha[], agora: Date): Celula[][] {
  const cabecalho: Celula[] = COLUNAS.map((c) => ({
    value: c.titulo,
    type: String,
    fontWeight: "bold",
  }));

  const linhas = negocios.map((negocio) =>
    COLUNAS.map((coluna): Celula => {
      const valor = coluna.valor(negocio, agora);
      const { format } = FORMATO[coluna.tipo];
      // Célula vazia fica VAZIA, e não com zero nem com a palavra "null": numa
      // coluna de dinheiro, zero afirmaria que o negócio vale nada, quando o
      // que houve foi ninguém ter preenchido. A biblioteca trata `null` como
      // célula em branco — o tipo declarado continua sendo o da coluna, para o
      // Excel manter o formato mesmo na linha vazia.
      //
      // O `switch` existe para o par valor/tipo fechar na união: sem ele o
      // TypeScript só sabe que o valor é "algum dos três" e não consegue
      // garantir que combina com o construtor ao lado.
      switch (coluna.tipo) {
        case "dinheiro":
        case "inteiro":
          return { value: valor as number | null, type: Number, format };
        case "data":
          return { value: valor as Date | null, type: Date, format };
        default:
          return { value: valor as string | null, type: String, format };
      }
    })
  );

  return [cabecalho, ...linhas];
}

export type AbaDaPlanilha = {
  nome: string;
  linhas: Celula[][];
  larguras: number[];
};

/**
 * Os parados primeiro: é a aba que o Excel abre, e é a pergunta que motivou o
 * arquivo.
 */
export function abasDoPipeline(negocios: readonly NegocioParaPlanilha[], agora: Date): AbaDaPlanilha[] {
  const larguras = COLUNAS.map((c) => c.largura);
  return [
    { nome: "Parados", linhas: linhasDaPlanilha(negociosParados(negocios, agora), agora), larguras },
    { nome: "Funil completo", linhas: linhasDaPlanilha(negocios, agora), larguras },
  ];
}

export function nomeDaPlanilha(agora: Date = new Date()): string {
  return `pipeline-aura-${todayInAppTz(agora)}.xlsx`;
}

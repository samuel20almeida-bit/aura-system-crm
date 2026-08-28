import { PageBody, PageHeader, Section } from "@/components/layout/PageBody";
import { Kpi } from "@/components/ui/Card";
import { Unavailable } from "@/components/ui/Unavailable";
import {
  JANELA_PADRAO_DIAS,
  listAssinaturas,
  listContasComVinculo,
  listFaturas,
  listSaloes,
  listUsoDaJanela,
} from "@/lib/data/clubcut";
import {
  frescor,
  participacaoDoAgente,
  resumirCobranca,
  resumirPorSalao,
  situacaoDaAssinatura,
} from "@/lib/clubcut";
import { todayInAppTz } from "@/lib/timezone";
import { formatCurrencyCompact } from "@/lib/format";
import {
  OperacaoClient,
  type LinhaDaOperacao,
} from "@/components/operacao/OperacaoClient";

/**
 * A operação do ClubCut vista de dentro do CRM.
 *
 * O que esta tela NÃO é: um painel do produto. Ela responde a uma pergunta
 * de fornecedor — quanto cada cliente usa, quanto gera, quanto custa e se o
 * dado ainda está chegando. Quem quer ver agenda, comanda e comissão abre o
 * ClubCut; aqui só entra o agregado que atravessa a fronteira entre os dois
 * bancos (ver `0022_clubcut.sql`).
 *
 * `agora` é calculado uma vez por requisição, como no Painel: cada
 * carregamento é uma renderização de servidor nova, com relógio novo.
 */
export default async function OperacaoPage() {
  const [leituraSaloes, leituraContas, leituraUso, leituraAssinaturas, leituraFaturas] =
    await Promise.all([
      listSaloes(),
      listContasComVinculo(),
      listUsoDaJanela(),
      listAssinaturas(),
      listFaturas(),
    ]);

  if (
    leituraSaloes.unavailable ||
    leituraContas.unavailable ||
    leituraUso.unavailable ||
    leituraAssinaturas.unavailable ||
    leituraFaturas.unavailable
  ) {
    return (
      <PageBody>
        <PageHeader title="Operação" sub="O que o ClubCut está fazendo por cada cliente" />
        <Unavailable title="Não foi possível ler a operação do ClubCut" />
      </PageBody>
    );
  }

  const agora = new Date();
  const { saloes } = leituraSaloes;
  const { contas } = leituraContas;
  const hoje = todayInAppTz(agora);
  const resumos = resumirPorSalao(leituraUso.linhas);
  const cobrancas = resumirCobranca(leituraFaturas.faturas, leituraUso.desde, hoje);
  const assinaturas = new Map(leituraAssinaturas.assinaturas.map((a) => [a.salon_id, a]));

  const porSalonId = new Map(saloes.map((s) => [s.salon_id, s]));

  const linhas: LinhaDaOperacao[] = contas
    .filter((c): c is typeof c & { clubcut_salon_id: string } => c.clubcut_salon_id !== null)
    .map((c) => {
      const salao = porSalonId.get(c.clubcut_salon_id);
      const r = resumos.get(c.clubcut_salon_id) ?? null;
      const assinatura = assinaturas.get(c.clubcut_salon_id) ?? null;
      const cobranca = cobrancas.get(c.clubcut_salon_id) ?? null;
      return {
        contaId: c.id,
        contaNome: c.nome,
        situacao: situacaoDaAssinatura(assinatura, hoje),
        plano: assinatura?.plano ?? null,
        cobranca: cobranca && {
          cobrado: cobranca.cobrado,
          emAberto: cobranca.emAberto,
          vencidas: cobranca.vencidas,
        },
        // A chave estrangeira garante que o salão existe; o `??` é para o
        // TypeScript, não para um caso real.
        salaoNome: salao?.nome ?? "—",
        salaoAtivo: salao?.ativo ?? true,
        frescor: frescor(salao?.sincronizado_em ?? null, agora),
        resumo: r && {
          barbeiros: r.barbeiros,
          conversas: r.conversas,
          agendamentosAgente: r.agendamentosAgente,
          agendamentosTotal: r.agendamentosTotal,
          participacao: participacaoDoAgente(r),
          valorGerado: r.valorGerado,
          custoIaUsd: r.custoIaUsd,
          diasComCusto: r.diasComCusto,
          dias: r.dias,
          execucoesErro: r.execucoesErro,
        },
      };
    })
    .sort((a, b) => (b.resumo?.valorGerado ?? -1) - (a.resumo?.valorGerado ?? -1));

  const vinculados = new Set(
    contas.map((c) => c.clubcut_salon_id).filter((id): id is string => id !== null)
  );

  // Os totais somam só o que está VINCULADO. Um salão sincronizado que ainda
  // não pertence a nenhuma conta é operação que existe e receita que ninguém
  // reconhece — por isso ele aparece como pendência ao lado, e não no total.
  const totais = linhas.reduce(
    (acc, l) => {
      if (!l.resumo) return acc;
      acc.conversas += l.resumo.conversas;
      acc.agente += l.resumo.agendamentosAgente;
      acc.total += l.resumo.agendamentosTotal;
      acc.valorGerado += l.resumo.valorGerado;
      acc.erros += l.resumo.execucoesErro;
      if (l.resumo.diasComCusto > 0) acc.custo += l.resumo.custoIaUsd ?? 0;
      acc.comCusto += l.resumo.diasComCusto;
      return acc;
    },
    { conversas: 0, agente: 0, total: 0, valorGerado: 0, erros: 0, custo: 0, comCusto: 0 }
  );

  // A cobrança soma à parte porque não depende de ter havido uso: uma conta
  // pode ter fatura em aberto num mês em que o agente não fez nada.
  const cobranca = linhas.reduce(
    (acc, l) => {
      if (!l.cobranca) return acc;
      acc.cobrado += l.cobranca.cobrado;
      acc.emAberto += l.cobranca.emAberto;
      acc.vencidas += l.cobranca.vencidas;
      return acc;
    },
    { cobrado: 0, emAberto: 0, vencidas: 0 }
  );

  // Uma conta entra em risco por assinatura (atrasada, cancelada, teste
  // vencido) OU por fatura vencida. As duas coisas levam à mesma ação — ir
  // cobrar — então contá-las separadas dividiria a atenção sem motivo.
  const emRisco = linhas.filter(
    (l) => l.situacao.tom === "red" || (l.cobranca?.vencidas ?? 0) > 0
  ).length;

  // Quanto do que o agente entregou vira receita nossa. É a mesma razão que a
  // simulação de preço chama de take rate.
  const take =
    totais.valorGerado > 0 && cobranca.cobrado > 0
      ? (cobranca.cobrado / totais.valorGerado) * 100
      : null;

  const participacaoGeral = totais.total > 0 ? Math.round((totais.agente / totais.total) * 100) : null;
  const saloesLivres = saloes.filter((s) => !vinculados.has(s.salon_id));
  const desatualizados = linhas.filter((l) => l.frescor && l.frescor.estado !== "ok").length;

  return (
    <PageBody>
      <PageHeader
        title="Operação"
        sub={`O que o ClubCut está fazendo por cada cliente · últimos ${JANELA_PADRAO_DIAS} dias`}
      />

      <Section
        title="No período"
        aside={`desde ${leituraUso.desde.split("-").reverse().join("/")}${
          totais.comCusto === 0 ? " · custo de IA ainda não medido" : ""
        }`}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi
            label="Contas ligadas"
            value={linhas.length}
            sub={
              saloesLivres.length > 0
                ? `${saloesLivres.length} ${saloesLivres.length === 1 ? "salão sem conta" : "salões sem conta"}`
                : "todos os salões têm conta"
            }
          />
          <Kpi label="Conversas atendidas" value={totais.conversas} sub={`${totais.erros} falhas de fluxo`} />
          <Kpi
            label="Agendamentos do agente"
            value={totais.agente}
            sub={
              participacaoGeral === null
                ? "sem agendamento no período"
                : `${participacaoGeral}% de tudo que foi marcado`
            }
          />
          <Kpi
            label="Valor gerado ao cliente"
            value={formatCurrencyCompact(totais.valorGerado)}
            sub={take === null ? "sem base para comparar" : `cobramos ${take.toFixed(1).replace(".", ",")}% disso`}
          />
          <Kpi
            label="Cobrado no período"
            value={formatCurrencyCompact(cobranca.cobrado)}
            destaque
            sub={
              cobranca.emAberto > 0
                ? `${formatCurrencyCompact(cobranca.emAberto)} em aberto`
                : "nada em aberto"
            }
          />
          <Kpi
            label="Em risco"
            value={emRisco}
            // Só a cor. Repetir aqui as classes base do `Kpi` punha dois
            // utilitários de `font-size` no mesmo elemento, e qual vence não
            // depende da ordem da string — depende da ordem no CSS gerado.
            valueClassName={emRisco > 0 ? "text-red" : undefined}
            sub={
              emRisco === 0
                ? "assinaturas em dia"
                : `${cobranca.vencidas} ${cobranca.vencidas === 1 ? "fatura vencida" : "faturas vencidas"}`
            }
          />
        </div>
      </Section>

      <Section
        title="Por conta"
        aside={desatualizados > 0 ? `${desatualizados} sem sincronizar há dias` : undefined}
      >
        <OperacaoClient
          linhas={linhas}
          contasSemVinculo={contas
            .filter((c) => c.clubcut_salon_id === null)
            .map((c) => ({ id: c.id, nome: c.nome }))}
          saloesLivres={saloesLivres.map((s) => ({ salon_id: s.salon_id, nome: s.nome }))}
          janelaDias={JANELA_PADRAO_DIAS}
        />
      </Section>
    </PageBody>
  );
}

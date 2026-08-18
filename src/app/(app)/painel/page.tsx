import { PageBody, PageHeader } from "@/components/layout/PageBody";
import { Kpi } from "@/components/ui/Card";
import { Unavailable } from "@/components/ui/Unavailable";
import { listDadosDoPainel } from "@/lib/data/painel";
import { calcularMetricasPainel } from "@/lib/painel";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";

/**
 * O Painel: leitura pura, sem interação nenhuma (nada de arraste, filtro,
 * gaveta, formulário) — por isso, ao contrário das outras telas deste
 * projeto, não existe um `PainelClient.tsx`. Server Component puro.
 *
 * `agora` é calculado uma vez por requisição — não `useMemo`/reancorado como
 * em `PipelineClient.tsx`, porque não há estado de cliente sobrevivendo a uma
 * aba aberta a noite toda: cada carregamento desta página é uma renderização
 * de servidor nova, com relógio novo.
 */
export default async function PainelPage() {
  const dados = await listDadosDoPainel();

  if (dados.unavailable) {
    return (
      <PageBody>
        <PageHeader title="Painel" sub="Hoje, sem histórico — de onde vem o próximo real." />
        <Unavailable title="Não foi possível carregar o painel agora" />
      </PageBody>
    );
  }

  const agora = new Date();
  const metricas = calcularMetricasPainel(dados.negocios, dados.contas, dados.implantacoes, agora);

  return (
    <PageBody>
      <PageHeader title="Painel" sub="Hoje, sem histórico — de onde vem o próximo real." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi
          label="Mensalidade ativa"
          value={formatCurrency(metricas.mrrAtivo)}
          sub={`${metricas.clientesAtivos} ${metricas.clientesAtivos === 1 ? "cliente ativo" : "clientes ativos"}`}
        />
        <Kpi
          label="Pipeline aberto"
          value={formatCurrency(metricas.pipelineMrr)}
          sub={`${metricas.pipelineContagem} ${metricas.pipelineContagem === 1 ? "negócio aberto" : "negócios abertos"}`}
        />
        <Kpi
          label="Ticket médio"
          value={metricas.ticketMedio === null ? "—" : formatCurrency(metricas.ticketMedio)}
          // Achado na revisão final: "ticket médio" sem qualificação lê como
          // o valor do negócio inteiro (setup + mensalidade), mas a conta é
          // só a mensalidade — um negócio de R$ 2.500 de setup + R$ 399/mês
          // apareceria como "R$ 399" nu, sem dizer que o setup ficou de
          // fora. O `sub` fica sempre visível, não só quando null.
          sub={metricas.ticketMedio === null ? "sem negócio aberto" : "Mensalidade por negócio aberto"}
        />
        <Kpi
          label="Apodrecendo"
          value={String(metricas.apodrecendoContagem)}
          valueClassName={metricas.apodrecendoContagem > 0 ? "text-red" : undefined}
          sub={`${formatCurrency(metricas.apodrecendoMrr)}/mês travados`}
        />
        <Kpi
          label="Esperando go-live"
          value={formatCurrency(metricas.mrrEsperandoGoLive)}
          sub="Mensalidade ganha, implantação ainda aberta"
        />
        <Kpi
          label="Setup na receita"
          value={metricas.setupNaReceita === null ? "—" : `${Math.round(metricas.setupNaReceita * 100)}%`}
          // Achado na revisão final, duas correções:
          // (a) o denominador é setup contra UM mês de mensalidade, não contra a mensalidade
          // acumulada até hoje — "desde o início" sugeria acumulado, o que a
          // conta não faz; sem histórico de assinatura (3C não existe), não
          // dá pra fazer a conta acumulada, então o rótulo tem que ser
          // honesto sobre o que está sendo comparado.
          // (b) `null` também acontece com negócio ganho mas sem preço
          // registrado (setup e mrr em branco) — "sem negócio ganho" seria
          // falso nesse caso.
          sub={metricas.setupNaReceita === null ? "sem valor registrado nos ganhos" : "setup vs. 1 mês de mensalidade"}
        />
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-surface p-4 scrollbar-thin">
        <div className="mb-2 text-[13px] font-medium">Origem → receita</div>
        {metricas.origemReceita.length === 0 ? (
          <div className="text-[12.5px] text-faint">Nenhum negócio cadastrado ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-[12.5px]">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="py-1.5 pr-3 font-normal">Origem</th>
                  <th className="py-1.5 pr-3 font-normal">Leads</th>
                  <th className="py-1.5 pr-3 font-normal">Ganhos</th>
                  <th className="py-1.5 pr-3 font-normal">Mensalidade</th>
                </tr>
              </thead>
              <tbody>
                {metricas.origemReceita.map((linha) => (
                  <tr key={linha.origem} className="border-b border-border-soft last:border-b-0">
                    <td className="py-1.5 pr-3">{linha.origem}</td>
                    <td className="py-1.5 pr-3 font-mono">{linha.leads}</td>
                    <td className="py-1.5 pr-3 font-mono">{linha.ganhos}</td>
                    <td className="py-1.5 pr-3 font-mono">{formatCurrencyCompact(linha.mrr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageBody>
  );
}

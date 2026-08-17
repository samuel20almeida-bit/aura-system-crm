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
          label="MRR ativo"
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
          sub={metricas.ticketMedio === null ? "sem negócio aberto" : undefined}
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
          sub="MRR ganho, implantação ainda aberta"
        />
        <Kpi
          label="Setup na receita"
          value={metricas.setupNaReceita === null ? "—" : `${Math.round(metricas.setupNaReceita * 100)}%`}
          sub={metricas.setupNaReceita === null ? "sem negócio ganho" : "desde o início, não mensal"}
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
                  <th className="py-1.5 pr-3 font-normal">MRR</th>
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

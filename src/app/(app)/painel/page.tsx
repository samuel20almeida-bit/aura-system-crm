import { PageBody, PageHeader, Section } from "@/components/layout/PageBody";
import { Card, Kpi } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Unavailable } from "@/components/ui/Unavailable";
import { listDadosDoPainel } from "@/lib/data/painel";
import { calcularMetricasPainel } from "@/lib/painel";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import { PainelHistoricoClient } from "@/components/painel/PainelHistoricoClient";

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
/**
 * Um desenho por métrica. Não são decoração: com seis cartões na grade, o
 * ícone é o que torna cada um reconhecível de relance, antes de o rótulo ser
 * lido. Ficam aqui, e não no kit, porque são específicos destas seis métricas
 * — os do menu já vivem no Sidebar pelo mesmo motivo.
 *
 * Todos no mesmo traço 1.3 e na mesma caixa de 16, como os do Sidebar.
 */
function IconeBase({ children }: { children: React.ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      {children}
    </svg>
  );
}

const ICONE_MENSALIDADE = (
  <IconeBase>
    <path d="M2.5 4.5h11v7h-11z" />
    <circle cx="8" cy="8" r="1.6" />
  </IconeBase>
);
const ICONE_PIPELINE = (
  <IconeBase>
    <path d="M2 3.5h12L9.5 8.4v4.1l-3 1.5V8.4z" />
  </IconeBase>
);
const ICONE_TICKET = (
  <IconeBase>
    <path d="M2.5 8h11" />
    <path d="M4.5 5.2h7M4.5 10.8h7" />
  </IconeBase>
);
const ICONE_APODRECENDO = (
  <IconeBase>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M8 5v3.4l2.2 1.3" />
  </IconeBase>
);
const ICONE_GOLIVE = (
  <IconeBase>
    <path d="M8 2.2c2.2 1.9 3.3 4 3.3 6.3a3.3 3.3 0 0 1-6.6 0c0-2.3 1.1-4.4 3.3-6.3z" />
    <path d="M6.2 13.4h3.6" />
  </IconeBase>
);
const ICONE_SETUP = (
  <IconeBase>
    <path d="M2.5 12.5V7M6.5 12.5V4M10.5 12.5V9M14 12.5h-12" />
  </IconeBase>
);

export default async function PainelPage() {
  const dados = await listDadosDoPainel();

  if (dados.unavailable) {
    return (
      <PageBody>
        <PageHeader title="Painel" sub="Hoje no topo, tendência embaixo — de onde vem o próximo real." />
        <Unavailable title="Não foi possível carregar o painel agora" />
      </PageBody>
    );
  }

  const agora = new Date();
  const metricas = calcularMetricasPainel(dados.negocios, dados.contas, dados.implantacoes, agora);

  return (
    <PageBody>
      <PageHeader title="Painel" sub="Hoje no topo, tendência embaixo — de onde vem o próximo real." />

      <Section title="Agora">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {/* O destaque é este e só este: a mensalidade recorrente é o número
              que decide o mês. Com seis cartões brancos iguais, o olho começava
              pelo canto de cima à esquerda por falta de alternativa. */}
          <Kpi
            destaque
            icone={ICONE_MENSALIDADE}
            label="Mensalidade ativa"
            value={formatCurrency(metricas.mrrAtivo)}
            sub={`${metricas.clientesAtivos} ${metricas.clientesAtivos === 1 ? "cliente ativo" : "clientes ativos"}`}
          />
          <Kpi
            icone={ICONE_PIPELINE}
            label="Pipeline aberto"
            value={formatCurrency(metricas.pipelineMrr)}
            sub={`${metricas.pipelineContagem} ${metricas.pipelineContagem === 1 ? "negócio aberto" : "negócios abertos"}`}
          />
          <Kpi
            icone={ICONE_TICKET}
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
            icone={ICONE_APODRECENDO}
            label="Apodrecendo"
            value={String(metricas.apodrecendoContagem)}
            valueClassName={metricas.apodrecendoContagem > 0 ? "text-red" : undefined}
            sub={`${formatCurrency(metricas.apodrecendoMrr)}/mês travados`}
          />
          <Kpi
            icone={ICONE_GOLIVE}
            label="Esperando go-live"
            value={formatCurrency(metricas.mrrEsperandoGoLive)}
            sub="Mensalidade ganha, implantação ainda aberta"
          />
          <Kpi
            icone={ICONE_SETUP}
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
      </Section>

      {/* O recorte vai ao lado do nome porque a seção "Tendência" tem um bloco
          de mesmo nome, recortado pelo período escolhido. Sem dizer qual é
          qual, os dois parecem o mesmo número em desacordo. */}
      <Section title="Origem → receita" aside="todo o histórico">
        <Card className="p-4">
          {metricas.origemReceita.length === 0 ? (
            <EmptyState plain title="Nenhum negócio cadastrado ainda." />
          ) : (
            // O contêiner rolável fica só nas linhas: `contas.origem` é texto
            // livre, então não há teto para quantas origens existem, mas o
            // cabeçalho não pode subir junto — sem ele, as colunas de número
            // ficam sem nome no meio da rolagem.
            <div className="max-h-[360px] overflow-auto scrollbar-thin">
              <table className="w-full min-w-[420px] text-body">
                <thead>
                  {/* A linha de baixo do cabeçalho é sombra interna, e não
                      `border-b`: o preflight do Tailwind põe
                      `border-collapse: collapse` na tabela, e nesse modo a
                      borda de um elemento `sticky` é pintada junto com a
                      tabela — ela desce com a rolagem e deixa o cabeçalho
                      solto. Sombra não entra no colapso de bordas. */}
                  <tr className="text-left">
                    {["Origem", "Leads", "Ganhos", "Mensalidade"].map((coluna) => (
                      <th
                        key={coluna}
                        className="label sticky top-0 bg-surface py-2 pr-3 shadow-[inset_0_-1px_0_var(--color-border)]"
                      >
                        {coluna}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metricas.origemReceita.map((linha) => (
                    <tr key={linha.origem} className="border-b border-border-soft last:border-b-0">
                      <td className="py-2 pr-3">{linha.origem}</td>
                      <td className="py-2 pr-3 tabular-nums text-muted">{linha.leads}</td>
                      <td className="py-2 pr-3 tabular-nums text-muted">{linha.ganhos}</td>
                      <td className="py-2 pr-3 tabular-nums font-medium">{formatCurrencyCompact(linha.mrr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </Section>

      <PainelHistoricoClient negocios={dados.negocios} contas={dados.contas} implantacoes={dados.implantacoes} />
    </PageBody>
  );
}

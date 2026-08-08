import { PageBody } from "@/components/layout/PageBody";
import { CrmClient } from "@/components/crm/CrmClient";
import { Unavailable } from "@/components/ui/Unavailable";
import { getCrmData } from "@/lib/data/crm";
import { listProfiles } from "@/lib/data/profile";

export default async function CrmPage() {
  const [data, profiles] = await Promise.all([getCrmData(), listProfiles()]);

  // Sem esta ramificação, uma falha do banco renderizava um CRM plausível e
  // vazio: nenhum cliente, nenhuma fatura, 0% de inadimplência.
  if (data.unavailable) {
    return (
      <PageBody>
        <h1 className="text-[21px] font-medium">CRM</h1>
        <Unavailable title="Não foi possível carregar o CRM agora" />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <CrmClient
        clients={data.clients}
        deals={data.deals}
        invoices={data.invoices}
        profiles={profiles}
        monthRevenue={data.monthRevenue}
        overdueAmount={data.overdueAmount}
        overdueCount={data.overdueCount}
        inadimplenciaPct={data.inadimplenciaPct}
        ticketMedio={data.ticketMedio}
      />
    </PageBody>
  );
}

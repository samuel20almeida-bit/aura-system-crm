import { PageBody } from "@/components/layout/PageBody";
import { CrmClient } from "@/components/crm/CrmClient";
import { getCrmData } from "@/lib/data/crm";
import { listProfiles } from "@/lib/data/profile";

export default async function CrmPage() {
  const [data, profiles] = await Promise.all([getCrmData(), listProfiles()]);

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

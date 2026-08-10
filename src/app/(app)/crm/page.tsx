import { PageBody } from "@/components/layout/PageBody";
import { CrmClient } from "@/components/crm/CrmClient";
import { getCrmData } from "@/lib/data/crm";
import { listProfiles } from "@/lib/data/profile";

export default async function CrmPage() {
  const [data, profiles] = await Promise.all([getCrmData(), listProfiles()]);

  // Uma falha do banco não pode renderizar um CRM plausível e vazio (nenhum
  // cliente, 0% de inadimplência) — mas também não pode devolver uma página de
  // erro seca, porque aí some o botão de cadastrar e o usuário fica sem
  // nenhuma saída. O aviso entra no lugar dos números; a ação continua.
  if (data.unavailable) {
    return (
      <PageBody>
        <CrmClient
          clients={[]}
          deals={[]}
          invoices={[]}
          profiles={profiles}
          monthRevenue={0}
          overdueAmount={0}
          overdueCount={0}
          inadimplenciaPct={0}
          ticketMedio={0}
          unavailable
        />
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

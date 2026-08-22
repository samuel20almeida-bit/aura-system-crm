import { PageBody } from "@/components/layout/PageBody";
import { CredenciaisClient } from "@/components/credenciais/CredenciaisClient";
import { listCredentials, listCredentialCategories } from "@/lib/data/credenciais";
import { listClientsLite } from "@/lib/data/tasks";

export default async function CredenciaisPage() {
  const [credentials, categories, clients] = await Promise.all([
    listCredentials(),
    listCredentialCategories(),
    listClientsLite(),
  ]);

  return (
    <PageBody>
      <CredenciaisClient credentials={credentials} categories={categories} clients={clients} />
    </PageBody>
  );
}

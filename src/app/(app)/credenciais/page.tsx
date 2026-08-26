import { PageBody } from "@/components/layout/PageBody";
import { CredenciaisClient } from "@/components/credenciais/CredenciaisClient";
import { listCredentials, listCredentialCategories } from "@/lib/data/credenciais";
import { listContasLite } from "@/lib/data/tasks";

export default async function CredenciaisPage() {
  const [credentials, categories, contasResult] = await Promise.all([
    listCredentials(),
    listCredentialCategories(),
    listContasLite(),
  ]);

  // Mesmo motivo do Kanban (Task 4) e dos Playbooks (Task 5):
  // `contasResult.ok === false` é falha de leitura, não "zero contas".
  // Cadastrar uma credencial interna não depende de conta nenhuma, então a
  // tela não pode cair inteira por isso — vira lista vazia + flag para o
  // seletor do modal mostrar o estado de indisponível em vez de mentir
  // "sem contas cadastradas".
  const contas = contasResult.ok ? contasResult.contas : [];
  const contasIndisponiveis = !contasResult.ok;

  return (
    <PageBody>
      <CredenciaisClient
        credentials={credentials}
        categories={categories}
        contas={contas}
        contasIndisponiveis={contasIndisponiveis}
      />
    </PageBody>
  );
}

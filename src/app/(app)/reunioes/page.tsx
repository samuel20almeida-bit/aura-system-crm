import { PageBody } from "@/components/layout/PageBody";
import { ReunioesClient } from "@/components/reunioes/ReunioesClient";
import { listReunioes } from "@/lib/data/reunioes";
import { listContasLite } from "@/lib/data/tasks";
import { listProfiles } from "@/lib/data/profile";

/**
 * Leitura e escrita numa tela só, sem rota por reunião: a gaveta abre por
 * estado de cliente, como Pipeline e Implantação já fazem. Uma rota
 * `/reunioes/[id]` só se pagaria se a ata precisasse ser aberta por link
 * direto — e hoje ninguém manda link de ata para ninguém, são duas pessoas.
 */
export default async function ReunioesPage() {
  const [reunioes, contas, profiles] = await Promise.all([
    listReunioes(),
    listContasLite(),
    listProfiles(),
  ]);

  return (
    <PageBody>
      <ReunioesClient
        reunioes={reunioes.ok ? reunioes.reunioes : []}
        unavailable={!reunioes.ok}
        contas={contas.ok ? contas.contas : []}
        contasIndisponiveis={!contas.ok}
        profiles={profiles.map((p) => ({ id: p.id, full_name: p.full_name }))}
      />
    </PageBody>
  );
}

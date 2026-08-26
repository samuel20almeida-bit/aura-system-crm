import { createClient } from "@/lib/supabase/server";

export type ReuniaoComTarefas = {
  id: string;
  titulo: string;
  aconteceEm: string;
  duracaoMin: number | null;
  pauta: string | null;
  ata: string | null;
  conta: { id: string; nome: string } | null;
  /** Os itens de ação que viraram tarefa. Vazio não é falha — é reunião sem combinado. */
  tarefas: {
    id: string;
    code: string;
    title: string;
    status: string;
    dueDate: string | null;
    assignee: { id: string; initials: string } | null;
  }[];
};

/**
 * Uma consulta só para a tela inteira, ordenada por `acontece_em` DESC (o
 * índice). A separação entre "próximas" e "anteriores" é feita em memória por
 * `separarPorTempo` (src/lib/reunioes.ts), e não por duas consultas com
 * filtro de data: o corte depende da DURAÇÃO, não só do horário de início —
 * uma reunião em andamento ainda é "próxima" —, e isso é regra de aplicação,
 * não de banco. Duas consultas também custariam duas idas para uma tela que
 * cabe inteira numa.
 *
 * As tarefas vêm embutidas porque a gaveta da reunião as mostra, e são no
 * máximo um punhado por reunião. Os dois embeds vão com a chave estrangeira
 * NOMEADA (`tasks!tasks_reuniao_id_fkey`, `profiles!tasks_assignee_id_fkey`):
 * `tasks` tem duas chaves para `profiles` — `assignee_id` e `created_by` —, e
 * sem dizer qual o PostgREST não resolve o embed. É a mesma classe de falha
 * silenciosa que a busca da Topbar teve; aqui o verificador de tipos a pegou
 * antes de rodar, mas só porque o embed é tipado.
 *
 * Devolve resultado discriminado, e não lista vazia em caso de erro: a tela
 * precisa distinguir "nenhuma reunião marcada" de "não deu para ler". A
 * primeira convida a marcar a primeira; a segunda seria mentira.
 */
export async function listReunioes(): Promise<
  { ok: true; reunioes: ReuniaoComTarefas[] } | { ok: false }
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reunioes")
    .select(
      `id, titulo, acontece_em, duracao_min, pauta, ata,
       conta:contas(id, nome),
       tarefas:tasks!tasks_reuniao_id_fkey(
         id, code, title, status, due_date,
         assignee:profiles!tasks_assignee_id_fkey(id, initials)
       )`
    )
    .order("acontece_em", { ascending: false });

  if (error) {
    console.error("[reunioes] falha ao consultar o Supabase:", error);
    return { ok: false };
  }

  const reunioes: ReuniaoComTarefas[] = (data ?? []).map((r) => ({
    id: r.id,
    titulo: r.titulo,
    aconteceEm: r.acontece_em,
    duracaoMin: r.duracao_min,
    pauta: r.pauta,
    ata: r.ata,
    conta: r.conta,
    tarefas: (r.tarefas ?? []).map((t) => ({
      id: t.id,
      code: t.code,
      title: t.title,
      status: t.status,
      dueDate: t.due_date,
      assignee: t.assignee,
    })),
  }));

  return { ok: true, reunioes };
}

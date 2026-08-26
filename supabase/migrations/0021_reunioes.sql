-- Reuniões: quando acontecem, o que se quer decidir (pauta) e o que ficou
-- decidido (ata). Módulo novo, sem tabela antiga para migrar.
--
-- Escolhas registradas aqui porque cada uma tem uma alternativa óbvia que
-- foi descartada por um motivo:
--
-- 1. `conta_id` NULO significa reunião interna da Aura Studio; preenchido,
--    reunião com aquele cliente. É exatamente a mesma regra de `tasks` e
--    `credenciais` — um terceiro jeito de dizer "isto é de cliente ou é
--    nosso" faria as três telas divergirem sobre o mesmo conceito.
--
-- 2. PAUTA E ATA SÃO DOIS CAMPOS, não um. A pauta é escrita ANTES da
--    reunião e a ata DEPOIS; num campo só, escrever a ata apagaria o que
--    se queria discutir — que é justamente o que se usa para conferir se
--    a reunião cumpriu o que prometia.
--
-- 3. NÃO existe tabela de participantes. A Aura Studio tem duas pessoas, e
--    toda reunião interna é com as duas; uma tabela de junção com RLS
--    própria seria manutenção permanente para uma informação que hoje é
--    constante. Quando houver uma terceira pessoa, isto vira migration.
--
-- 4. NÃO existe recorrência. Reunião semanal fixa é o caso mais provável,
--    mas recorrência de verdade (série, exceções, "só esta ocorrência")
--    é máquina cara. Duplicar a última reunião cobre o caso real de duas
--    pessoas, e não inventa estado que ninguém pediu.
create table public.reunioes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  conta_id uuid references public.contas(id) on delete set null,
  -- `timestamptz`, não `date`: reunião tem hora, ao contrário do
  -- `due_date` de uma tarefa, que é um dia inteiro.
  acontece_em timestamptz not null,
  -- Nulo = duração não definida. A tela mostra "—", não "0 min".
  duracao_min integer check (duracao_min is null or duracao_min > 0),
  pauta text,
  ata text,
  criado_por uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- O histórico e a lista de próximas são as duas únicas consultas da tela, e
-- as duas ordenam por `acontece_em`.
create index reunioes_acontece_em_idx on public.reunioes (acontece_em desc);
create index reunioes_conta_idx on public.reunioes (conta_id);

alter table public.reunioes enable row level security;
create policy "authenticated_full_access" on public.reunioes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- O item de ação da ata é uma TAREFA DE VERDADE, no Kanban, e não uma
-- lista dentro da reunião. O combinado numa reunião só vale se aparecer no
-- mesmo lugar onde o resto do trabalho aparece — uma checklist dentro da
-- ata seria um segundo lugar para procurar o que fazer, e o Kanban perderia
-- a resposta para "o que está aberto".
--
-- `on delete set null`, e não `cascade`: apagar a reunião não pode apagar o
-- trabalho que saiu dela. A tarefa perde a origem e continua no quadro —
-- mesma regra que `tasks.conta_id` já segue.
alter table public.tasks
  add column reuniao_id uuid references public.reunioes(id) on delete set null;

create index tasks_reuniao_idx on public.tasks (reuniao_id);

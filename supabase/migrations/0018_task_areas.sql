-- Catálogo de áreas para tarefas Internas do Kanban. Hoje `tasks.area` é
-- texto livre (0001_schema.sql:142) — sem uma lista real por trás, a mesma
-- área vira "Financeiro", "financeiro", "Financ." em tarefas diferentes.
-- Esta tabela não substitui `tasks.area`: continua sendo a coluna de texto
-- que já existia, só o que a preenche passa a vir de um catálogo real.
create table public.task_areas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  position integer not null default 0,
  criado_em timestamptz not null default now()
);

alter table public.task_areas enable row level security;
create policy "authenticated_full_access" on public.task_areas
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

insert into public.task_areas (nome, position) values
  ('Estúdio', 0),
  ('Financeiro', 1),
  ('Marketing', 2),
  ('Comercial', 3),
  ('OPS', 4)
on conflict do nothing;

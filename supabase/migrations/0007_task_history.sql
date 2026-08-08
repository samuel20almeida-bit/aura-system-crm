-- Permite que um evento do registro de atividade pertença a uma tarefa,
-- alimentando a aba Histórico sem criar uma tabela paralela.
alter table public.activity_log
  add column task_id uuid references public.tasks(id) on delete cascade;

create index activity_log_task_idx on public.activity_log (task_id, created_at desc);

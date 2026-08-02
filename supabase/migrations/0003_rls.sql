-- Row Level Security: any authenticated founder has full read/write access
-- (small trusted 2-person team — no per-row ownership restrictions needed).

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.contracts enable row level security;
alter table public.invoices enable row level security;
alter table public.deals enable row level security;
alter table public.tasks enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;
alter table public.time_entries enable row level security;
alter table public.goals enable row level security;
alter table public.playbook_categories enable row level security;
alter table public.playbooks enable row level security;
alter table public.playbook_steps enable row level security;
alter table public.playbook_runs enable row level security;
alter table public.playbook_run_steps enable row level security;
alter table public.activity_log enable row level security;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'profiles','clients','contracts','invoices','deals','tasks',
      'task_checklist_items','task_comments','task_attachments','time_entries',
      'goals','playbook_categories','playbooks','playbook_steps',
      'playbook_runs','playbook_run_steps','activity_log'
    ])
  loop
    execute format(
      'create policy "authenticated_full_access" on public.%I for all using (auth.uid() is not null) with check (auth.uid() is not null);',
      t
    );
  end loop;
end $$;

-- Anexos passam a admitir arquivo hospedado (storage_path) além de link (url).
alter table public.task_attachments add column storage_path text;

insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

drop policy if exists "aura_read_attachments" on storage.objects;
create policy "aura_read_attachments" on storage.objects
  for select using (bucket_id = 'task-attachments' and auth.uid() is not null);

drop policy if exists "aura_write_attachments" on storage.objects;
create policy "aura_write_attachments" on storage.objects
  for insert with check (bucket_id = 'task-attachments' and auth.uid() is not null);

drop policy if exists "aura_delete_attachments" on storage.objects;
create policy "aura_delete_attachments" on storage.objects
  for delete using (bucket_id = 'task-attachments' and auth.uid() is not null);

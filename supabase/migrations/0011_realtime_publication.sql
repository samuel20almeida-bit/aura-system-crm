-- Tempo real: o Postgres passa a anunciar mudanças nestas tabelas.
-- replica identity full é necessário para o evento de UPDATE/DELETE carregar a
-- linha antiga; sem isso o payload vem só com a chave e não dá para saber o que
-- mudou nem aplicar RLS sobre o registro anterior.
alter table public.tasks replica identity full;
alter table public.invoices replica identity full;
alter table public.clients replica identity full;
alter table public.deals replica identity full;
alter table public.time_entries replica identity full;
alter table public.activity_log replica identity full;

alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.invoices;
alter publication supabase_realtime add table public.clients;
alter publication supabase_realtime add table public.deals;
alter publication supabase_realtime add table public.time_entries;
alter publication supabase_realtime add table public.activity_log;

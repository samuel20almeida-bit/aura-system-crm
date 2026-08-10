-- Tempo real: o Postgres passa a anunciar mudanças nestas tabelas.
--
-- replica identity full é necessário para o evento de UPDATE/DELETE carregar a
-- linha antiga; sem isso o payload vem só com a chave e não dá para saber o que
-- mudou nem aplicar RLS sobre o registro anterior. O custo é por MUDANÇA, não
-- por tamanho da tabela, e para INSERT é zero.
alter table public.tasks replica identity full;
alter table public.invoices replica identity full;
alter table public.clients replica identity full;
alter table public.deals replica identity full;
alter table public.time_entries replica identity full;
alter table public.activity_log replica identity full;
alter table public.goals replica identity full;
alter table public.task_comments replica identity full;
alter table public.task_checklist_items replica identity full;
alter table public.task_attachments replica identity full;

-- Declarativo, e não `add table`: `add` falha em replay (supabase db reset,
-- branch de preview, ou alguém tendo ligado o toggle no painel antes). `set
-- table` descreve o conjunto inteiro e pode rodar quantas vezes for preciso.
--
-- Consequência aceita: uma tabela ligada à mão pelo painel e ausente desta lista
-- é removida da publicação. É o ponto de ter a lista num arquivo versionado.
alter publication supabase_realtime set table
  public.tasks,
  public.invoices,
  public.clients,
  public.deals,
  public.time_entries,
  public.activity_log,
  public.goals,
  public.task_comments,
  public.task_checklist_items,
  public.task_attachments;

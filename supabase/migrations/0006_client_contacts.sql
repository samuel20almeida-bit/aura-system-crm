create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);
alter table public.client_contacts enable row level security;
create policy "authenticated_full_access" on public.client_contacts for all using (auth.uid() is not null) with check (auth.uid() is not null);

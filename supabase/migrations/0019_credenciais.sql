-- Catálogo de categorias de credencial (mesmo formato de task_areas,
-- 0018_task_areas.sql) e a tabela de credenciais em si — senhas e chaves
-- de acesso, internas da Aura Studio ou de clientes. Guardadas em texto
-- simples: decisão registrada em
-- docs/superpowers/specs/2026-08-22-credenciais-design.md ("Decisão de
-- segurança") — só Samuel e Saymon têm acesso ao CRM, e criptografia foi
-- explicitamente descartada.
create table public.credencial_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  position integer not null default 0,
  criado_em timestamptz not null default now()
);

alter table public.credencial_categorias enable row level security;
create policy "authenticated_full_access" on public.credencial_categorias
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

insert into public.credencial_categorias (nome, position) values
  ('Hospedagem', 0),
  ('E-mail', 1),
  ('Domínio', 2),
  ('API', 3),
  ('Financeiro', 4),
  ('Outro', 5)
on conflict do nothing;

create table public.credenciais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria_id uuid not null references public.credencial_categorias(id),
  -- Nulo = credencial interna da Aura Studio; preenchido = credencial de
  -- um cliente específico.
  cliente_id uuid references public.clients(id) on delete set null,
  usuario text,
  senha text,
  url text,
  notas text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index credenciais_categoria_idx on public.credenciais (categoria_id);
create index credenciais_cliente_idx on public.credenciais (cliente_id);

alter table public.credenciais enable row level security;
create policy "authenticated_full_access" on public.credenciais
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

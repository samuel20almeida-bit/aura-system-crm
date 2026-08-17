-- A esteira de implantação: nasce quando um negócio é ganho (passagem de
-- bastão automática, Task 3 desta fase), atravessa as seis etapas de
-- implantacao_etapas (dado, não código — Task 2 da 3A), termina quando a
-- conta vira cliente.
--
-- negocio_id é UNIQUE: um negócio só gera uma implantação. É o que torna
-- ganharNegocio seguro de repetir se a escrita anterior falhar pela metade —
-- a segunda tentativa esbarra na constraint em vez de duplicar (ver o
-- comentário em src/lib/actions/deals.ts, Task 3 desta fase).
create table public.implantacoes (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  negocio_id uuid not null unique references public.negocios(id) on delete cascade,
  etapa int not null default 0 references public.implantacao_etapas(posicao),
  -- Zerado a cada troca de etapa; é o relógio do SLA, mesmo raciocínio de
  -- negocios.mexido_em para o apodrecimento.
  etapa_desde timestamptz not null default now(),
  -- Nulo = em andamento. A esteira não "conclui" etapa por etapa — conclui
  -- quando a conta vira cliente, uma vez só.
  concluida_em timestamptz,
  dono_id uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index implantacoes_etapa_idx on public.implantacoes (etapa);
create index implantacoes_conta_idx on public.implantacoes (conta_id);

alter table public.implantacoes enable row level security;
create policy "authenticated_full_access" on public.implantacoes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

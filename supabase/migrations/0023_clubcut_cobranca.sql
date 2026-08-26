-- O outro lado da conta: o que o cliente PAGA.
--
-- A 0022 trouxe o uso — conversas, agendamentos, valor gerado. Sozinho, ele
-- responde "quanto esse cliente usa" e não responde "quanto esse cliente
-- vale". Margem precisa dos dois lados, e faltavam os dois: o custo (que o
-- ClubCut ainda não mede) e a receita (que ele mede muito bem e não
-- atravessava a fronteira).
--
-- Mesma direção da 0022: quem lê o ClubCut é o n8n, e o que chega aqui é
-- cópia do que já foi decidido lá. Nada aqui é fonte — cancelar uma
-- assinatura ou dar baixa numa fatura acontece no ClubCut e no Asaas, e
-- aparece nesta tela na próxima sincronização.

-- ============ ASSINATURA ============
-- Uma por salão. A chave primária é o próprio `salon_id` porque é assim que
-- o ClubCut modela: `subscriptions` tem `unique (salon_id)`. Se um dia houver
-- mais de uma por salão, esta tabela guarda a vigente e a migration que
-- mudar isso precisa decidir qual é.
--
-- `status` e `plano` são TEXTO, não enum. São vocabulário de outro sistema
-- ('trial', 'active', 'atrasada', 'cancelada', 'basico', 'pro'): um enum
-- nosso quebraria o sincronizador no dia em que eles criassem um status novo,
-- e o CRM não tem nada a ganhar recusando um valor que lá é válido.
create table public.clubcut_assinaturas (
  salon_id uuid primary key references public.clubcut_saloes(salon_id) on delete cascade,
  plano text,
  status text not null,
  valor numeric(12,2),
  proximo_vencimento date,
  -- Até quando o cliente continua entrando mesmo sem pagar. Vem de lá porque
  -- a regra de carência é do produto, não do CRM.
  acesso_ate date,
  atualizado_em timestamptz not null default now()
);

alter table public.clubcut_assinaturas enable row level security;
create policy "authenticated_full_access" on public.clubcut_assinaturas
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============ FATURAS DE USO ============
-- A chave composta é a MESMA que a `faturas_de_uso` do ClubCut usa
-- (`unique (salon_id, periodo_inicio, periodo_fim, motivo)`). Copiar a chave
-- de lá, em vez de inventar uma, é o que faz o reenvio ser idempotente dos
-- dois lados: o mesmo fechamento chega sempre na mesma linha.
--
-- `motivo` entra na chave porque lá também entra: um cancelamento no meio do
-- mês gera uma fatura parcial do MESMO período da mensal.
create table public.clubcut_faturas (
  salon_id uuid not null references public.clubcut_saloes(salon_id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim date not null,
  motivo text not null,
  valor numeric(12,2) not null,
  -- O que o agente gerou no período, congelado no fechamento. NÃO é o mesmo
  -- número que a soma de `clubcut_uso_diario.valor_gerado`: a fatura congela
  -- no dia do fechamento e mantém agendamento cancelado depois, e o uso
  -- diário exclui cancelado. As duas respostas são legitimamente diferentes
  -- — uma é fiscal, a outra é operacional.
  valor_gerado numeric(12,2) not null default 0,
  agendamentos integer not null default 0,
  vencimento date,
  -- Nulo = ainda não paga. É o que sustenta a leitura de inadimplência.
  paga_em timestamptz,
  recebido_em timestamptz not null default now(),
  primary key (salon_id, periodo_inicio, periodo_fim, motivo)
);

create index clubcut_faturas_periodo_idx on public.clubcut_faturas (periodo_fim desc, salon_id);

alter table public.clubcut_faturas enable row level security;
create policy "authenticated_full_access" on public.clubcut_faturas
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

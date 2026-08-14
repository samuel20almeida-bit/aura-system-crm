-- O modelo do CRM de agentes: uma conta, várias fases.
--
-- O protótipo tinha três listas separadas (negócios, implantações, clientes)
-- para o MESMO negócio em momentos diferentes da vida, o que perde histórico e
-- obriga a copiar dado de uma lista para a outra. Aqui a conta é uma só, do
-- primeiro contato ao churn, e a fase é uma coluna dela.
--
-- COLISÃO DE NOME RESOLVIDA AQUI: o plano da Fase 3A chamava a tabela nova de
-- `deals`, mas `public.deals` já existe desde a 0001 — é o funil do CRM antigo
-- (lead/proposal/negotiation/won/lost, amarrado a `clients`). A tabela antiga
-- fica onde está, intocada, até a 3C decidir o destino dela, então a nova nasce
-- como `public.negocios`. Além de não colidir, é o nome que o resto deste
-- esquema usa: `contas`, `planos`, `implantacao_etapas`. Os tipos acompanham
-- (`negocio_estagio`, `negocio_resultado`).
--
-- Esta migration só cria esquema. Nenhuma tela, nenhuma action.
-- Nada é publicado em `supabase_realtime`: a 0013 encolheu a publicação para
-- `activity_log` de propósito, e republicar é decisão para quando o modelo novo
-- estiver estável.

create type public.conta_fase as enum ('prospect','implantacao','cliente','perdido','churn');
create type public.negocio_estagio as enum ('lead','contato','qualificado','diagnostico','proposta');
create type public.negocio_resultado as enum ('ganho','perdido');
create type public.etapa_espera as enum ('nos','cliente');

-- ============ CONTAS ============
-- O negócio em si, do primeiro contato ao churn.
create table public.contas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nicho text,
  cidade text,
  uf text,
  decisor_nome text,
  software_atual text,
  origem text,
  fase public.conta_fase not null default 'prospect',
  dono_id uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index contas_fase_idx on public.contas (fase);

-- ============ PLANOS ============
-- Catálogo de preço por nicho. Os números do protótipo se repetem exatos entre
-- negócios diferentes, o que é tabela e não negociação. Nasce VAZIO: o Samuel
-- cadastra o que vende de verdade.
create table public.planos (
  id uuid primary key default gen_random_uuid(),
  nicho text not null,
  nome text not null,
  setup numeric(12,2) not null,
  mrr numeric(12,2) not null,
  ativo boolean not null default true,
  posicao int not null default 0
);

-- ============ NEGÓCIOS ============
-- A tentativa de venda. Uma conta pode ter mais de uma ao longo do tempo
-- (perdeu em maio, voltou em outubro), e o histórico das duas sobrevive.
create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  estagio public.negocio_estagio not null default 'lead',
  -- Procedência apenas: diz de qual plano o preço saiu, não é a fonte do preço.
  plano_id uuid references public.planos(id),
  -- Copiados do plano na proposta, NUNCA referenciados: subir o preço em
  -- novembro não pode reescrever o que foi vendido em agosto, senão a série
  -- histórica do Painel (Fase 3D) mente.
  setup numeric(12,2),
  mrr numeric(12,2),
  desconto numeric(12,2) not null default 0,
  proximo_passo text,
  proximo_passo_em date,
  -- Zerado quando alguém mexe no negócio; é o relógio do "apodrecendo".
  mexido_em timestamptz not null default now(),
  resultado public.negocio_resultado,
  motivo_perda text,
  fechado_em date,
  dono_id uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index negocios_estagio_idx on public.negocios (estagio);
create index negocios_proximo_passo_em_idx on public.negocios (proximo_passo_em);
create index negocios_conta_idx on public.negocios (conta_id);

-- ============ ETAPAS DA IMPLANTAÇÃO ============
-- Tabela de referência, editável sem deploy: os prazos são dados, não código.
-- Única tabela deste esquema que nasce com linhas, e não são dados fictícios —
-- são a configuração da esteira, definida no spec.
create table public.implantacao_etapas (
  posicao int primary key,
  nome text not null,
  sla_dias int not null,
  -- Registrado desde já, mesmo sem tela: duas destas etapas dependem do
  -- cliente, e alertar igual as duas famílias faz o alerta perder valor.
  espera public.etapa_espera not null default 'nos'
);

insert into public.implantacao_etapas (posicao, nome, sla_dias, espera) values
  (0, 'Pago · aguardando kickoff', 1, 'nos'),
  (1, 'Coleta de acessos',         1, 'cliente'),
  (2, 'Build do agente',           2, 'nos'),
  (3, 'Teste com o cliente',       1, 'cliente'),
  (4, 'Go-live',                   1, 'nos'),
  (5, 'Acompanhamento D+7',        7, 'nos');

-- ============ RLS ============
-- Mesmo padrão do resto do sistema (0003_rls.sql): qualquer conta autenticada
-- tem leitura e escrita. Time de duas pessoas, ambas sócias; consistência aqui
-- vale mais que uma política mais fina só nestas tabelas.
alter table public.contas enable row level security;
alter table public.planos enable row level security;
alter table public.negocios enable row level security;
alter table public.implantacao_etapas enable row level security;

do $$
declare
  t text;
begin
  for t in
    select unnest(array['contas','planos','negocios','implantacao_etapas'])
  loop
    execute format(
      'create policy "authenticated_full_access" on public.%I for all using (auth.uid() is not null) with check (auth.uid() is not null);',
      t
    );
  end loop;
end $$;

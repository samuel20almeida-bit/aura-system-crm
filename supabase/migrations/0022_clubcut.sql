-- A ponte com o ClubCut: o produto que vendemos, que roda em outro projeto
-- Supabase e é operado pelo n8n.
--
-- A DIREÇÃO IMPORTA E É DELIBERADA. O CRM não abre conexão com o banco do
-- cliente: quem escreve aqui é o n8n, uma vez por dia, pela rota
-- `/api/clubcut/uso`. Ler direto o Postgres do ClubCut daria drill-down ao
-- vivo, mas colocaria uma chave de produção do cliente dentro do nosso deploy
-- e acoplaria nossas telas ao schema deles — uma migration lá quebraria uma
-- tela aqui. O agregado diário atravessa a fronteira; o dado bruto fica onde
-- nasceu.
--
-- Consequência aceita: o número da tela é de ontem, não de agora. Para
-- decidir preço, margem e risco de churn — que é para o que ele serve — um
-- dia de atraso não muda nenhuma conclusão.

-- ============ ESPELHO DOS SALÕES ============
-- ESPELHO, não fonte. A fonte é `public.salons` no ClubCut; esta tabela
-- existe para que o seletor de vínculo tenha o que listar sem o CRM
-- consultar o banco do cliente. Só o sincronizador escreve.
--
-- A chave primária é o `id` de lá, e não um `gen_random_uuid()` nosso: dois
-- identificadores para o mesmo salão obrigariam a manter um de-para, e é o
-- id do ClubCut que aparece em toda linha de uso que chega.
create table public.clubcut_saloes (
  salon_id uuid primary key,
  nome text not null,
  ativo boolean not null default true,
  -- Quando este espelho foi atualizado pela última vez. É o que a tela usa
  -- para dizer "sincronizado há 3 dias" — sem isso, um sincronizador parado
  -- seria indistinguível de um cliente que parou de usar, que é o erro de
  -- leitura mais caro que esta tela pode cometer.
  sincronizado_em timestamptz not null default now()
);

alter table public.clubcut_saloes enable row level security;
create policy "authenticated_full_access" on public.clubcut_saloes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============ O VÍNCULO ============
-- Nulo = conta sem ClubCut ligado (prospect, ou cliente de outro produto).
-- `unique` porque um salão pertence a no máximo uma conta: sem isso, duas
-- contas poderiam somar o mesmo uso e o total do Painel contaria em dobro.
--
-- `on delete set null`: se um salão sumir do espelho, a conta perde o
-- vínculo e continua existindo. O contrário — travar o apagamento — deixaria
-- o sincronizador refém do nosso cadastro.
alter table public.contas
  add column clubcut_salon_id uuid unique
    references public.clubcut_saloes(salon_id) on delete set null;

-- ============ USO DIÁRIO ============
-- Uma linha por salão por dia. Chaveada por `salon_id`, não por `conta_id`,
-- porque o n8n não conhece — nem deve conhecer — os identificadores do nosso
-- CRM. O encontro entre os dois mundos acontece na leitura, num join só.
--
-- A chave composta torna o envio idempotente: reenviar o mesmo dia
-- sobrescreve em vez de duplicar, e o sincronizador pode reprocessar uma
-- janela inteira sem medo. Mesma razão do `unique` que a `faturas_de_uso`
-- do ClubCut usa no fechamento.
create table public.clubcut_uso_diario (
  salon_id uuid not null references public.clubcut_saloes(salon_id) on delete cascade,
  dia date not null,
  barbeiros integer not null default 0,
  conversas integer not null default 0,
  mensagens integer not null default 0,
  -- Os dois separados de propósito. `agendamentos_agente` é o que se cobra
  -- no modelo por uso; `agendamentos_total` é o que a barbearia fez. A razão
  -- entre eles é a única medida honesta do quanto o agente participa da
  -- operação — e é a conta que decide se cobrança por resultado se sustenta.
  agendamentos_agente integer not null default 0,
  agendamentos_total integer not null default 0,
  valor_gerado numeric(12,2) not null default 0,
  -- NULO, não zero, e sem `default 0`. Zero afirmaria que a IA não custou
  -- nada naquele dia; nulo diz que ninguém mediu. Hoje nenhuma tabela do
  -- ClubCut guarda token, modelo ou custo — a instrumentação (`consumo_ia`)
  -- ainda não existe, e a tela precisa dizer isso em vez de exibir uma
  -- margem inventada.
  custo_ia_usd numeric(12,6),
  execucoes_erro integer not null default 0,
  recebido_em timestamptz not null default now(),
  primary key (salon_id, dia)
);

-- A leitura da tela é sempre "os últimos N dias, de todo mundo": ordenar por
-- dia com o salão junto cobre tanto a varredura da janela quanto o corte por
-- salão de um cliente só.
create index clubcut_uso_diario_dia_idx on public.clubcut_uso_diario (dia desc, salon_id);

alter table public.clubcut_uso_diario enable row level security;
create policy "authenticated_full_access" on public.clubcut_uso_diario
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

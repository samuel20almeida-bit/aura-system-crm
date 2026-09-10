-- O diário de uma conta: o que aconteceu, quando, e escrito por quem.
--
-- ISTO JÁ EXISTIU. O CRM antigo tinha `client_contacts` (`client_id`,
-- `author_id`, `note`, `created_at`), com a mesma forma e a mesma intenção; a
-- migração de `clients` para `contas` deixou a tabela para trás e a tela nunca
-- foi refeita. Hoje ela está no banco com zero referência no código. Esta é a
-- sucessora no modelo novo — e o fato de a decisão ter sido tomada duas vezes,
-- de forma independente, é o melhor argumento disponível a favor dela.
--
-- POR QUE UMA TABELA, E NÃO UMA COLUNA `notas text` EM `contas`.
-- O trabalho que esta tela serve é prospecção repetida: liga na segunda,
-- ninguém atende; liga na quinta, fala com o balconista; liga semana que vem,
-- fala com o dono. Num campo único, cada anotação sobrescreve ou empurra a
-- anterior para o fim de um bloco que ninguém lê — e o que importa
-- (a sequência) é justamente o que se perde. Linha datada preserva a ordem
-- sem ninguém ter que manter a ordem.
--
-- POR QUE NA CONTA, E NÃO NO NEGÓCIO.
-- A empresa sobrevive ao negócio. "Falei com o dono, ele não decide nada" vale
-- para a tentativa de agora e para a de daqui a um ano, depois de o negócio
-- atual ter sido perdido e um novo ter sido aberto. Preso ao negócio, o
-- aprendizado morreria junto com ele — e é exatamente o aprendizado que faz a
-- segunda tentativa valer mais que a primeira.
create table public.conta_notas (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  -- `set null` e não `cascade`: se um sócio sair, o que ele registrou continua
  -- valendo. A nota é da empresa, a autoria é um detalhe dela.
  autor_id uuid references public.profiles(id) on delete set null,
  -- O `check` existe porque a tela tem um botão: sem ele, um clique com o
  -- campo em branco gravaria uma linha vazia no meio do diário. Barrar no
  -- banco também deixa a regra valer para quem escrever por fora da tela.
  texto text not null check (length(trim(texto)) > 0),
  criado_em timestamptz not null default now()
);

-- A leitura é sempre "as notas desta conta, da mais nova para a mais velha".
-- O índice cobre a filtragem e a ordenação de uma vez.
create index conta_notas_conta_idx on public.conta_notas (conta_id, criado_em desc);

alter table public.conta_notas enable row level security;
create policy "authenticated_full_access" on public.conta_notas
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

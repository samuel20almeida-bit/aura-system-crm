-- Unificação de `contas` e `clients`: tarefa, execução de playbook e
-- credencial passam a apontar para a conta que a venda já usa.
--
-- ADITIVA DE PROPÓSITO. Nada é removido: `clients`, `tasks.client_id`,
-- `playbook_runs.client_id` e `credenciais.cliente_id` continuam onde estão.
-- Enquanto isto não rodar em produção com dado real, o caminho antigo intacto
-- é o que permite voltar atrás sem migration de emergência. Derrubar `clients`
-- também derrubaria `client_contacts`, `invoices` e `contracts` por cascata.
-- A limpeza é migration própria, condicionada à verificação humana.
--
-- ANTES DE APLICAR, conferir que não há dado a migrar (o esperado é zero nas
-- três, porque `clients` nunca teve escritor):
--   select count(*) from public.tasks         where client_id  is not null;
--   select count(*) from public.playbook_runs where client_id  is not null;
--   select count(*) from public.credenciais   where cliente_id is not null;
-- Se alguma devolver linha, PARAR: não existe regra automática que adivinhe
-- qual conta corresponde a qual cliente antigo.

-- ============ PREFIXO DO CÓDIGO DA TAREFA ============
-- As tarefas usam códigos `PREFIXO-NN` (`BAR-07`). O prefixo vinha de
-- `clients.code_prefix`; `contas` não tinha equivalente.
--
-- É coluna, e não derivação na hora de gerar o código, porque o prefixo é um
-- rótulo que as pessoas falam em voz alta. Derivado do nome, ele mudaria em
-- silêncio quando alguém corrigisse a grafia da conta, e as tarefas antigas
-- deixariam de combinar com as novas.
--
-- Colisão entre contas de nome parecido é aceita: `highestTaskCodeNumber` já
-- consulta `ilike 'BAR-%'` e toma o maior, então duas contas com o mesmo
-- prefixo compartilham a sequência e nenhum código se repete.
alter table public.contas add column code_prefix text;

-- `nullif(..., '')` deixa NULL em vez de string vazia; o SQL só evita fingir
-- que uma string vazia é prefixo válido. Quem decide o destino do NULL é a
-- leitura, em dois lugares diferentes para dois gatilhos diferentes:
-- `resolveTaskCodePrefix` (`src/lib/data/tasks.ts`) troca NULL por "INT" ao
-- buscar o prefixo de uma conta; `derivePrefixoDaConta`
-- (`src/lib/task-codes.ts`, implementada na task 2 desta fase) cai no mesmo
-- "INT" quando o *nome* da conta não rende nenhuma letra. Mesmo destino,
-- funções diferentes — nenhuma das duas deriva o prefixo daqui. A remoção de
-- acento usa `translate` puro: habilitar a extensão `unaccent` por causa de
-- um rótulo de três letras não se paga.
update public.contas
   set code_prefix = nullif(
         upper(
           substr(
             translate(
               btrim(nome),
               'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
               'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
             ),
             1, 3
           )
         ),
         ''
       )
 where code_prefix is null;

-- ============ REFERÊNCIAS NOVAS ============
-- `on delete set null` e não `cascade`: apagar uma conta não pode levar junto
-- o histórico de trabalho feito para ela. Mesmo critério que `tasks.client_id`
-- já usava.
alter table public.tasks
  add column conta_id uuid references public.contas(id) on delete set null;
create index tasks_conta_idx on public.tasks (conta_id);

alter table public.playbook_runs
  add column conta_id uuid references public.contas(id) on delete set null;

alter table public.credenciais
  add column conta_id uuid references public.contas(id) on delete set null;

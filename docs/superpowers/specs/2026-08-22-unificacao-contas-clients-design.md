# Unificação de `contas` e `clients` — um cliente só no sistema inteiro

**Data:** 2026-08-22
**Status:** Aprovado

## Problema

O sistema tem **dois cadastros de cliente**, e um deles está morto.

A venda usa `contas` — criada na Fase 3A, alimentada pelo Pipeline, com nome, nicho,
cidade, decisor, contato e fase. O Kanban e os Playbooks usam `clients`, a tabela do
CRM antigo, cuja tela de cadastro foi removida na Task 6 da Fase 3A. O app **lê**
`clients` em dois lugares e **nunca escreve** nela.

Consequências em cadeia, todas verificadas no código:

- O Kanban abre no filtro "Clientes", que está permanentemente vazio. É a primeira
  impressão do módulo mais usado.
- "Nova tarefa → Tarefa de cliente" abre um seletor sem opções e sem saída.
- Todo playbook executado vira "Interno", porque `runPlaybook` recebe um `clientId`
  que nunca existe.
- **Nenhuma tarefa pode ser ligada a uma conta real**, então a pergunta "o que está
  pendente nesta barbearia" não tem resposta no sistema.

Isto foi levantado como achado A3 na auditoria de 2026-08-21 e como P0.5 na auditoria
de transformação. É o único achado P0 que não se resolve com trabalho de interface: a
causa é o modelo.

## Objetivo

Uma conta só, do primeiro contato ao churn, referenciada por venda, implantação,
tarefa e playbook.

Critérios de aceitação:

- Uma tarefa pode ser ligada a qualquer conta cadastrada.
- O seletor de cliente do Kanban lista contas reais.
- Um playbook pode ser executado para uma conta, e as tarefas geradas ficam ligadas a ela.
- O Kanban abre com conteúdo.
- Nenhuma tarefa, comentário, anexo ou execução de playbook existente é perdida.

## O que este spec NÃO faz

Registrado para não confundir com a fase seguinte:

- **Não cria a tela de Clientes.** Listar contas em fase `cliente`, com mensalidade e
  último contato, é funcionalidade nova.
- **Não implementa churn.**
- **Não apaga `clients`, `client_contacts`, `deals`, `invoices` nem `contracts`.** Ver
  "Aposentar depois, não agora".
- **Não mexe em `credenciais`, `task_areas` nem em nada da 5F.**

## Arquitetura

A mudança é uma troca de referência, não um modelo novo.

`tasks` e `playbook_runs` ganham `conta_id`, apontando para `contas`. A camada de
leitura passa a resolver o nome do cliente por essa coluna. `clients` deixa de ter
qualquer leitor.

Três decisões de desenho precisam ser explícitas, porque `contas` não é um clone de
`clients`.

### Decisão 1 — o código da tarefa

As tarefas usam códigos no formato `PREFIXO-NN` (`NIM-07`), e o prefixo vem hoje de
`clients.code_prefix`, uma coluna `not null` com índice único. **`contas` não tem esse
campo.**

`contas` ganha `code_prefix text` (nulo permitido). A migration preenche as contas
existentes derivando do nome: primeiras três letras, sem acento, em maiúsculas.
`criarContaComNegocio` passa a preencher no cadastro, pela mesma regra.

Por que uma coluna, e não derivar na hora de gerar o código: o prefixo é um rótulo que
pessoas falam em voz alta ("o BAR-07"). Derivado do nome, ele muda em silêncio quando
alguém corrige a grafia da conta, e as tarefas antigas passam a não combinar com as
novas. Guardado, ele é estável e pode ser editado depois sem inventar migração.

**Colisão é aceitável e não é defeito.** Duas contas cujo nome comece igual —
"Barbearia do Léo" e "Barbearia Central" — recebem `BAR`. `highestTaskCodeNumber` já
consulta `ilike 'BAR-%'` e toma o maior, então as duas compartilham a sequência e
nenhum código se repete. `tasks.code` continua único. O efeito é que os números
intercalam entre as duas contas — feio, não incorreto. Resolver colisão exigiria
sufixo automático, que troca um rótulo legível por um ilegível.

### Decisão 2 — a cor do cliente some do cartão

`TaskCard` desenha um quadradinho de 2×2 com `clients.color`. `contas` não tem cor, e
**inventar uma por conta seria decoração sem fonte de verdade** — um valor que ninguém
escolheu, que não significa nada, e que passaria a precisar de tela de edição.

O quadradinho sai. O nome da conta já está no cartão, que é a informação que ele
tentava resumir. Se varrer o quadro por cliente virar necessidade real, isso é uma
funcionalidade deliberada — filtro, agrupamento ou cor escolhida —, não um resto de
tabela aposentada.

### Decisão 3 — quais contas aparecem no seletor

**Todas**, ordenadas por nome.

Filtrar por `fase = 'cliente'` esconderia justamente a conta em `prospect` para a qual
se está preparando uma proposta — trabalho real, com tarefas reais. A fase governa o
funil, não o direito de ter tarefa.

## Dados

### Migration `0020_tarefas_por_conta.sql`

Aditiva. Não remove coluna, não remove tabela, não apaga linha.

```sql
alter table public.contas add column code_prefix text;

update public.contas
   set code_prefix = upper(
         substr(
           translate(
             btrim(nome),
             'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
             'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
           ),
           1, 3
         )
       )
 where code_prefix is null;

alter table public.tasks
  add column conta_id uuid references public.contas(id) on delete set null;
create index tasks_conta_idx on public.tasks (conta_id);

alter table public.playbook_runs
  add column conta_id uuid references public.contas(id) on delete set null;
```

`on delete set null` e não `cascade`: apagar uma conta não pode levar junto o histórico
de trabalho feito para ela. É o mesmo critério que `tasks.client_id` já usava.

A remoção de acento usa `translate` puro, sem a extensão `unaccent` — o projeto não a
habilita hoje, e habilitar extensão por causa de um rótulo de três letras não se paga.

**A regra do prefixo existe em dois lugares, e isso é deliberado.** O SQL acima roda
uma vez, para preencher o que já existe; a função TypeScript roda para sempre, a cada
conta nova. Não dá para o banco chamar a função do app nem o contrário sem inventar
infraestrutura. O que evita divergência é o teste: a suíte da função pura inclui os
mesmos nomes que o `translate` cobre, e qualquer mudança na regra tem de tocar os dois.
Registrado aqui porque duplicação silenciosa de regra é como ela se perde.

### O dado que existe hoje

`tasks.client_id` e `playbook_runs.client_id` apontam para `clients`, que nunca teve
escritor — **a expectativa é que estejam todos nulos**. Mas esta sessão não alcança o
banco de produção (achado E1), então isto é expectativa, não fato verificado.

A migration é aditiva justamente por isso: ela não tenta migrar nada. Antes de aplicar,
alguém com acesso ao painel roda:

```sql
select count(*) from public.tasks where client_id is not null;
select count(*) from public.playbook_runs where client_id is not null;
```

- **Ambos zero** (esperado): seguir, nada a migrar.
- **Algum diferente de zero**: parar e decidir o mapeamento com o Samuel antes de
  continuar. Não há regra automática que possa adivinhar qual conta corresponde a qual
  cliente antigo, e inventar uma seria pior do que perguntar.

### Aposentar depois, não agora

Depois desta mudança, `clients` fica sem leitor e sem escritor — e a doutrina do
projeto (migration 0014) diz que tabela sem escritor é dívida.

Mesmo assim, **`clients` e as colunas `client_id` ficam**. O motivo é reversibilidade:
enquanto a mudança não roda em produção com dado real, manter o caminho antigo intacto
é o que permite voltar atrás sem migration de emergência. Derrubar `clients` também
derrubaria `client_contacts`, `invoices` e `contracts` por cascata, que é um estrago
maior que o benefício.

A limpeza é uma migration própria, depois de a verificação humana confirmar que o
Kanban funciona pela conta. Fica registrada aqui para não virar dívida esquecida.

## Leitura

`src/lib/data/tasks.ts`:

- `listTasks` troca `client:clients(id, name, color, code_prefix)` por
  `conta:contas(id, nome)`.
- `listClientsLite` vira `listContasLite`, lendo `contas (id, nome)` ordenado por nome.
  Some o filtro `status = 'active'`, que não existe em `contas` — a fase cumpre esse
  papel e a Decisão 3 diz para não filtrar.
- `resolveTaskCodePrefix` passa a ler `contas.code_prefix`, com `"INT"` como hoje para
  tarefa interna. Se a conta tiver `code_prefix` nulo (conta criada antes da migration
  por alguma janela de corrida), cai em `"INT"` — o código sai menos informativo, nunca
  quebra.

`src/lib/data/hoje.ts`: o join `client:clients(id, name)` vira `conta:contas(id, nome)`.
O rótulo "Interno" para tarefa sem conta continua igual.

## Escrita

`src/lib/actions/tasks.ts`:

- `createTask` recebe `contaId` no lugar de `clientId` e grava `conta_id`.
- `updateTask` **passa a aceitar `conta_id` e `is_internal`** no `patch`. Isto corrige
  de passagem o achado C7 da auditoria: hoje uma tarefa criada como interna nunca vira
  tarefa de cliente, e a única saída é apagar e refazer, perdendo comentários, checklist
  e anexos. É uma linha no tipo do `patch` e faz parte da mesma mudança conceitual.

`src/lib/actions/playbooks.ts`:

- `runPlaybook(playbookId, contaId)` grava `conta_id` na execução e nas tarefas geradas.

`src/lib/actions/deals.ts`:

- `criarContaComNegocio` passa a preencher `code_prefix` pela mesma regra da migration.

## Interação

O que muda na tela, e o que deliberadamente não muda:

- **Kanban, seletor de escopo:** os rótulos "Clientes" e "Interno" continuam. O escopo
  "Clientes" passa a significar "tarefa com conta", e agora tem conteúdo.
- **Nova tarefa:** o seletor lista contas. O beco sem saída de hoje — "Tarefa de
  cliente" com um seletor vazio — deixa de existir.
- **Cartão da tarefa:** o quadradinho colorido sai (Decisão 2); o nome da conta fica.
- **Painel da tarefa:** ganha a possibilidade de trocar a conta e de alternar entre
  interna e de cliente, pelo `updateTask` estendido.
- **Executar playbook:** o seletor de cliente lista contas; executar para uma conta
  gera tarefas já ligadas a ela.
- **Pipeline, Implantação, Painel, Metas, Hoje, Credenciais:** sem mudança.

## Erros

Mesma disciplina do resto do projeto:

- Falha de leitura das contas no Kanban não pode virar "nenhuma conta" — o seletor
  mostra o estado de indisponível, e a criação de tarefa interna continua possível.
- `runPlaybook` com `contaId` de conta apagada entre o clique e a escrita: a FK é
  `on delete set null`, então a execução nasce sem conta em vez de falhar. É o mesmo
  comportamento que `tasks` já tem.

## Testes

Não há infraestrutura de teste de componente React neste projeto (sem
`@testing-library/react`) — limitação registrada desde a Fase 4A e reafirmada na 5F.

Automatizável, e que deve ser escrito:

- **A derivação do prefixo é função pura** e vai para `src/lib/task-codes.ts`, ao lado
  de `buildSequentialCodes`, com teste: nome curto, nome com acento, nome com espaço
  inicial, nome de uma letra, nome vazio.
- A suíte existente de `task-codes` não pode quebrar.

Portões de sempre: `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`, `npm run build`.

**Verificação humana**, sem a qual esta mudança não está confirmada — o ambiente de
trabalho não abre o app:

1. Rodar as duas contagens de `client_id` **antes** de aplicar a migration.
2. Aplicar a migration e conferir que as contas existentes ganharam `code_prefix`.
3. Criar tarefa de cliente escolhendo uma conta; o código sai com o prefixo dela.
4. O Kanban abre no escopo "Clientes" e mostra a tarefa.
5. Executar um playbook para uma conta; as tarefas geradas aparecem ligadas a ela.
6. Trocar uma tarefa de interna para de cliente e vice-versa, sem perder comentários
   nem anexos.
7. `/hoje` mostra o nome da conta no lugar de "Interno" para essas tarefas.

## Riscos

| Risco | Mitigação |
| --- | --- |
| `client_id` não estar todo nulo em produção | Contagem obrigatória antes de aplicar; se houver linha, para e decide com o Samuel |
| Prefixo derivado colidir entre contas | Aceito e explicado: a sequência é compartilhada, os códigos não se repetem |
| Perder o vínculo visual por cliente no quadro | O nome da conta continua no cartão; cor era decoração sem fonte |
| A limpeza de `clients` ser esquecida | Registrada aqui como migration própria, condicionada à verificação humana |
| Conflito com trabalho paralelo no Kanban | O catálogo de Áreas (0018) tocou `NewTaskModal` recentemente; a implementação parte de `main` atual, não da auditoria |

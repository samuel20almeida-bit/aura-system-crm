# Kanban — catálogo de Áreas no lugar do texto livre

**Data:** 2026-08-21
**Status:** Aprovado

## Problema

O campo "Área" do modal "Nova tarefa" (`NewTaskModal.tsx`) é um `<Input>` de
texto livre, com "Estúdio" como valor inicial e um placeholder sugerindo
outros nomes. Sem uma lista real por trás, cada pessoa digita como quiser —
"Financeiro", "financeiro", "Financ." viram três áreas diferentes, e não há
como saber, olhando o Kanban, quais áreas realmente existem na Aura Studio.

## Objetivo

Área vira uma lista de opções pré-cadastradas, com a possibilidade de
cadastrar novas direto no modal — mesmo espírito do "+ Nova categoria" que
Playbooks já tem, sem abrir um segundo modal dentro do modal.

## Restrições

- pt-BR em toda string visível.
- Sem `motion-safe:`.
- Nenhum dado fictício.
- Banco único, sem separação dev/prod.
- Área continua existindo só em tarefas Internas — tarefa de cliente não
  ganha esse campo (decisão explícita, fora do pedido original).

## Arquitetura

Nova tabela `task_areas` (`id`, `nome text not null unique`, `position int
not null`, `criado_em timestamptz not null default now()`), com a mesma
política de RLS permissiva (`authenticated_full_access`) usada em todas as
tabelas deste projeto. A migração já semeia 5 linhas: Estúdio, Financeiro,
Marketing, Comercial, OPS (posições 1–5).

`NewTaskModal.tsx` recebe uma prop nova, `areas: { id: string; nome: string
}[]`, passada pela página que já busca `clients`/`profiles` hoje. O
`<Input>` de texto vira `<Select>` com essas áreas mais uma opção final,
"+ Nova área…". Escolher essa opção revela, no lugar do select, um
`<Input>` de texto (autofoco) com um botão "Adicionar" — sem modal
aninhado.

## Dados

- `listTaskAreas()` novo em `src/lib/data/tasks.ts`, ao lado de
  `listClientsLite`: `select("id, nome").order("position")`.
- `createTaskArea(nome: string)` novo em `src/lib/actions/tasks.ts`, mesmo
  padrão de `createCategory` (Playbooks): calcula a próxima `position`,
  insere, `revalidatePath("/kanban")`. Antes de inserir, verifica com
  `.ilike("nome", nomeAparado)` se já existe uma área com esse nome
  ignorando maiúsculas/minúsculas e espaço nas pontas — se existir,
  devolve a linha existente em vez de duplicar (protege contra
  "Financeiro" vs "financeiro " sem precisar de normalização em código).

## Componente

Ao adicionar uma área nova pelo select: chama `createTaskArea`, insere o
resultado na lista local de áreas do próprio `NewTaskModal` (aparece no
select imediatamente, sem recarregar a página) e já deixa selecionada. Se
a chamada falhar, mostra um texto de erro inline junto do botão
"Adicionar" — o modal não fecha, dá pra tentar de novo, mesmo padrão de
erro já usado no resto do app.

## Erros

- Falha ao criar a área: erro inline, modal continua aberto.
- Falha ao carregar a lista de áreas (RSC): a mesma leitura já existente de
  `clients`/`profiles` na página do Kanban já trata erro de consulta —
  `listTaskAreas` segue o mesmo padrão (devolve `[]` em caso de erro, sem
  quebrar a tela — abrir "Nova tarefa" mostraria só a opção "+ Nova área…").

## Testes

Sem lógica pura nova — é leitura/escrita direta ao Supabase, mesmo padrão
não-testado de `createCategory`/`createPlaybook` em Playbooks. Verificação
pelos 4 comandos de sempre (`npm test`, `tsc --noEmit`, `lint`, `build`).

## Fora de escopo

- Área em tarefas de cliente.
- Editar ou apagar uma área já cadastrada (mesma limitação que Playbooks
  tem hoje para categorias — não há UI de gerenciar, só de listar e
  cadastrar).
- Migrar os valores de `tasks.area` já existentes no banco para IDs da
  tabela nova — `tasks.area` continua sendo a coluna de texto que já
  existia (`0001_schema.sql:142`), só o *que preenche* esse texto que
  passa a vir de um catálogo. Nenhuma migração de dado histórico.

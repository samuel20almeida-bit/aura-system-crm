# Credenciais — novo módulo para guardar senhas e chaves de acesso

**Data:** 2026-08-22
**Status:** Aprovado

## Problema

Hoje não existe lugar centralizado no CRM para guardar credenciais — senhas
e chaves de sistemas, internas da Aura Studio ou de clientes. Ficam
espalhadas fora do sistema (anotações, chat), sem histórico e sem um lugar
único para consultar.

## Objetivo

Uma nova aba "Credenciais" na coluna lateral, com uma lista de credenciais
— internas e de clientes — e CRUD completo (criar, editar, excluir). A
senha/chave fica mascarada por padrão na tela, com um botão para revelar.

## Decisão de segurança

As senhas/chaves são guardadas em **texto simples**, sem criptografia — a
mesma política de acesso (`authenticated_full_access`) usada em todas as
tabelas do banco. Isso foi perguntado e confirmado explicitamente: só
Samuel e Saymon têm acesso ao CRM, e a ausência de criptografia expõe o
dado apenas a quem tiver acesso direto ao banco por fora do app (ex.:
painel do Supabase, uma chave de serviço vazada, um backup que vaze) — não
a um usuário adicional dentro do próprio CRM. Essa decisão foi tomada com
esse risco explicado e aceito. Não há plano de adicionar criptografia
depois como parte deste módulo — se esse risco mudar (ex.: mais pessoas
ganhando acesso ao CRM), é uma decisão nova, fora deste spec.

## Restrições

- pt-BR em toda string visível.
- Sem `motion-safe:`.
- Nenhum dado fictício.
- Banco único, sem separação dev/prod.
- Toda escrita ao banco a partir de componente cliente envolvida em
  `beginMutation()`/`finally { end() }` de `@/lib/realtime/mutation-gate`.

## Arquitetura

Duas tabelas novas:

- `credenciais`: `id uuid` (PK), `nome text not null`, `categoria_id uuid
  not null references credencial_categorias(id)`, `cliente_id uuid
  references clients(id) on delete set null` (nulo = credencial interna),
  `usuario text`, `senha text`, `url text`, `notas text`, `criado_em
  timestamptz not null default now()`, `atualizado_em timestamptz not null
  default now()`.
- `credencial_categorias`: mesmo formato de `task_areas`
  (`0018_task_areas.sql`) — `id uuid` (PK), `nome text not null unique`,
  `position integer not null default 0`, `criado_em timestamptz not null
  default now()`. Semeada com 6 linhas: Hospedagem, E-mail, Domínio, API,
  Financeiro, Outro (posições 0–5).

RLS: política `authenticated_full_access` (`for all using (auth.uid() is
not null) with check (auth.uid() is not null)`) nas duas tabelas, igual a
todas as outras tabelas do projeto.

Nova aba "Credenciais" na `Sidebar` (`src/components/layout/Sidebar.tsx`),
no grupo NEGÓCIO, depois de Playbooks (mesmo grupo, mesma posição relativa
de "conteúdo de referência" que Playbooks já ocupa). Nova rota
`/credenciais` em `src/app/(app)/credenciais/page.tsx`, seguindo a mesma
estrutura de Server Component + Client Component dos demais módulos
(ex. `kanban/page.tsx` + `KanbanClient.tsx`).

## Dados

Em `src/lib/data/credenciais.ts` (arquivo novo, mesmo padrão de
`src/lib/data/tasks.ts`):
- `listCredentials()`: `select("*, categoria:credencial_categorias(id,
  nome), cliente:clients(id, name)").order("nome")` — traz tudo, incluindo
  a senha em texto simples (sem criptografia, não há necessidade de uma
  chamada separada para "revelar"). É o conteúdo principal da página, então
  segue o padrão de `listTasks()` — lança (`throw`) em erro de consulta,
  para acionar o `error.tsx` do grupo `(app)` em vez de mostrar uma lista
  vazia enganosa.
- `listCredentialCategories()`: mesmo formato de `listTaskAreas()`
  (`select("id, nome").order("position")`) — inclusive no tratamento de
  erro (devolve `[]`), porque é dado auxiliar de formulário, não o
  conteúdo principal da tela.

Em `src/lib/actions/credenciais.ts` (arquivo novo, mesmo padrão de
`src/lib/actions/tasks.ts`):
- `createCredential({ nome, categoriaId, clienteId, usuario, senha, url,
  notas })`: insere, `revalidatePath("/credenciais")`.
- `updateCredential(id, { nome, categoriaId, clienteId, usuario, senha,
  url, notas })`: atualiza os campos passados e `atualizado_em = now()`,
  `revalidatePath("/credenciais")`.
- `deleteCredential(id)`: apaga a linha, `revalidatePath("/credenciais")`.
- `createCredentialCategory(nome)`: mesmo padrão de `createTaskArea` —
  calcula a próxima `position`, verifica duplicata com `.ilike("nome",
  nomeAparado).maybeSingle()` antes de inserir (devolve a existente em vez
  de duplicar), `revalidatePath("/credenciais")`.

## Componente

`CredenciaisClient.tsx` (novo, `src/components/credenciais/`):
- Lista as credenciais em cards, cada um mostrando: nome, categoria
  (badge), cliente vinculado ou "Interna", usuário, url. A senha aparece
  mascarada (`••••••••`) com um botão "Mostrar"/"Ocultar" por card — troca
  só de estado local (`useState<Set<string>>` com os ids revelados), sem
  nova chamada ao servidor.
- Filtro por categoria, mesmo padrão dos filtros já existentes no Kanban
  (`<Select>` de categoria acima da lista, `""` = todas).
- Botão "Nova credencial" abre `CredentialModal` (novo componente) — usado
  tanto para criar quanto para editar (recebe uma credencial existente ou
  `null`).
- `CredentialModal`: campos nome, categoria (`<Select>` com "+ Nova
  categoria…" e cadastro inline, idêntico ao padrão de Área no
  `NewTaskModal.tsx` — reaproveitar a mesma estrutura de estado
  `mostrandoNovaCategoria`/`novaCategoriaNome`/etc.), cliente vinculado
  (`<Select>` opcional, primeira opção "Nenhum (interna)"), usuário, senha
  (`<Input type="password">` com toggle de visibilidade ao digitar,
  mesmo padrão comum de formulário de senha), url, notas.
- Excluir: botão em cada card, `if (!confirm("Excluir credencial?")) return;`
  seguido de `deleteCredential(id)` dentro de `beginMutation()`/`end()`,
  mesmo padrão exato de `MetasClient.tsx:78-86`. Toast de erro em falha
  (`notify("error", "Não foi possível excluir a credencial. Tente
  novamente.")`).

## Erros

- Falha ao criar/editar/excluir: toast de erro (`useToast`), mesmo padrão
  do resto do app; o modal não fecha em caso de erro de criar/editar.
- Falha ao criar categoria nova: erro inline no modal, mesmo padrão do
  campo Área do Kanban.
- Falha ao carregar a lista de credenciais (RSC): `listCredentials()`
  lança erro, acionando o `error.tsx` do grupo `(app)` — mesmo padrão de
  `listTasks()`, para não mostrar uma lista vazia enganosa quando a
  consulta falhou de verdade.
- Falha ao carregar o catálogo de categorias (RSC): `listCredentialCategories()`
  devolve `[]` em caso de erro, sem quebrar a tela — mesmo padrão de
  `listTaskAreas()`, já que é só dado auxiliar do formulário.

## Testes

Sem lógica pura nova — leitura/escrita direta ao Supabase, mesmo padrão
não-testado de Metas/Playbooks/Área. Verificação pelos 4 comandos de
sempre (`npm test`, `tsc --noEmit`, `lint`, `build`).

## Fora de escopo

- Criptografia da senha/chave (decisão explícita, ver seção acima).
- Restrição de acesso por pessoa (todas as credenciais visíveis para
  qualquer usuário autenticado, mesma política do resto do banco).
- Histórico de quem revelou/editou uma credencial.
- Autenticação de dois fatores (2FA) e anexos de arquivo (ex. chave
  `.pem`, certificado) — só os campos de texto listados acima.
- Editar ou apagar uma categoria já cadastrada (mesma limitação que
  Playbooks e Área já têm hoje).
- Vincular uma credencial a mais de um cliente, ou a uma tarefa/negócio
  específico — o vínculo é só com `clients`, opcional, um-para-um.

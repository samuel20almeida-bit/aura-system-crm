# Playbooks — trocar de categoria/playbook sem travar a tela

**Data:** 2026-08-20
**Status:** Aprovado

## Problema

Em `/playbooks`, trocar de categoria ou selecionar um playbook usa
`<Link href="/playbooks?category=X&playbook=Y">` (`PlaybooksClient.tsx`) — uma
navegação de página inteira do App Router. Cada clique refaz a consulta ao
Supabase (categorias com contagem, playbooks da categoria, detalhe do
playbook) e só atualiza a tela quando o servidor responde inteiro, sem nada
otimista. O resto do app (Pipeline, Kanban) já recebeu o tratamento de
"resposta imediata" na Fase 1 — clique muda a tela na hora, servidor confirma
depois. Playbooks nunca passou por isso, porque na época só tinha formulários
de criação, não navegação por clique.

## Objetivo

Trocar de categoria fica instantâneo (zero rede). Selecionar um playbook
destaca a linha na hora; só o painel de detalhe espera o servidor, sem travar
o resto da tela.

## Arquitetura

`page.tsx` busca **todos** os playbooks de uma vez (não mais filtrados por
categoria no servidor) — mesmo padrão de "buscar tudo, filtrar em memória"
que `calcularMetricasPainel` e o filtro de tarefas do Kanban já usam.
`PlaybooksBody` (client) guarda `activeCategoryId`/`activePlaybookId`/`detail`
em estado local, seedado pelos props do primeiro render (link direto pra um
playbook específico continua funcionando via SSR). A lista visível de
playbooks é um `useMemo` filtrando o array completo por `activeCategoryId` —
sem chamada de rede na troca de categoria.

## Dados

- `src/lib/data/playbooks.ts`: `listPlaybooksInCategory(categoryId)` vira
  `listAllPlaybooks()` — remove o `.eq("category_id", categoryId)`, mantém o
  resto (mesmo select, mesma ordenação).
- `getPlaybookDetail(id)` não muda.
- `src/lib/actions/playbooks.ts` ganha `getPlaybookDetailAction(id)`, wrapper
  fino de `getPlaybookDetail` marcado `"use server"`, chamável direto do
  client component (leitura, não mutação — mesma técnica de Server Action já
  usada nas mutações existentes deste arquivo, só que para buscar dado em vez
  de escrever).

## Interação

- **Clicar numa categoria**: `setActiveCategoryId` síncrono (destaque muda na
  hora) + `setActivePlaybookId(null)` + `setDetail(null)` (o playbook aberto
  não pertence à nova categoria) + `router.replace(\`/playbooks?category=${id}\`, { scroll: false })`
  em segundo plano, só para manter a URL bookmarkável — não bloqueia nada,
  porque a lista já filtrou em memória antes disso resolver.
- **Clicar num playbook**: `setActivePlaybookId` síncrono (linha destaca na
  hora) + `startTransition(async () => { const d = await getPlaybookDetailAction(id); setDetail(d); router.replace(...) })`.
  Só o painel de detalhe (coluna direita) mostra um estado de carregamento
  discreto (`isPending` do `useTransition`) enquanto isso resolve — categorias
  e lista de playbooks continuam clicáveis normalmente.
- **Criar categoria / criar playbook / rodar playbook**: sem mudança. Já
  usam o padrão "Criando…" existente (`disabled={pending}` + texto de botão),
  são ações raras e deliberadas — não é a navegação repetitiva que estava
  travando.

## Erros

Se `getPlaybookDetailAction` falhar, mostra toast de erro
(`notify("error", "Não foi possível carregar o playbook. Tente de novo.")`,
mesmo padrão já usado em `toggleRunStep`) e mantém o playbook/detalhe
anteriormente selecionado em vez de travar numa tela vazia ou trocar para um
estado inconsistente.

## Testes

Sem infraestrutura de teste de componente React neste projeto (mesma
limitação já documentada nas Fases 4A–4E — não há `@testing-library/react`).
Verificação via `npm test` (suíte existente não deve quebrar), `tsc --noEmit`,
`lint`, `build` — mesmo padrão já usado em toda mudança de UI deste projeto.

## Fora de escopo

- Criar categoria/playbook/rodar um playbook continuam usando
  `router.refresh()`/`router.push()` para o mesmo `/playbooks` depois do
  sucesso — **essa premissa estava errada na primeira versão deste spec**: no
  App Router, navegar para a mesma rota só com search params diferentes NÃO
  remonta o componente (o "state key" que decide remontagem não inclui search
  params), então esses handlers, herdados sem mudança, deixaram de atualizar
  a tela quando a Task 2 moveu `detail`/`activeCategoryId`/`activePlaybookId`
  para `useState` local — achado Critical da revisão final, corrigido fazendo
  essas mutações atualizarem o estado local diretamente, em vez de depender
  do fluxo de props para "trazer dado novo".
- Nenhuma mudança de schema, nenhuma migração.
- Nenhuma mudança no `loading.tsx` da rota (o esqueleto de primeiro
  carregamento continua servindo seu propósito — o problema era a navegação
  *depois* de já estar na página, não o carregamento inicial).

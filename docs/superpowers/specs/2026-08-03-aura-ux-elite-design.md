# Aura Studio — Elevação de UX ao nível de CRM de elite

**Data:** 2026-08-03
**Status:** Aprovado
**Referência de produto:** Notion / Monday (flexibilidade visual)

## Problema

O sistema funciona, mas trava a cada ação e a cada troca de tela. A auditoria do
código mediu a causa:

| Sintoma | Medida |
|---|---|
| Navegação congela em branco entre módulos | 0 arquivos `loading.tsx` |
| Toda ação espera o servidor antes de mudar a tela | 29 chamadas a `router.refresh()` |
| Nada responde na hora | 0 atualizações otimistas |
| Interface parada | 3 classes de animação no app inteiro |
| Layout quebra fora do desktop | 0 breakpoints responsivos |
| Erro trava a tela numa caixa cinza | 3 `alert()` nativos |

Quatro elementos ocupam espaço na interface sem entregar função:

- **Histórico da tarefa** — texto fixo "Sem histórico registrado ainda"
- **Anexos** — a Server Action `addAttachment` existe sem nenhuma interface
- **Timer** — some da tela ao navegar para fora de `/horas`
- **Sino de avisos e visão Timeline** — presentes no mockup, nunca construídos

## Objetivo

Vocês dois operam a agência inteira aqui. O sistema precisa responder como
ferramenta profissional de uso diário: instantâneo, previsível, e flexível o
bastante para mostrar os mesmos dados de várias formas.

## Restrições

- **Desktop** para trabalhar; **celular** para consultar (e três ações de campo)
- Workspace de duas pessoas — sem multi-tenancy, sem permissões por papel
- Supabase (Postgres + Auth + Storage) e Next.js 16 continuam como base
- Nenhum dado fictício: o sistema segue começando vazio

## Sequenciamento

As duas fases carregam trabalho demais para um plano único. **A Fase 1 recebe o
primeiro plano de implementação e entra em uso antes de a Fase 2 começar.** A
Fase 1 constrói as peças — avisos, esqueletos, tabela editável, mecânica de
resposta imediata — que a Fase 2 consome; a ordem inversa geraria retrabalho.

Quando a Fase 1 estiver em uso, a Fase 2 ganha seu próprio plano, revisto à luz
do que vocês sentirem usando o sistema todo dia.

---

## Fase 1 — Fundação

### 1.1 Resposta imediata

Hoje cada mutação percorre: clique → servidor → recálculo da página → tela muda.
Passa a percorrer: clique → **tela muda** → servidor confirma em segundo plano.
Quando o servidor recusa, a interface volta ao estado anterior e explica o motivo
num aviso.

Ações que ganham resposta imediata:

- Mover card entre colunas do Kanban
- Marcar e desmarcar subtarefa
- Concluir tarefa
- Trocar responsável, prazo ou prioridade
- Atualizar progresso de meta
- Mudar status de fatura
- Mover negócio entre etapas do pipeline

**Implementação:** `useOptimistic` do React 19 sobre as Server Actions
existentes. Cada ação já lança erro em falha (corrigido na revisão anterior), o
que a reversão consome diretamente.

### 1.2 Navegação sem tela branca

A estrutura — menu lateral e barra superior — permanece montada; apenas a área
de conteúdo troca. Durante a busca de dados, um esqueleto reproduz o formato do
conteúdo que chega: linhas de tabela, cards, quadrados de indicador.

**Implementação:** um `loading.tsx` por rota em `src/app/(app)/*`, com
componentes de esqueleto no design system. Prefetch do módulo quando o ponteiro
passa sobre o item de menu.

### 1.3 Avisos

Um sistema de avisos substitui os `alert()` e o aviso improvisado do Kanban.
Aparece no canto, segue a paleta da Aura, desaparece sozinho, empilha, e oferece
**Desfazer** nas ações destrutivas (excluir tarefa, meta, subtarefa).

### 1.4 Movimento

Vocabulário curto e consistente, aplicado em todo o sistema:

- Painéis deslizam ao abrir e fechar
- Cards levantam ao serem arrastados
- Linhas destacam sob o ponteiro
- Indicadores contam até o valor
- Itens novos entram com fade rápido

Duração entre 120ms e 240ms. A animação comunica estado; nunca atrasa o usuário.
O sistema respeita `prefers-reduced-motion`.

### 1.5 Histórico da tarefa

A coluna `task_id` entra em `activity_log`. As Server Actions passam a registrar
os eventos de cada tarefa: criação, mudança de status, troca de responsável,
alteração de prazo, subtarefa concluída, horas lançadas. A aba Histórico lê esse
registro filtrado pela tarefa. O feed do Início ganha profundidade pelo mesmo
trabalho.

### 1.6 Timer persistente

O timer sai de `/horas` e vira indicador fixo na barra superior: visível em
qualquer tela, contando ao vivo, com pausar e parar a um clique. O card da tarefa
cronometrada exibe um marcador pulsando no Kanban.

Um aviso dispara quando o timer passa de 8 horas — o caso clássico de timer
esquecido que distorce a rentabilidade do cliente.

### 1.7 Avisos do que precisa de você

O sino deriva tudo de dados existentes, sem tabela nova:

- Faturas vencidas
- Tarefas suas atrasadas ou vencendo hoje
- Contratos que terminam em 30 dias
- Timer rodando há mais de 8 horas

Cada item some quando você resolve a causa.

### 1.8 Anexos

Duas formas convivem numa tarefa:

- **Arquivo** — arrastar e soltar, guardado num bucket do Supabase Storage
  (`task-attachments`), com política de acesso restrita a usuários autenticados
- **Link** — colar endereço do Figma, Drive ou Dropbox com um nome

A tabela `task_attachments` já comporta as duas formas: `filename` e `url`.
Arquivos ganham `storage_path`.

### 1.9 Celular para consultar

O layout responsivo entra por breakpoints do Tailwind:

- Menu lateral vira gaveta acionada por botão
- Tabelas viram lista de cartões, com as duas ou três informações que importam
- Indicadores empilham em dois por linha
- Kanban mostra uma coluna por vez, com abas para alternar

Três ações continuam funcionais no celular: **concluir tarefa**, **iniciar e
parar timer**, **registrar horas**. As demais telas mostram os dados sem oferecer
formulário. Arrastar cards fica fora do celular — mover tarefa entre colunas exige
o desktop, ou a mudança de status pelo painel da tarefa.

---

## Fase 2 — Flexibilidade

### 2.1 Visões múltiplas

Um seletor no topo de cada módulo alterna entre visões dos mesmos dados:

| Módulo | Visões |
|---|---|
| Kanban | Quadro · Tabela editável · Calendário · Timeline |
| CRM | Pipeline · Clientes (tabela editável) · Faturas (filtro por status e período) |
| Horas | Resumo por cliente e pessoa · Semana |

- **Calendário (Kanban):** tarefas por prazo; arrastar um card altera a data de
  entrega
- **Timeline (Kanban):** barras horizontais ao longo das semanas, revelando carga
  sobreposta e períodos apertados
- **Semana (Horas):** grade de dias que expõe os buracos; clicar num dia lança a
  hora esquecida

**A Timeline exige um dado que não existe.** Uma barra precisa de início e fim; a
tabela `tasks` guarda apenas `due_date`. A coluna `start_date` (opcional) entra em
`tasks`, e a barra desenha assim:

- Com `start_date` preenchida — a barra vai de `start_date` até `due_date`
- Sem `start_date` — a barra ocupa apenas o dia do prazo, como marco

As barras agrupam por **cliente**, não por projeto: o sistema não modela projeto
como entidade, e cliente é o agrupamento que vocês já usam no Kanban. Arrastar a
borda de uma barra ajusta início ou prazo; arrastar a barra inteira desloca as
duas datas.

A visão escolhida entra na URL, o que preserva o estado ao recarregar e permite
compartilhar o link exato.

### 2.2 Edição no lugar

Clicar numa célula edita o valor ali mesmo: título, responsável, prazo,
prioridade e cliente da tarefa; dados do cliente; valor e status da fatura;
progresso da meta. Cada edição aparece na hora, pela mecânica da Fase 1.

### 2.3 Filtros e visões salvas

Você combina filtros, nomeia a combinação, e ela fica fixada no topo do módulo —
"minhas tarefas atrasadas", "clientes com fatura vencida", "horas não faturáveis
do mês". As visões salvas pertencem ao workspace, visíveis para vocês dois.

**Implementação:** tabela `saved_views` com módulo, nome, e filtros em JSON.

### 2.4 ⌘K executa

A paleta passa de busca a comando. Além de encontrar tarefas e clientes, executa:
criar tarefa para um cliente, iniciar timer, lançar horas, e navegar para
qualquer visão salva.

---

## Arquitetura

O trabalho concentra as peças compartilhadas em quatro lugares, o que mantém cada
módulo enxuto:

```
src/components/ui/
  Toast.tsx          — avisos empilháveis com Desfazer
  Skeleton.tsx       — formas de carregamento
  DataTable.tsx      — tabela editável, reusada por Kanban, CRM e Horas
  ViewSwitcher.tsx   — seletor de visões, sincronizado com a URL

src/lib/
  optimistic.ts      — envolve Server Action com atualização imediata e reversão
  timezone.ts        — já existe; segue como fonte única de datas
```

Cada visão nova vira um componente isolado que recebe dados já buscados pelo
Server Component da rota. As visões não buscam dados por conta própria, o que
evita cascata de requisições e mantém a busca no servidor.

## Verificação

Cada fase termina com:

1. `npm run build`, `npx tsc --noEmit` e `npm run lint` limpos
2. Teste do caminho crítico com dados reais no Supabase, seguido de limpeza
3. Conferência de que nenhuma ação existente regrediu

O projeto não tem testes automatizados. A revisão de código anterior apontou essa
lacuna como risco real — a Fase 1 introduz testes das funções de maior risco:
geração de código de tarefa, início e parada de timer, e reversão otimista.

## Fora de escopo

- Multi-tenancy, papéis e permissões
- Menções (@) em comentários — duas pessoas que sentam juntas não precisam
- Colunas configuráveis por usuário
- Relatórios exportáveis além do CSV de horas já existente

## Dependência externa

O deploy na Vercel devolve `500 MIDDLEWARE_INVOCATION_FAILED`. A causa provável,
identificada na revisão de código: `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY` ausentes nas variáveis de ambiente do projeto.
Configurar essas duas variáveis e reconectar o projeto ao repositório
`aura-system-crm` libera a visualização de todo este trabalho.

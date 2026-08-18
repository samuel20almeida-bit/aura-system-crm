# Fase 4A — Nomenclatura e responsividade no celular

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar os dois primeiros itens do roteiro de melhorias que o Samuel pediu — nomenclatura consistente e uso decente no celular — sem tocar em nenhuma lógica de negócio: gaveta/modal deixam de estourar a tela em qualquer celular, formulários de duas colunas deixam de espremer em telas estreitas, e "MRR" vira "Mensalidade" em todo lugar visível ao usuário.

**Architecture:** Puramente CSS (classes Tailwind) e texto — nenhuma migration, nenhuma Server Action, nenhuma mudança de schema ou de tipo. Duas correções de alto alcance nos componentes base (`Slideover`, `Modal` em `src/components/ui/Overlay.tsx`) resolvem 8 dos 9 pontos de uso de uma vez; o nono (`NovoNegocioModal.tsx`, que sobrescreve a largura) recebe o mesmo tratamento manualmente. Depois, os grids internos de formulário e os rótulos "MRR" são trocados um a um, arquivo por arquivo.

**Tech Stack:** Next.js App Router (Server + Client Components existentes), Tailwind CSS. Nenhuma dependência nova.

**Base:** `main` @ `daf6c52` (contato da conta, Pipeline editável, em produção). Branch nova: `feat/fase-4a-nomenclatura-celular`.

## Global Constraints

- **Idioma:** português do Brasil em toda string visível ao usuário.
- **Paleta/tipografia:** tokens já existentes em `src/app/globals.css`. Não introduzir cor nem breakpoint novo além do que Tailwind já traz por padrão (`sm:` = 640px).
- **Sem `motion-safe:`** — não gera CSS neste projeto.
- **Sem dado fictício, sem migration.** Esta fase não toca no banco.
- **Verificação por tarefa:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` limpos antes de cada commit. Hoje (antes desta fase): **148 testes**.
- **Sem navegador neste ambiente.** Nunca afirmar ter visto uma tela renderizar ou testado em celular de verdade — a verificação aqui é estrutural (classe Tailwind certa no arquivo certo), não visual.

## Contexto que esta fase herda

Esta é a primeira fase de um roteiro de 5 (4A→4E) que o Samuel aprovou para melhorar o sistema depois que as Fases 3A-3D (núcleo do CRM) já estavam em produção. As fases seguintes (autosave/fluidez, import de planilha, custos da Aura Studio, Painel 2.0 com gráficos) **não fazem parte deste plano** — ficam para depois.

**Achado que fica de fora de propósito, e por quê:** o Kanban usa uma tabela `clients` (schema antigo, ainda viva — alimenta o filtro e o prefixo de código das tarefas, `src/lib/data/tasks.ts`) que é **completamente separada** de `contas` (o CRM novo da Fase 3). São dois registros de "cliente" que não se referenciam um ao outro. Isso não é uma questão de nomenclatura de texto — é uma bifurcação real de modelo de dado, e unificar os dois exigiria decidir uma migração de dado (por exemplo: ganhar um negócio no Pipeline passaria a criar/linkar automaticamente uma linha em `clients`?). Essa decisão é grande o bastante para ser sua própria fase depois — não entra aqui, e não deve ser "corrigida" incidentalmente por nenhuma task abaixo.

## Task 1: Gaveta e modal deixam de ter largura fixa em pixel

**Files:**
- Modify: `src/components/ui/Overlay.tsx`
- Modify: `src/components/pipeline/NovoNegocioModal.tsx:62`

**O problema, exato:** `Slideover` (linha 6, `widthClass = "w-[520px]"`) e `Modal` (linha 27, `widthClass = "w-[480px]"`) têm largura fixa em pixel, sem nenhum breakpoint responsivo. Em qualquer celular com viewport mais estreita que isso — a imensa maioria em retrato, tipicamente 360-430px — a gaveta ou o modal **estoura a largura da tela**: rolagem horizontal real, não só cosmética. Os dois componentes são usados em 9 lugares (`ImplantacaoDrawer`, `NegocioDrawer`, `NovoNegocioModal`, `PlaybooksClient` ×3, `MetasClient`, `TaskDetailPanel`, `NewTaskModal`) — corrigir os dois componentes base resolve 8 desses 9 de uma vez, porque usam o `widthClass` padrão sem sobrescrever.

O nono, `NovoNegocioModal.tsx:62`, sobrescreve com `widthClass="w-[560px]"` — mesmo bug, precisa do mesmo tratamento manualmente, já que uma string passada por prop não herda a correção do valor padrão.

- [ ] **Step 1:** Em `src/components/ui/Overlay.tsx`, troque o valor padrão de `widthClass` em `Slideover`:

  ```tsx
  // antes
  export function Slideover({
    onClose,
    children,
    widthClass = "w-[520px]",
  }: {
  ```
  ```tsx
  // depois
  export function Slideover({
    onClose,
    children,
    widthClass = "w-full sm:w-[520px]",
  }: {
  ```

  Abaixo de `sm:` (640px), a gaveta ocupa a tela inteira; a partir de `sm:`, volta a ter a largura fixa de antes. Não precisa mudar mais nada no componente — o container já é `flex h-full ${widthClass} flex-col`, `w-full` funciona do jeito que está.

- [ ] **Step 2:** No mesmo arquivo, troque o valor padrão de `widthClass` em `Modal`:

  ```tsx
  // antes
  export function Modal({
    onClose,
    children,
    widthClass = "w-[480px]",
  }: {
  ```
  ```tsx
  // depois
  export function Modal({
    onClose,
    children,
    widthClass = "w-full sm:w-[480px]",
  }: {
  ```

  O wrapper externo já tem `px-4` (`flex items-center justify-center bg-ink/20 px-4`), então `w-full` no modal ocupa a largura disponível menos essa margem — não precisa mexer no wrapper.

- [ ] **Step 3:** Acrescente um comentário curto acima da assinatura de cada componente, documentando o contrato para quem passar `widthClass` no futuro (é fácil reintroduzir o mesmo bug sobrescrevendo sem pensar em mobile):

  ```tsx
  /**
   * `widthClass` sempre precisa de um valor `w-full` (ou equivalente) abaixo
   * de `sm:` — a versão fixa em pixel vale só a partir de `sm:` (640px). Sem
   * isso, a gaveta/modal estoura a tela em qualquer celular em retrato.
   */
  ```
  Uma antes de `Slideover`, outra antes de `Modal`.

- [ ] **Step 4:** Em `src/components/pipeline/NovoNegocioModal.tsx:62`, aplique o mesmo padrão ao valor sobrescrito:

  ```tsx
  // antes
  <Modal onClose={onClose} widthClass="w-[560px]">
  ```
  ```tsx
  // depois
  <Modal onClose={onClose} widthClass="w-full sm:w-[560px]">
  ```

- [ ] **Step 5:** Rode `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` — os quatro limpos, 148 testes (nenhum teste novo nesta task, é CSS puro). Commit.

## Task 2: Formulários de duas colunas colapsam para uma no celular

**Files:**
- Modify: `src/components/pipeline/NegocioDrawer.tsx` (5 ocorrências: linhas 127, 140, 151, 240, 248)
- Modify: `src/components/pipeline/NovoNegocioModal.tsx` (5 ocorrências: linhas 114, 128, 137, 153, 165)
- Modify: `src/components/implantacao/ImplantacaoDrawer.tsx` (1 ocorrência: linha 118)
- Modify: `src/components/playbooks/PlaybooksClient.tsx` (1 ocorrência: linha 274)
- Modify: `src/components/kanban/NewTaskModal.tsx` (1 ocorrência: linha 101)

**O problema:** mesmo depois da Task 1 (gaveta/modal ocupando a tela inteira no celular), os campos continuam lado a lado dentro dela porque o grid interno é `grid-cols-2` fixo, sem prefixo responsivo — dois `<Input>` de ~170px cada numa tela de 375px, com label e placeholder cortados. Confirmado por grep: são 13 ocorrências exatas nesses 5 arquivos (nenhuma outra no projeto — os únicos outros `grid-cols-2` do código são em `src/components/ui/Skeleton.tsx`, que já têm `md:grid-cols-3`/`md:grid-cols-4` e não fazem parte deste achado).

As **linhas de números de coluna acima já mudaram** desde que este plano foi escrito, se a Task 1 inseriu ou removeu linhas nesses mesmos arquivos — confira com `grep -n "grid-cols-2" <arquivo>` antes de editar cada um, não confie cegamente no número da linha.

- [ ] **Step 1:** Em cada um dos 13 pontos listados acima, troque `grid-cols-2` por `grid-cols-1 sm:grid-cols-2`. Exemplo (`NegocioDrawer.tsx`, par NICHO/CIDADE+UF):

  ```tsx
  // antes
  <div className="grid grid-cols-2 gap-3">
  ```
  ```tsx
  // depois
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
  ```

  O mesmo padrão, sem variação, nos 13 pontos — incluindo `ImplantacaoDrawer.tsx:118`, que é texto curto (não `<Input>`), não formulário: mesmo assim colapsa para manter a mesma régua de breakpoint em toda a base, e por segurança em telas muito estreitas (iPhone SE, 320px) onde até texto curto lado a lado fica apertado.

  **Não mexa** nos grids aninhados menores dentro desses blocos (ex: `grid-cols-[1fr_72px]` para CIDADE/UF em `NegocioDrawer.tsx`/`NovoNegocioModal.tsx`) — CIDADE e UF cabem lado a lado mesmo numa coluna só, é exatamente o desenho que já existe hoje para essa dupla.

- [ ] **Step 2:** Rode `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` — os quatro limpos, 148 testes. Commit.

## Task 3: "MRR" vira "Mensalidade" no Painel

**Files:**
- Modify: `src/app/(app)/painel/page.tsx` (6 ocorrências: linhas 39, 56, 67, 73, 81, 97)

**O problema:** em `NegocioDrawer.tsx` e `NovoNegocioModal.tsx` o mesmo campo sempre foi rotulado "MENSALIDADE (R$)" — é o vocabulário que o resto do sistema já usa. O Painel (Fase 3D) introduziu "MRR" (a sigla em inglês) nos rótulos das métricas, sem ninguém decidir isso conscientemente — só aconteceu porque quem escreveu o Painel vinha do vocabulário de SaaS em inglês. Decisão: padronizar em "Mensalidade", que é o termo que já vencia em todo o resto do app.

**O que muda, exatamente** (`src/app/(app)/painel/page.tsx`):

- [ ] **Step 1:** Linha 39, o rótulo do primeiro KPI:
  ```tsx
  // antes
  label="MRR ativo"
  ```
  ```tsx
  // depois
  label="Mensalidade ativa"
  ```

- [ ] **Step 2:** Linha 56, o `sub` do KPI "Ticket médio":
  ```tsx
  // antes
  sub={metricas.ticketMedio === null ? "sem negócio aberto" : "MRR por negócio aberto"}
  ```
  ```tsx
  // depois
  sub={metricas.ticketMedio === null ? "sem negócio aberto" : "Mensalidade por negócio aberto"}
  ```

- [ ] **Step 3:** Linha 67, o `sub` do KPI "Esperando go-live":
  ```tsx
  // antes
  sub="MRR ganho, implantação ainda aberta"
  ```
  ```tsx
  // depois
  sub="Mensalidade ganha, implantação ainda aberta"
  ```

- [ ] **Step 4:** Linha 81, o `sub` do KPI "Setup na receita" (só a string visível — o comentário acima dela, linha 73, também cita "MRR" duas vezes; troque por "mensalidade" ali também, minúsculo, por consistência interna do comentário, mas isso é comentário de código, não string de usuário — não é obrigatório, faça se for rápido):
  ```tsx
  // antes
  sub={metricas.setupNaReceita === null ? "sem valor registrado nos ganhos" : "setup vs. 1 mês de MRR"}
  ```
  ```tsx
  // depois
  sub={metricas.setupNaReceita === null ? "sem valor registrado nos ganhos" : "setup vs. 1 mês de mensalidade"}
  ```

- [ ] **Step 5:** Linha 97, o cabeçalho da tabela Origem → Receita:
  ```tsx
  // antes
  <th className="py-1.5 pr-3 font-normal">MRR</th>
  ```
  ```tsx
  // depois
  <th className="py-1.5 pr-3 font-normal">Mensalidade</th>
  ```

  **Não mude** nomes de campo/tipo internos (`metricas.mrrAtivo`, `n.mrr`, `MetricasPainel.mrrEsperandoGoLive` etc., em `src/lib/painel.ts`, `src/lib/data/painel.ts`, `src/lib/painel.test.ts`) — são identificadores de código, não texto exibido, e renomeá-los é um escopo diferente (risco de regressão em teste sem nenhum ganho visível ao usuário). Só o que aparece na tela muda.

- [ ] **Step 6:** Rode `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` — os quatro limpos, 148 testes (nenhum teste verifica texto de rótulo, só a lógica pura — nenhuma mudança esperada em `painel.test.ts`). Commit.

## Verificação final da 4A

Mesmo ciclo das fases anteriores: revisão da branch inteira contra `main` (as 3 tasks somadas, buscando o que uma revisão por task isolada não veria — por exemplo, se sobrou algum `grid-cols-2` sem o par responsivo, ou algum "MRR" esquecido fora do Painel), rodada de correção se necessário, merge com fast-forward, push, confirmar deploy na Vercel.

**O que só o Samuel/Saymon podem fazer:** abrir o sistema no celular de verdade e conferir que nenhuma gaveta ou modal estoura a tela, e que os formulários ficam legíveis em uma coluna — isso é exatamente o que este ambiente não consegue verificar sozinho (sem navegador). A verificação automatizada aqui garante que a classe certa está no arquivo certo; o teste de "parece bom na mão" é humano.

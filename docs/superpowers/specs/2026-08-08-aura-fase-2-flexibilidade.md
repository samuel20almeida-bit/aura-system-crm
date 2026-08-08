# Fase 2 — Flexibilidade

**Data:** 2026-08-08
**Status:** rascunho, aguardando revisão do Samuel
**Fase anterior:** `2026-08-03-aura-ux-elite-design.md` (Fase 1, concluída)

## A régua

Samuel definiu o critério, e ele é melhor que "gostei / não gostei":

> Se fosse pra tornar isso comercial e vender pra outras pessoas, elas não iam gostar de usar. É isso que métrifica o que eu quero: algo que as pessoas no mundo real realmente pagariam para utilizar — porém quero apenas para meu uso.

O sistema não vai ser vendido. Mas a régua é essa, e cada item abaixo responde à mesma pergunta: **isso faria alguém pagar?** O que não responde, sai.

## O diagnóstico

A Fase 1 consertou **reatividade** — o sistema responde ao clique, avisa quando falha, não perde trabalho, não deixa o usuário no escuro. É pré-requisito: uma ferramenta que engasga não se vende de jeito nenhum.

Ela não mexeu em **capacidade**. Os dados aparecem de um jeito só, editam-se por janela modal, não há busca global, não há atalho, não há como montar a própria visão. É daí que vem a sensação de "não parece robusto" — e é o escopo inteiro desta fase.

A ordem foi deliberada (flexibilidade sobre base que engasga não se sustenta), mas a consequência é que a coisa que o usuário quer está toda deste lado.

## Os oito itens, por impacto

A ordem é de impacto sobre a sensação de robustez, e cada item depende dos anteriores.

### 1. O endereço reproduz a tela

Filtro, ordenação, agrupamento, colunas visíveis, tipo de visão e registro aberto passam a viver na URL. Copiar a barra de endereço e mandar pro Saymon reproduz exatamente o que você está vendo.

É o alicerce dos itens 3 e 4: uma **visão salva** passa a ser só um estado de URL guardado com nome, não uma segunda implementação.

Hoje esse estado vive em `useState` dentro de cada componente e morre no refresh.

### 2. Edição no lugar

Clicar no campo, digitar, sair. Prazo, responsável, prioridade, título, valor, status — sem abrir modal.

É o item que mais muda a sensação da ferramenta por unidade de trabalho. Uma ferramenta que exige três cliques e uma janela para mudar uma data é uma ferramenta que se abandona.

Requisitos: otimismo (o valor muda antes da resposta do servidor, e volta se falhar — a mecânica da Fase 1 já existe), `Enter` confirma, `Esc` cancela, `Tab` vai pro próximo campo.

### 3. Os mesmos dados, várias visões

| Módulo | Visões |
| --- | --- |
| Tarefas | quadro · lista · calendário · linha do tempo |
| Clientes | tabela · cartões |
| Faturas | tabela · calendário de vencimentos |
| Metas | lista por área · linha do tempo do trimestre |

O quadro já existe. As outras leem os mesmos dados com outra apresentação — nenhuma consulta nova, nenhuma tabela nova.

**Agrupar é do usuário.** No quadro, hoje as colunas são o status, fixo. Passa a ser escolha: agrupar por status, por cliente, por responsável, por prioridade.

### 4. Visões salvas

"Meus atrasados", "Nimbus este mês", "o que o Saymon está tocando" — monta uma vez, vira uma aba sua.

Tabela nova `saved_views`: dono, módulo, nome, configuração (o estado da URL serializado), posição, e se é compartilhada com o outro fundador.

É o item que transforma o sistema de "tela que alguém desenhou" em "ferramenta que eu configurei".

### 5. ⌘K e gaveta de registro

Um campo de busca que alcança cliente, tarefa, fatura, negócio e playbook, com resultados do servidor.

E o detalhe que separa as ferramentas boas das medianas: o resultado abre numa **gaveta sobre a tela atual**, não navega para outra página. Você consulta e volta sem perder o contexto — e sem esperar carregamento nenhum.

Referência estudada: `trycompai/crm`, `apps/app/components/crm/quick-switcher.tsx`.

### 6. Ação em lote

Coluna de seleção, barra de ação que aparece quando há seleção: mudar responsável, mudar prazo, mudar status, arquivar — em cinco linhas de uma vez.

### 7. Desfazer de verdade

`⌘Z` e um botão "desfazer" no aviso, para toda ação destrutiva ou de difícil reversão: excluir, mover, mudar em lote.

A API de desfazer já existe no sistema de avisos desde a Fase 1, e **nenhum lugar a usa** — está anotado como pendência no ledger da Task 2. Esta fase é onde ela ganha os chamadores.

### 8. Teclado

`/` busca · `⌘K` paleta · `j`/`k` navegam na lista · `e` edita · `c` cria · `Esc` fecha · `⌘Enter` salva.

Quem usa todo dia não quer mouse. É o item de menor impacto isolado e o maior em conjunto: é o que faz o sistema parecer feito para trabalhar, não para visitar.

## O que fica de fora, e por quê

- **Agente de IA.** O valor é proporcional ao volume que não se pesquisa à mão. Dois sócios com poucas dezenas de registros pesquisam melhor que qualquer agente. Reavaliar quando a prospecção fria existir e doer.
- **Multiusuário além de dois.** Não há organizações neste sistema, deliberadamente. Um `organizationId` que é sempre o mesmo valor é uma coluna, um índice e uma checagem de permissão que não compram nada.
- **Relatórios e gráficos.** Só depois de a base ter dados reais suficientes para um gráfico não mentir.

## Decisões pendentes

- Ordem exata das tarefas do plano de implementação.
- Se as visões salvas nascem compartilhadas entre os dois fundadores ou privadas por padrão.
- Se a linha do tempo de tarefas mostra dependências ou só datas.

## Verificação

Cada item acima é verificável com o sistema aberto, não com um relatório. A régua de aceitação de cada um é a pergunta do topo, respondida pelo Samuel usando o sistema — não por mim descrevendo o que construí.

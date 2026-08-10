# Fase 2 — Tempo real e flexibilidade

**Data:** 2026-08-08 (reescrito com tempo real no topo; escopo da Parte I decidido)
**Status:** rascunho, aguardando revisão do Samuel
**Fase anterior:** `2026-08-03-aura-ux-elite-design.md` (Fase 1, em produção)

## A régua

Samuel definiu o critério:

> Se fosse pra tornar isso comercial e vender pra outras pessoas, elas não iam gostar de usar. É isso que métrifica o que eu quero: algo que as pessoas no mundo real realmente pagariam para utilizar — porém quero apenas para meu uso.

O sistema não vai ser vendido. A régua é essa mesmo assim, e cada item responde à mesma pergunta: **isso faria alguém pagar?** O que não responde, sai.

## O diagnóstico

A Fase 1 consertou **reatividade**: o sistema responde ao clique, avisa quando falha, não perde trabalho, não deixa o usuário no escuro. É pré-requisito.

Faltam duas coisas, e a ordem entre elas mudou depois que Samuel disse *"precisamos dessa visibilidade em tempo real"*:

1. **Verdade compartilhada.** Duas pessoas usando ao mesmo tempo e vendo coisas diferentes.
2. **Capacidade.** Os dados aparecem de um jeito só, editam-se por janela, sem busca global, sem atalho, sem visão própria.

A primeira é mais fundamental. Uma ferramenta de equipe que mostra dados velhos não é uma ferramenta de equipe — é uma planilha com cara bonita, e ninguém paga por isso.

---

# Parte I — Tempo real

## O problema, como ele acontece hoje

Verificado no código (zero assinaturas) e no banco (zero tabelas publicando mudanças): **não há nada de tempo real.**

Samuel move um card. A tela dele muda na hora — mecânica otimista da Fase 1, e ela é **só dele**. A tela do Saymon continua na versão antiga por tempo indeterminado, sem nenhum sinal de que está velha. Se ele deixou o Kanban aberto e foi almoçar, ao voltar vê a tela de duas horas atrás.

E o caso que morde: os dois editam a mesma tarefa, **o último a salvar sobrescreve o outro em silêncio**.

## O que "visibilidade do que o outro está fazendo" quer dizer aqui

Samuel pediu o que for melhor para isso e delegou a escolha. **Os seis itens abaixo entram, nesta ordem** — que é a ordem de valor sobre custo, não a de vistosidade:

### 1. A mudança do outro aparece sozinha

A base. Sem isso, nada mais importa. Publicar `tasks`, `invoices`, `clients`, `deals` e `time_entries`; assinar no navegador; aplicar RLS no canal, porque assinatura que ignora permissão é vazamento por outra porta.

**A armadilha:** tempo real mistura mal com o otimismo da Fase 1. Três regras não negociáveis:

- O eco da **própria** ação não redesenha nada.
- Atualização **nunca** apaga o que está sendo digitado nem fecha janela aberta.
- Rajada de mudanças vira **uma** atualização, não dez.

### 2. Fluxo de atividade ao vivo — o melhor negócio da fase

**A tabela `activity_log` já existe e já está sendo preenchida.** Cada ação escreve nela desde a Task 7: quem criou tarefa, quem moveu para qual coluna, quem trocou responsável, quem mudou prazo, quem concluiu subtarefa, quem lançou horas, quem criou meta, quem adicionou cliente.

Ela está guardando tudo e **ninguém vê**, exceto dentro da aba Histórico de uma tarefa específica.

Transmitir esse fluxo é a resposta mais direta à pergunta "o que o outro está fazendo", e é o item mais barato da lista inteira — os dados já estão lá, escritos, corretos. Falta uma tela e uma assinatura.

Onde: um painel na `/início` e um item no sino. *"Saymon moveu Finalizar o CRM para Em andamento · há 2 min."*

### 3. Quem está online, e em que tela

O Supabase traz presença embutida — não precisa de tabela, coluna nem migração. Um avatar na barra superior mostrando que o outro está no sistema, e em qual módulo.

Custo baixo, e responde metade da pergunta sozinho: saber que o Saymon está no CRM agora muda o que você faz em seguida.

### 4. Cronômetro do outro à vista

*"Saymon · 0:42 em NIM-04"* na barra superior.

Numa agência isso não é enfeite: é como você sabe que o outro está tocando aquele cliente **agora**, sem perguntar. A infraestrutura de cronômetro já existe inteira desde a Task 8; falta transmitir.

### 5. Colisão avisa em vez de sobrescrever

O sistema percebe e diz *"o Saymon mudou isso enquanto você editava"*, com o valor dele à vista, antes de sobrescrever.

**Exige trabalho de banco que ainda não existe.** Conferido: das 17 tabelas, só `tasks`, `deals` e `playbooks` guardam quando foram alteradas, e apenas `playbooks` guarda **quem**. Sem essas duas colunas não há como detectar colisão nem dizer de quem foi a mudança.

- `updated_at` e `updated_by` nas tabelas que duas pessoas editam, mantidas **por gatilho** e não pela aplicação — o que a aplicação esquece de preencher, o banco não esquece.
- A escrita compara com o valor que a tela carregou. Diferente, avisa.

É o item mais caro desta parte, e o único que mexe no esquema. Mas é o único que impede vocês de apagarem o trabalho um do outro sem saber.

### 6. Sinal honesto de defasagem

Conexão caída — celular no elevador, rede ruim — a tela **diz** que parou de receber, em vez de mostrar dados velhos com cara de novos. Mesma regra que a Fase 1 aplicou ao sino.

## Fora do escopo: cursores

Cursor do outro se mexendo na tela. Bonito em demonstração, inútil para duas pessoas que trabalham em coisas diferentes. Presença (item 3) entrega o sinal que importa por uma fração do custo.

# Parte II — Flexibilidade

Ordem por impacto sobre a sensação de robustez; cada item depende dos anteriores.

## 4. O endereço reproduz a tela

Filtro, ordenação, agrupamento, colunas visíveis, tipo de visão e registro aberto passam a viver na URL. Copiar a barra de endereço e mandar pro Saymon reproduz exatamente o que você vê.

É o alicerce dos itens 6 e 7: uma **visão salva** vira um estado de URL guardado com nome, não uma segunda implementação. Hoje esse estado vive em `useState` e morre no refresh — e, com tempo real chegando, estado que morre a cada atualização é bug garantido.

## 5. Edição no lugar

Clicar no campo, digitar, sair. Prazo, responsável, prioridade, título, valor, status — sem abrir janela.

É o item que mais muda a sensação por unidade de trabalho. Uma ferramenta que exige três cliques e uma janela para mudar uma data é uma ferramenta que se abandona. Requisitos: otimismo (a mecânica da Fase 1 já existe), `Enter` confirma, `Esc` cancela, `Tab` vai pro próximo campo — e o campo em edição é imune à atualização por tempo real.

## 6. Os mesmos dados, várias visões

| Módulo | Visões |
| --- | --- |
| Tarefas | quadro · lista · calendário · linha do tempo |
| Clientes | tabela · cartões |
| Faturas | tabela · calendário de vencimentos |
| Metas | lista por área · linha do tempo do trimestre |

O quadro já existe. As outras leem os mesmos dados com outra apresentação — nenhuma consulta nova, nenhuma tabela nova.

**Agrupar é escolha do usuário.** Hoje as colunas do quadro são o status, fixo. Passa a poder ser status, cliente, responsável ou prioridade.

## 7. Visões salvas

"Meus atrasados", "Nimbus este mês", "o que o Saymon está tocando" — monta uma vez, vira uma aba sua. Tabela `saved_views`: dono, módulo, nome, a configuração serializada, posição, e se é compartilhada.

É o que transforma o sistema de "tela que alguém desenhou" em "ferramenta que eu configurei".

## 8. ⌘K e gaveta de registro

Busca que alcança cliente, tarefa, fatura, negócio e playbook, com resultados do servidor. O resultado abre numa **gaveta sobre a tela atual**, sem navegar — consulta e volta sem perder o contexto.

Referência estudada: `trycompai/crm`, `apps/app/components/crm/quick-switcher.tsx`.

## 9. Ação em lote

Coluna de seleção, barra de ação quando há seleção: mudar responsável, prazo, status, arquivar — cinco linhas de uma vez.

## 10. Desfazer de verdade

`⌘Z` e um botão "desfazer" no aviso, para toda ação destrutiva ou de difícil reversão. A API de desfazer **já existe** no sistema de avisos desde a Fase 1 e nenhum lugar a usa — está anotado como pendência no ledger da Task 2. Esta fase dá chamadores a ela.

## 11. Teclado

`/` busca · `⌘K` paleta · `j`/`k` navegam · `e` edita · `c` cria · `Esc` fecha · `⌘Enter` salva. Isolado é o menor impacto; em conjunto é o que faz parecer ferramenta de trabalho e não de visita.

---

## Dívida da Fase 1 que entra nesta fase

Do ledger, o que não foi corrigido e passa a doer com duas pessoas usando ao mesmo tempo:

- `/metas` e `/playbooks` nunca receberam layout de celular. A gaveta promete seis destinos e dois entregam desktop.
- Acessibilidade da gaveta e do sino: fechada, a gaveta continua no DOM e focável; o sino não fecha com `Escape`.
- 14 a 21 consultas por navegação, com `profiles` lido quatro vezes na `/início`. Aguenta duas pessoas; é o número que muda a resposta se virar produto.
- Consultas do CRM sem limite: `getCrmData` traz as tabelas inteiras e filtra em JavaScript. Aos mil registros o corte silencioso do PostgREST faz a receita do mês mentir.

## Fora do escopo

- **Agente de IA.** O valor é proporcional ao volume que não se pesquisa à mão. Reavaliar quando a prospecção fria existir e doer.
- **Multiusuário além de dois.** Não há organizações neste sistema, deliberadamente.
- **Relatórios e gráficos.** Só depois de a base ter dados reais suficientes para um gráfico não mentir.

## Decisões pendentes

- Visões salvas nascem privadas ou compartilhadas entre os dois?
- A linha do tempo de tarefas mostra dependências ou só datas?

## Verificação

Cada item é verificável com o sistema aberto, não com um relatório. Tempo real, em particular, **só se verifica com duas telas abertas ao mesmo tempo** — o que significa Samuel e Saymon, porque eu não tenho navegador. A régua de aceitação é a pergunta do topo, respondida por quem usa.

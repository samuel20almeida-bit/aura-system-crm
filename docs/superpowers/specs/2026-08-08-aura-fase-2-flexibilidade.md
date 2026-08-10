# Fase 2 — Tempo real e flexibilidade

**Data:** 2026-08-08 (reescrito com tempo real no topo)
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

Samuel move um card no Kanban. A tela dele muda na hora — mecânica otimista da Fase 1, e ela é **só dele**. A tela do Saymon continua mostrando o card na coluna antiga, por tempo indeterminado, até ele navegar, recarregar ou executar uma ação. Se ele deixou o Kanban aberto e foi almoçar, ao voltar vê a tela de duas horas atrás, **sem nenhum sinal de que está velha**.

O caso que morde de verdade: os dois abrem a mesma tarefa e editam. **O último a salvar sobrescreve o outro, em silêncio.** Nenhum dos dois fica sabendo.

## 1. Mudança do outro aparece sozinha

O Supabase já traz isso — foi uma das razões de tê-lo escolhido. Falta ligar:

- **Publicar as tabelas** que importam. Começar por `tasks`, `invoices`, `clients`, `deals`, `time_entries`; ampliar depois se fizer falta.
- **Assinar no navegador** e, quando algo mudar, pedir dados novos ao servidor. Como as telas são componentes de servidor, isso encaixa sem reescrever nada para guardar estado no cliente.
- **Aplicar as permissões no canal.** Uma assinatura que ignora RLS é vazamento por outra porta.

**A armadilha, que precisa ser resolvida de propósito:** tempo real mistura mal com o otimismo da Fase 1. Se a tela já mostrou a mudança e o aviso do servidor chega depois, ela pisca ou volta atrás. Três regras não negociáveis:

- O eco da **própria** ação não redesenha nada.
- Atualização **nunca** apaga o que está sendo digitado, nem fecha janela aberta.
- Rajada de mudanças vira **uma** atualização, não dez.

## 2. Colisão avisa em vez de sobrescrever

Hoje o último a salvar ganha, calado. O mínimo aceitável é o sistema perceber e dizer: *"o Saymon mudou isso enquanto você editava"*, com o valor dele à vista, antes de sobrescrever.

**Isso exige trabalho de banco que ainda não existe.** Conferido: só `tasks`, `deals` e `playbooks` guardam quando foram alteradas, e apenas `playbooks` guarda **quem** alterou. Sem essas duas colunas não há como detectar colisão nem dizer de quem foi a mudança. Então:

- `updated_at` e `updated_by` nas tabelas que duas pessoas editam, mantidas por gatilho e não pela aplicação — o que a aplicação esquece de preencher, o banco não esquece.
- A escrita compara com o valor que a tela carregou. Diferente, avisa.

## 3. Sinal honesto de defasagem

Enquanto a conexão estiver caída — celular no elevador, rede ruim — a tela precisa **dizer** que parou de receber, em vez de continuar exibindo dados velhos com cara de novos. É a mesma regra que a Fase 1 aplicou ao sino: um número desatualizado sem aviso é pior que um aviso.

## Fora do escopo: presença

*"Saymon está vendo esta tarefa agora"*, cursores, avatares na tela. É bem maior e resolve um problema que duas pessoas não têm. Reavaliar se a equipe crescer.

---

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

- Até onde vai o tempo real: só ver a mudança aparecer (item 1) ou também o aviso de colisão (item 2)?
- Visões salvas nascem privadas ou compartilhadas entre os dois?
- A linha do tempo de tarefas mostra dependências ou só datas?

## Verificação

Cada item é verificável com o sistema aberto, não com um relatório. Tempo real, em particular, **só se verifica com duas telas abertas ao mesmo tempo** — o que significa Samuel e Saymon, porque eu não tenho navegador. A régua de aceitação é a pergunta do topo, respondida por quem usa.

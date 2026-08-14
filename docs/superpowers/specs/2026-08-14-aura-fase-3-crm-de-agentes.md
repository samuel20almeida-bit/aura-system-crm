# Fase 3 — O CRM do negócio de agentes

**Data:** 2026-08-14
**Status:** rascunho, aguardando revisão do Samuel
**Origem:** protótipo `auracrminterfaces.html` enviado pelo Samuel, mais a confirmação de que **o negócio mudou**.

## O que mudou

A Aura vendia design por projeto. Agora vende **agentes de WhatsApp para negócios locais** — clínicas odontológicas e barbearias — cobrando **setup + mensalidade**.

Isso não é uma tela nova. É outro modelo econômico:

| | Antes | Agora |
| --- | --- | --- |
| Cobrança | por projeto / por hora | setup + MRR |
| Métrica-mãe | rentabilidade por cliente | MRR, churn, expansão |
| Ciclo | briefing → entrega → fim | prospecção → proposta → implantação → assinatura |
| Risco | estourar horas | esquecer um lead e perder mensalidade |

O sistema no ar foi construído para a coluna da esquerda.

## A régua não mudou

> Algo que as pessoas no mundo real realmente pagariam para utilizar.

## As quatro ideias do protótipo que valem mais que o resto

Registradas porque são decisões de produto, não de tela, e é por elas que este documento existe.

### 1. O pipeline termina em Proposta

*"Ganho não é coluna — é passagem de bastão."*

O CRM atual tem "Fechado" como última coluna do funil, e isso é errado: fechar não é o fim de nada, é o começo da implantação. São duas esteiras com donos diferentes — Samuel no comercial, Saymon no build — e juntá-las numa régua só esconde onde o trabalho realmente trava.

### 2. "Apodrecendo"

Um negócio está podre quando **não tem próximo passo** ou está **parado há mais de 7 dias**. Ganha um ponto vermelho que pulsa.

É a ideia mais valiosa do arquivo inteiro, porque ataca o jeito real de perder venda: não é perder para o concorrente, é **esquecer**. E é a mesma disciplina que a Fase 1 aplicou a fatura vencida — a condição é **derivada da data**, nunca de um status que alguém precisa lembrar de marcar.

Vai ser função pura e testada, como `isInvoiceOverdue`.

### 3. Implantação com prazo por etapa

Seis etapas, cada uma com um SLA em dias: pago→kickoff (1), coleta de acessos (1), build do agente (2), teste com o cliente (1), go-live (1), acompanhamento D+7 (7). Estourou o prazo da etapa, acende.

Os prazos são **dados, não código** — vocês vão querer ajustá-los depois das primeiras dez implantações.

### 4. "Hoje": três fontes, um formato

Próximo passo de negócio + etapa de implantação vencendo + tarefa avulsa, tudo numa lista só, cada linha com dono e data.

Isto **substitui** o card "PRECISA DE VOCÊ" e o sino da Fase 1, que hoje dizem a mesma coisa em dois lugares com dados diferentes — dívida registrada no ledger da Fase 1 e que esta fase quita.

## O modelo de dados

O erro a evitar é o do protótipo: três listas separadas (`deals`, `implantacoes`, `clientes`) para o **mesmo negócio** em momentos diferentes da vida. Isso perde histórico e obriga a copiar dado de uma para a outra.

**Uma conta, várias fases.**

**`accounts`** — o negócio em si, do primeiro contato ao churn.
`nome`, `nicho`, `cidade`, `uf`, `decisor_nome`, `software_atual`, `origem`, `dono`, `fase` (`prospect` · `implantacao` · `cliente` · `perdido` · `churn`).

**`deals`** — a tentativa de venda. Uma conta pode ter mais de uma ao longo do tempo (perdeu em maio, voltou em outubro), e o histórico das duas sobrevive.
`account_id`, `estagio` (Lead · Contato · Qualificado · Diagnóstico · Proposta), `setup`, `mrr`, `proximo_passo` (texto), `proximo_passo_em` (data), `mexido_em`, `resultado` (`null` · `ganho` · `perdido`), `motivo_perda`, `fechado_em`.

**`implantacoes`** — nasce quando um deal é ganho.
`account_id`, `deal_id`, `etapa`, `etapa_desde`, `concluida_em`.

**`implantacao_etapas`** — tabela de referência: `posicao`, `nome`, `sla_dias`. Editável sem deploy.

**`assinaturas`** — nasce no go-live.
`account_id`, `tier`, `mrr`, `inicio`, `fim`, `motivo_fim`. O movimento de MRR (novo · expansão · contração · churn) é **derivado** daqui, não uma tabela própria.

**`account_sinais`** — uso do agente: mensagens, taxa de uso, agendamentos, última interação.

## O buraco que eu não vou fingir que não existe

A tela de Clientes do protótipo mostra "uso 88%", "1240 mensagens", "96 agendamentos". **Esses números não têm fonte.** Eles vivem na plataforma onde os agentes rodam, e o sistema não fala com ela.

Três saídas, e é decisão do Samuel:

1. **Integração** com a plataforma dos agentes — a melhor, e a que exige saber qual é e se tem API.
2. **Lançamento manual** semanal — funciona para quatro clientes, não para quarenta.
3. **Cortar a tela de Clientes desta fase** e entregá-la quando houver fonte.

Enquanto não houver decisão, os campos existem no banco e a tela mostra o que estiver preenchido. **Nenhum número inventado**, como em toda esta empreitada.

## O que morre, o que sobrevive

**Morre: Horas & rentabilidade.** Cobrança por hora deixou de existir; rentabilidade por projeto não é a pergunta do negócio novo.

*Ressalva:* medir quanto tempo uma implantação custa continua sendo pergunta boa — é o que diz se o setup está barato demais. Sugiro **não apagar** `time_entries`: aposentar a tela e manter o cronômetro amarrado à implantação, para responder isso quando houver dez implantações fechadas.

**Sobrevive e ganha sentido:**
- **Tarefas** — o protótipo tem tarefas internas com dono, prazo e vínculo. É o Kanban atual, alimentando a tela Hoje.
- **Metas** — "caminho até R$100k/mês" é literalmente uma meta com progresso.
- **Playbooks** — a esteira de implantação **é** um playbook com prazos. O motor já existe; ganha o uso que faltava.

**Sobrevive inteiro:** tempo real (Parte I da Fase 2), avisos, esqueletos, anexos, histórico, celular. Foi construído no nível certo para não depender do modelo de negócio.

## As telas

| Tela | Responde |
| --- | --- |
| **Hoje** | O que exige ação minha, agora, de qualquer uma das três fontes |
| **Pipeline** | Onde está cada venda e qual está apodrecendo |
| **Implantação** | Quem está esperando, em que etapa, há quantos dias, estourou o prazo? |
| **Clientes** | Quem está saudável, quem dá upsell, quem está prestes a sair |
| **Painel** | De onde vem o próximo real |

## Ordem de construção

Por valor entregue, não por completude.

**3A — O núcleo.** `accounts` + `deals` + próximo passo + "apodrecendo" + telas **Hoje** e **Pipeline**. Sozinha, esta etapa já entrega o principal: nenhuma venda é esquecida.

**3B — Implantação.** Esteira com SLA, passagem de bastão automática quando um deal é ganho.

**3C — Clientes e assinaturas.** Depende da decisão sobre a fonte dos sinais de uso.

**3D — Painel.** Por último de propósito: gráfico de série histórica sem histórico é decoração. Ele fica bom depois de alguns meses de dado real.

## Migração

O banco atual tem **0 clientes, 0 faturas, 0 negócios** e duas tarefas de teste. Isso é um presente: a mudança de modelo não tem dado de produção para migrar. As tabelas antigas do CRM podem ser aposentadas sem conversão e sem perda.

## Decisões pendentes

1. **A fonte dos sinais de uso** — integração, lançamento manual, ou cortar a tela de Clientes por ora?
2. **Os seis nomes e prazos das etapas de implantação** vêm do protótipo. Confirmam ou ajustam?
3. **Setup e MRR por tier** (Básico · Pro · Anual) — são tabelados ou negociados caso a caso? Muda se o valor mora na assinatura ou num catálogo.
4. **`time_entries`** — aposentar a tela e manter o cronômetro amarrado à implantação, ou remover de vez?

## Verificação

Como em toda esta empreitada: eu não tenho navegador. Testes de lógica pura, tipos, lint e build são o que consigo garantir. As telas, o movimento e o comportamento com duas pessoas ao mesmo tempo só vocês confirmam — e a régua de aceitação é a pergunta do topo, respondida por quem usa.

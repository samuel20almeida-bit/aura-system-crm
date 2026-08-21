# Fase 5 — Fluidez e interface

**Data:** 2026-08-21
**Status:** Aprovado

## Problema

Duas queixas, uma origem comum: a camada entre o dado e a pessoa nunca recebeu
uma passada própria.

**O sistema trava durante o uso.** Não é impressão. Toda escrita renderiza a
rota duas vezes (as Server Actions chamam `revalidatePath` e o componente
chama `router.refresh()` logo depois), cada renderização de rota custa cerca de
nove idas ao servidor, e a interface fica desabilitada durante as duas.
Nenhuma gaveta tem atualização otimista: o quadro responde na hora quando você
arrasta um cartão, mas o mesmo estágio mudado pelo seletor da gaveta espera a
viagem inteira.

**A interface pede esforço para ser lida e usada.** O cinza dos rótulos
reprova em contraste (2,6:1 contra o mínimo de 4,5:1) e é justamente a cor de
rótulos de 9 a 11 pixels. Há treze tamanhos de fonte avulsos e nenhuma escala.
O foco de teclado é invisível na maior parte do app. Duas telas ignoram o
celular. Formulários perdem tudo num clique fora.

O levantamento completo está na auditoria de 2026-08-21 (33 achados). Esta
fase ataca os de interface; os de modelo — tela de Clientes, churn, unificação
de `contas`/`clients`, histórico da venda — ficam para a fase seguinte.

## Objetivo

Que o sistema responda ao clique em vez de esperar o servidor, e que tudo nele
possa ser lido e operado — no notebook, no celular e pelo teclado — sem
esforço.

Critérios de aceitação, verificáveis um a um:

- Nenhuma escrita renderiza a rota mais de uma vez.
- Mudar estágio, etapa ou status de tarefa muda a tela no clique; o servidor
  confirma depois.
- Nenhum texto do app fica abaixo de 4,5:1 de contraste.
- Todo elemento focável tem estado de foco visível.
- Nenhuma tela exige rolagem horizontal em 375px de largura.
- O primeiro quadro pintado no celular já é o layout de celular.

## Ordem de construção

Por dor, não por completude. Cada parte entrega sozinha e é revisável sozinha.

**5F — Fluidez.** Primeiro, e majoritariamente deleção. Independe de token
nenhum, e enquanto ela não acontecer é impossível avaliar qualquer ajuste
visual: numa interface que trava, ninguém sabe se a lentidão é do CSS ou do
servidor.

**5A — Fundação visual.** Tokens de tipografia, espaçamento e cor; contraste;
foco; forma no ponto de saúde; `next/font`; ícone e manifesto. Sem mudança de
comportamento.

**5B — Celular de verdade.** Mover cartão sem arrastar, Metas e Playbooks
responsivos, busca no celular e estendida a contas e negócios, alvos de toque.

**5C — Atrito.** Esc, foco preso e confirmação ao fechar formulário com dados;
hierarquia de "Ganhar" contra "Perder"; etapa de playbook com nome; Kanban
abrindo com conteúdo.

O restante deste documento detalha a 5F no nível necessário para virar plano
de implementação. As partes 5A a 5C ficam definidas no nível de escopo e
ganham detalhe quando chegar a vez de cada uma — mesma disciplina do spec da
Fase 3, que definiu 3A a 3D e só detalhou a que ia ser construída.

---

# 5F — Fluidez

## Diagnóstico

O custo de uma escrita na gaveta do Pipeline, contado no código:

| Etapa | Idas ao servidor |
| --- | --- |
| `middleware` → `auth.getUser()` | 1 (rede, servidor de auth) |
| Server Action → `UPDATE` | 1 |
| `requireProfile()` → `auth.getUser()` de novo | 1 |
| `requireProfile()` → `profiles` | 1 |
| `getNavCounts()` | 1 |
| `getNotifications()` → `invoices`, `tasks`, `contracts` | 3 |
| `listNegociosAbertos()` + `listProfiles()` | 2 |
| **Subtotal de uma renderização de rota** | **~9** |
| `router.refresh()` refaz tudo | **~9 de novo** |

Duas dessas consultas — `invoices` e `contracts` — leem tabelas que nenhuma
tela alimenta desde que o CRM antigo saiu (achado A7). Elas rodam em toda
renderização de rota do app inteiro, porque o sino mora no layout.

Há ainda uma restrição do Next que não dá para remover: **Server Actions são
serializadas**, uma em voo por vez. O autosave da gaveta (debounce de 800ms)
dispara enquanto se clica em "Ganhar", e o clique entra na fila atrás dele.
A saída não é uma fila própria no cliente — é a interface parar de depender da
resposta para se atualizar (F4).

## As mudanças

### F1 — Uma escrita, uma renderização

**Regra:** para a rota em que a pessoa está, ou a ação chama `revalidatePath`,
ou o cliente chama `router.refresh()` — nunca os dois.

Quando uma Server Action chama `revalidatePath` da rota atual, o Next devolve
o payload atualizado dessa rota **junto com a resposta da ação**. O
`router.refresh()` que vem depois refaz o trabalho inteiro pela segunda vez.
São 29 chamadas de `router.refresh()` em componentes contra 48 de
`revalidatePath` em actions.

O `router.refresh()` continua onde ele é a única fonte de atualização:

- `login/page.tsx` — não há Server Action; o cliente autentica e navega.
- Qualquer ponto em que a action **não** revalida a rota de onde foi chamada.

**Risco, e como cobri-lo.** Se a lista de `revalidatePath` de uma action não
incluir a rota que a chamou, tirar o `router.refresh()` faz a tela parar de
atualizar em silêncio — o pior tipo de regressão. O plano de implementação
começa por uma tabela de auditoria: para cada action, quais rotas a chamam e
quais ela revalida. Onde faltar, a correção é acrescentar a rota na action, não
manter o refresh.

`revalidatePath` de outras rotas continua como está: é o que faz `/hoje` já
estar correta quando se volta para ela pelo botão Voltar, e não custa nada
agora.

### F2 — Tirar as consultas mortas do caminho crítico

`getNotifications()` deixa de consultar `invoices` e `contracts`. O sino passa
a ter uma fonte só: tarefas do usuário, que é a única que produz avisos
clicáveis hoje — os de fatura e contrato já nascem com `href: null` porque a
tela de destino não existe mais.

Sai junto o que fica sem consumidor, pela mesma doutrina da migration 0014
("manter tabela sem escritor é dívida que ninguém lembra"): `src/lib/invoices.ts`,
`src/lib/invoices.test.ts`, e os ramos de fatura e contrato de
`buildNotifications` com os testes correspondentes em `notifications.test.ts`.

As tabelas continuam no banco. Nenhuma migration nesta fase.

**Ganho:** duas consultas a menos em toda renderização de rota do app.

### F3 — Resolver a sessão uma vez por requisição

Hoje `auth.getUser()` roda duas vezes por requisição: no middleware e de novo
no `requireProfile()` do layout. `getUser()` valida o token contra o servidor
de auth — é rede, não CPU.

`getClaims()` (disponível em `@supabase/auth-js`, via `supabase-js ^2.111`)
valida o mesmo token **localmente**, com WebCrypto, sem ida à rede — mas
**só se o projeto usar chaves de assinatura assimétricas** (ECC ou RSA). Com
segredo simétrico, ele cai no mesmo pedido de rede do `getUser()` e não há
ganho nenhum.

**Pré-condição, a verificar antes de implementar:** confirmar no painel do
Supabase (Authentication → JWT/Signing Keys) que o projeto está em chave
assimétrica. Quem tem acesso ao projeto verifica; esta sessão não alcança o
banco de produção (achado E1 da auditoria).

- **Se assimétrica:** middleware e `requireProfile()` passam a usar
  `getClaims()`. Duas idas de rede a menos por requisição, inclusive nos POSTs
  de Server Action.
- **Se simétrica:** F3 sai da fase, e fica registrado o porquê. A alternativa
  — confiar no cookie sem verificar — troca uma propriedade de segurança real
  por latência, e não é uma troca que este sistema deve fazer.

F3 é a única mudança da 5F com pré-condição externa. As outras cinco não
dependem dela e seguem em qualquer cenário.

### F4 — A interface responde no clique

Três controles hoje esperam a viagem inteira antes de mudar de aparência:

- estágio do negócio (`NegocioDrawer`)
- etapa da implantação (`ImplantacaoDrawer`)
- status da tarefa (`TaskDetailPanel`)

Todos passam a atualizar o estado local na hora e reverter com aviso se a
escrita falhar — o padrão que os quadros já usam no arraste (`PipelineBoard`,
`ImplantacaoBoard`, `KanbanBoard`) e que `MetasClient` já usa com
`useOptimistic` no progresso da meta. Não é técnica nova no projeto; é a
técnica existente aplicada onde faltava.

O `beginMutation`/`end` do portão de tempo real continua envolvendo a escrita,
sem mudança: ele existe para o refresh de tempo real não atropelar estado
derivado de props, e isso continua valendo.

### F5 — O primeiro quadro do celular já é o do celular

`useMediaQuery` devolve `false` no servidor, então o celular pinta o layout de
desktop antes de virar celular. Onde isso decide **layout**, a decisão sai do
JavaScript e vai para o CSS:

- `ImplantacaoBoard` monta `gridTemplateColumns` em estilo inline a partir de
  `isMobile` porque o número de colunas é dado, não código. Passa a expor a
  contagem como propriedade customizada (`style={{ "--colunas": etapas.length }}`)
  e a decisão de empilhar ou não vira uma regra de media query em
  `globals.css`, sobre uma classe própria do quadro. O número continua vindo do
  dado; só o ponto de corte vira CSS.

`isMobile` continua em JavaScript onde não afeta layout — desabilitar o
arraste no toque, por exemplo, que muda comportamento e não desenho. (A 5B
revisita esse arraste; aqui só se garante que ele não pisque.)

### F6 — Bloquear a escrita, não a leitura

O `executar()` das gavetas embrulha ação e refresh num `useTransition`, e o
`pendente` desabilita o seletor de estágio e os dois botões do rodapé ao mesmo
tempo. Depois de F1 e F4, `pendente` passa a cobrir só a escrita em si, e o
desabilitar fica restrito a onde ele ainda protege alguma coisa:

- **Os controles que F4 tornou otimistas** (estágio, etapa, status) deixam de
  ser desabilitados. Eles já mostram o valor novo; travá-los seria contradizer
  a tela.
- **"Ganhar" e "Perder"** continuam desabilitados durante a própria escrita —
  ali o `disabled` não é espera de leitura, é guarda contra clique duplo numa
  ação que muda a fase da conta.

Ler, rolar, editar outro campo e fechar a gaveta continuam funcionando durante
a escrita.

## Fora de escopo da 5F

- **Nenhuma mudança de schema, nenhuma migration.** As tabelas mortas
  continuam onde estão; aposentá-las é decisão da fase de modelo.
- **Fila de Server Actions no cliente.** A serialização do Next continua; F4 é
  a mitigação, e ela basta para o caso comum.
- **Paginação do Kanban** (achado C12). É trabalho de leitura e de dado, não
  de fluidez percebida, e o volume atual não justifica.
- **Publicar tabelas novas em tempo real.** Continua valendo a decisão da
  migration 0013: republicar é decisão para quando o modelo estiver estável.
- **Os `loading.tsx` das rotas.** Já existem para as sete telas e já fazem o
  seu papel no primeiro carregamento. O problema é o que acontece *depois* de
  já estar na página.

---

# 5A — Fundação visual

Escopo definido, detalhe quando chegar a vez.

- Escala tipográfica em tokens, substituindo os treze tamanhos avulsos.
- Escala de espaçamento, idem.
- Contraste: `--color-faint` escurece o suficiente para passar em 4,5:1 sobre
  osso e sobre branco; conferir também `--color-amber` onde ele for texto.
- Estado de foco visível em todo elemento focável, incluindo os que hoje usam
  `outline-none` sem substituto.
- Ponto de saúde ganha forma além de cor (anel, sólido, sólido com traço), para
  não depender de percepção de cor nem de `title`.
- `next/font` no lugar do `<link>` do Google — tira o bloqueio de renderização
  e resolve o único aviso de lint do projeto.
- Ícone e manifesto, para o app poder ser fixado na tela inicial do celular.

**Decisão registrada:** a identidade é refinada, não repensada. Osso, verde
profundo, Archivo, Fraunces itálico e IBM Plex Mono continuam. **Sem tema
escuro** nesta fase — foi considerado e recusado para manter a parte enxuta;
a tokenização de cor que a 5A faz é justamente o que torna barato acrescentar
depois, se fizer falta.

# 5B — Celular de verdade

- Mover cartão entre colunas sem arrastar, de forma descobrível. Hoje existe
  só pelo seletor dentro da gaveta — funciona, e ninguém encontra.
- `/metas` deixa de ser duas colunas fixas em qualquer largura.
- `/playbooks` deixa de manter barra lateral fixa de 200px no celular.
- Busca acessível no celular (hoje some abaixo de 768px) e estendida a contas,
  negócios e implantações — hoje encontra apenas tarefas.
- Alvos de toque revisados nos controles pequenos: os chips de etapa de
  playbook e os seletores de filtro do Kanban.

**Premissa:** celular e notebook têm o mesmo peso de uso. Foi a resposta dada
no levantamento desta fase, e é ela que justifica 5B ser uma parte inteira em
vez de um ajuste dentro da 5A.

# 5C — Atrito

- Modais e gavetas: fechar com Esc, foco preso enquanto abertos, foco devolvido
  ao fechar, `role="dialog"` e `aria-modal`, e confirmação antes de descartar
  um formulário preenchido.
- "Ganhar" deixa de ser o botão mais apagado da tela e de usar `confirm()`
  nativo; passa a ter o mesmo cuidado que "Perder" já tem.
- Etapa de playbook em execução mostra o nome, não um número de 10px com o
  nome escondido no `title`.
- Kanban abre no escopo que tem conteúdo.

**Ressalva honesta sobre o Kanban:** a causa de ele abrir vazio é a tabela
`clients` sem escritor (achado A3), que é problema de modelo. O que a 5C faz é
paliativo — melhora a primeira impressão e não substitui a unificação de
`contas`/`clients` na fase seguinte. Registrado para ninguém achar, daqui a
dois meses, que o assunto foi resolvido.

---

## Testes e verificação

Não há infraestrutura de teste de componente React neste projeto (sem
`@testing-library/react`) — mesma limitação registrada nas Fases 4A a 4E.
Vale para toda a Fase 5.

O que dá para garantir automaticamente:

- `npm test` — a suíte existente não pode quebrar. F2 remove testes junto com
  o código que eles cobrem (`invoices.test.ts` e os casos de fatura e contrato
  em `notifications.test.ts`); nenhum outro teste muda de resultado.
- `tsc --noEmit`, `eslint`, `next build` — limpos, como estão hoje.

O que exige olho humano, e por quem:

- **F1** — para cada action tocada, confirmar na tela que a mudança aparece
  sem o `router.refresh()`. É a verificação mais importante da parte inteira.
- **F4** — confirmar que o seletor muda na hora e que uma falha reverte com
  aviso.
- **F5** — abrir `/implantacao` no celular e confirmar que não há piscada.
- **5A** — contraste conferido com ferramenta, não a olho.

## Riscos

| Risco | Mitigação |
| --- | --- |
| Tirar `router.refresh()` de um ponto cuja action não revalida a rota → tela para de atualizar em silêncio | Tabela de auditoria action × rota antes de qualquer remoção (F1) |
| F3 depender de configuração que ninguém verificou | Pré-condição explícita; se falhar, F3 sai da fase sem afetar as outras cinco |
| Reverter otimista mal feito → tela discorda do banco | Mesmo padrão dos quadros, que já trata revert e aviso; o portão de mutação continua |
| Fase longa demais para revisar | Quatro partes independentes, cada uma com plano e revisão próprios |

## Fora de escopo da Fase 5 inteira

Tudo que é modelo, e fica para a fase seguinte: tela de Clientes, churn,
unificação de `contas` e `clients`, guarda de fase em `perderNegocio`, apagar
e reabrir negócio, histórico da venda, motivo da perda visível, metas ligadas
ao Painel, recuperação de senha, assinatura e cobrança.

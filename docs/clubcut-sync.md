# Sincronização com o ClubCut

Como o uso do ClubCut chega ao CRM, e o que ainda falta para a conta fechar.

## A direção

```
ClubCut (Supabase do produto)  ──consulta──▶  n8n  ──POST──▶  CRM /api/clubcut/uso  ──▶  CRM (Supabase)
```

O CRM **não** abre conexão com o banco do ClubCut. Quem lê lá é o n8n, que
já tem a credencial daquele projeto e já roda ao lado do produto; o que
atravessa a fronteira é o agregado de um dia, não o dado bruto.

O caminho contrário — o CRM lendo o Postgres do ClubCut através de *views* —
daria drill-down ao vivo, mas colocaria uma chave de produção do cliente
dentro do nosso deploy e acoplaria nossas telas ao schema deles. O raciocínio
completo está no cabeçalho de `supabase/migrations/0022_clubcut.sql`.

Consequência aceita: **o número da tela é de ontem**. Para decidir preço,
margem e risco de churn, um dia de atraso não muda nenhuma conclusão.

## Variáveis de ambiente (Vercel)

Duas novas, além das que já existem:

| Variável | Para quê |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | O sincronizador escreve à noite, sem ninguém logado, e as políticas deste banco exigem `auth.uid() is not null`. Sem prefixo `NEXT_PUBLIC_`, então o Next se recusa a mandá-la para o navegador. |
| `CLUBCUT_SYNC_TOKEN` | O segredo que o n8n manda no `Authorization`. Gere com `openssl rand -hex 32`. |

Sem `CLUBCUT_SYNC_TOKEN` definido, a rota responde **503** e não grava nada —
o n8n trata como "tente de novo depois", e não como credencial errada.

O n8n guarda **só o token**, nunca a chave do banco. É a diferença entre um
segredo que dá acesso de escrita a uma rota e um que dá acesso total ao
banco.

## O envio

`POST /api/clubcut/uso`
`Authorization: Bearer <CLUBCUT_SYNC_TOKEN>`

```json
{
  "saloes": [
    { "salon_id": "e1705efb-…", "nome": "El Guardians", "ativo": true }
  ],
  "uso": [
    {
      "salon_id": "e1705efb-…",
      "dia": "2026-08-23",
      "barbeiros": 3,
      "conversas": 2,
      "mensagens": 16,
      "agendamentos_agente": 2,
      "agendamentos_total": 2,
      "valor_gerado": 45.0,
      "custo_ia_usd": null,
      "execucoes_erro": 0
    }
  ],
  "assinaturas": [
    {
      "salon_id": "e1705efb-…",
      "plano": "pro",
      "status": "atrasada",
      "valor": 299.0,
      "proximo_vencimento": "2026-09-06",
      "acesso_ate": "2026-09-13"
    }
  ],
  "faturas": [
    {
      "salon_id": "e1705efb-…",
      "periodo_inicio": "2026-08-01",
      "periodo_fim": "2026-08-31",
      "motivo": "mensal",
      "valor": 1.5,
      "valor_gerado": 90.0,
      "agendamentos": 2,
      "vencimento": null,
      "paga_em": null
    }
  ]
}
```

Resposta: `{ "saloes": 1, "uso": 1, "assinaturas": 1, "faturas": 1 }`.

`assinaturas` e `faturas` são **opcionais**: um workflow que só manda `saloes`
e `uso` continua válido, e é isso que evita o envio quebrar no intervalo entre
publicar a rota nova e atualizar o fluxo.

Regras que a rota impõe (todas testadas em `src/lib/clubcut.test.ts`):

- Todo `salon_id` de `uso` precisa aparecer em `saloes`. Sem isso o erro
  viria da chave estrangeira, como 500 e em linguagem de Postgres.
- `dia` precisa ser data de calendário de verdade — `2026-02-30` casa com o
  formato e é recusada.
- Contadores são inteiros ≥ 0, e `agendamentos_agente` não pode passar de
  `agendamentos_total`.
- `custo_ia_usd` pode ser nulo ou ausente, e **nulo continua sendo a resposta
  mais comum**. Vem da `consumo_ia` do ClubCut, somando só as chamadas que o
  banco conseguiu precificar; enquanto a tabela de preços estiver vazia,
  nenhuma é precificada e o dia inteiro chega nulo. Veja "O custo de IA" no
  final desta página.
- **Reenviar é seguro.** A gravação é `upsert` na chave `(salon_id, dia)`:
  mandar a mesma janela duas vezes sobrescreve, não duplica. O n8n pode
  reprocessar os últimos dias sem coordenar nada com o CRM.

Nas listas novas:

- **Uma assinatura por salão** — é a chave primária deste lado, e o ClubCut
  tem `unique (salon_id)` no dele.
- `status` e `plano` vão como **texto cru**, sem tradução. Um status novo que
  eles criem aparece na tela como está, em vez de sumir num `else`.
- Data ausente pode vir como `null` ou não vir; o que é recusado é data mal
  formada (`"13/09/2026"`). Nulo é resposta legítima — assinatura em teste não
  tem próximo vencimento.
- A chave da fatura é `(salon_id, periodo_inicio, periodo_fim, motivo)`, a
  mesma de lá. O `motivo` entra porque um cancelamento no meio do mês gera uma
  fatura parcial do **mesmo período** da mensal.
- Reenviar a fatura é como o CRM fica sabendo que ela foi paga: o `upsert`
  atualiza `paga_em` na mesma linha.

O envio recomendado é uma **janela de 3 dias**, não só o dia anterior:
agendamento cancelado e conversa que continua no dia seguinte mudam números
já enviados, e a janela corrige sozinha.

## O fluxo no n8n

Existe, chama-se **"ClubCut - Uso diario para o CRM da Aura"**
(`UqLCK8lElBR7iSze`) e está **ativo**: roda todo dia às 03:00, com URL,
credencial Bearer e as credenciais do ClubCut já configuradas.

Doze nós de trabalho: gatilho diário às 03:00, nove leituras do ClubCut, o nó
de código que monta o envio e o POST. As leituras usam `executeOnce`, senão
cada uma rodaria uma vez por item da anterior.

A agregação acontece num nó de código, e não em SQL, por um motivo concreto:
o nó Supabase do n8n fala PostgREST, não SQL cru, e rodar a consulta desta
página exigiria criar uma *view* ou uma função no banco do ClubCut. No volume
de hoje — algumas centenas de linhas por dia — agregar em JavaScript é
imediato e não mexe no banco do cliente. Quando o volume crescer, a troca é
criar a view lá e trocar oito nós por um.

**A nona leitura ainda está só no rascunho.** O nó "Consumo de IA" e a
agregação de custo existem na versão salva, não na publicada:

| | |
|---|---|
| rascunho | `650d98b3-…` — lê `consumo_ia`, soma o custo por salão/dia |
| no ar | `3a4797f6-…` — as oito leituras originais, `custo_ia_usd` sempre nulo |

Ou seja: a execução das 03:00 de hoje ainda manda nulo. Publicar é decisão de
quem revisar, e faz sentido publicar **junto** com o fluxo de atendimento
(veja abaixo) — sozinho ele passaria a ler uma tabela que ninguém alimenta.

## A consulta, do lado do ClubCut

A consulta abaixo é a **referência do que o fluxo calcula** — é ela que o nó
de código reproduz em JavaScript, e é para ela que se migra quando o volume
justificar. Uma linha por salão ativo por dia da janela, inclusive dias
zerados: dia zerado é informação (o cliente não usou), não ausência de dado.

```sql
with dias as (
  select generate_series(
    (current_date - interval '2 days')::date, current_date, interval '1 day'
  )::date as dia
), salao_dia as (
  select s.id as salon_id, d.dia
  from public.salons s cross join dias d
  where s.ativo
)
select
  sd.salon_id,
  sd.dia::text as dia,
  (select count(*) from public.professionals p
    where p.salon_id = sd.salon_id and p.ativo)::int as barbeiros,
  (select count(distinct c.id) from public.whatsapp_conversations c
     join public.whatsapp_messages m on m.conversation_id = c.id
    where c.salon_id = sd.salon_id
      and (m.created_at at time zone 'America/Sao_Paulo')::date = sd.dia)::int as conversas,
  (select count(*) from public.whatsapp_messages m
     join public.whatsapp_conversations c on c.id = m.conversation_id
    where c.salon_id = sd.salon_id
      and (m.created_at at time zone 'America/Sao_Paulo')::date = sd.dia)::int as mensagens,
  (select count(*) from public.appointments a
    where a.salon_id = sd.salon_id and a.origem = 'agente'
      and (a.created_at at time zone 'America/Sao_Paulo')::date = sd.dia)::int as agendamentos_agente,
  (select count(*) from public.appointments a
    where a.salon_id = sd.salon_id
      and (a.created_at at time zone 'America/Sao_Paulo')::date = sd.dia)::int as agendamentos_total,
  coalesce((select sum(sv.preco) from public.appointments a
     join public.services sv on sv.id = a.service_id
    where a.salon_id = sd.salon_id and a.origem = 'agente' and a.status <> 'cancelado'
      and (a.created_at at time zone 'America/Sao_Paulo')::date = sd.dia), 0)::numeric(12,2) as valor_gerado,
  (select sum(ci.custo_usd) from public.consumo_ia ci
    where ci.salon_id = sd.salon_id and ci.custo_usd is not null
      and (ci.criado_em at time zone 'America/Sao_Paulo')::date = sd.dia)::numeric(12,6) as custo_ia_usd,
  0 as execucoes_erro
from salao_dia sd
order by sd.dia desc, sd.salon_id;
```

O `sum` sem `coalesce` é de propósito: um dia em que nenhuma chamada foi
precificada devolve **nulo**, não zero. E o `custo_usd is not null` de dentro
garante que uma chamada sem preço cadastrado não arraste o dia inteiro para
zero — ela apenas não entra na soma.

E as outras três listas, no mesmo envio:

```sql
-- salões
select id as salon_id, nome, ativo from public.salons;

-- assinaturas
select sub.salon_id, sub.plan_codigo as plano, sub.status,
       sub.valor, sub.proximo_vencimento, sub.acesso_ate
from public.subscriptions sub;

-- faturas (as dos últimos 6 meses bastam; reenviar é idempotente)
select f.salon_id, f.periodo_inicio, f.periodo_fim, f.motivo,
       f.valor, f.valor_gerado, f.agendamentos,
       f.boleto_vencimento as vencimento, f.paga_em
from public.faturas_de_uso f
where f.periodo_fim >= (current_date - interval '180 days')::date;

-- consumo de IA (a janela de 4 dias, um dia a mais que o envio)
select ci.salon_id, ci.criado_em, ci.custo_usd
from public.consumo_ia ci
where ci.criado_em >= now() - interval '4 days';
```

`boleto_vencimento` é o vencimento que vale: `proximo_vencimento` da
assinatura é do ciclo, e a fatura de uso tem o seu, gerado no fechamento.

Três coisas que esta consulta assume, e que valem estar escritas:

1. **`barbeiros` é de hoje, não daquele dia.** O ClubCut não guarda histórico
   de quantos profissionais estavam ativos numa data. Reprocessar uma janela
   antiga reescreve o número com o de agora. Para a faixa de preço isso
   quase nunca importa; para uma auditoria de fatura antiga, importaria.
2. **O dia é o de São Paulo**, não UTC. Sem o `at time zone`, tudo que
   acontece depois das 21h cai no dia seguinte.
3. **`valor_gerado` exclui cancelado.** É diferente da `faturas_de_uso` do
   ClubCut, que congela o valor no fechamento e por isso mantém agendamento
   cancelado depois. Aqui a pergunta é operacional ("quanto o agente
   entregou"), não fiscal ("o que foi cobrado") — e as duas respostas são
   legitimamente diferentes.

`execucoes_erro` não sai do banco: vem da API do n8n (execuções com
`status = error` do fluxo daquele salão), e o workflow soma antes do POST.

## O que a tela faz com a cobrança

- **Cobrado no período** soma as faturas cujo `periodo_fim` cai na janela.
- **Em aberto** soma tudo sem baixa, de **qualquer** período: dívida não
  expira com o recorte da tela, e filtrar por janela esconderia justamente a
  fatura antiga que alguém precisa cobrar.
- **Vencida** só conta quando existe `vencimento` e ele já passou. Fatura sem
  vencimento (boleto gerado à mão, por exemplo) fica em aberto e fora da
  contagem — afirmar atraso sem data seria chute.
- **Teste vencido** tem tratamento próprio: status `trial` com `acesso_ate` no
  passado aparece em vermelho, e não com a mesma cara de um teste em dia. É
  cliente sendo servido de graça, e é a linha que alguém precisa ver.

## O custo de IA

Até a semana passada esta seção dizia que o ClubCut não media custo nenhum.
Isso mudou pela metade, e a metade importa.

### O que existe agora, no banco do ClubCut

Duas tabelas novas, criadas direto em produção:

**`consumo_ia`** — uma linha por chamada paga. Guarda `salon_id`, `modelo`,
`tokens_entrada`, `tokens_saida`, `segundos` (para áudio), `custo_usd`,
`execucao_n8n` e `criado_em`. Sem policy de RLS: só o `service_role` escreve e
lê, que é o que o n8n usa.

**`precos_modelo`** — a tabela de preços, chaveada por `(modelo, vigente_de)`.
Preço de modelo muda, e uma chamada de junho precisa continuar valendo o preço
de junho; por isso a data entra na chave em vez de uma coluna `preco` que
alguém sobrescreveria.

O custo **não é calculado na leitura**. Um trigger `before insert` em
`consumo_ia` procura o preço vigente na data da chamada e congela `custo_usd`
na própria linha. É a diferença entre um número que se pode auditar e um que
muda sozinho quando alguém edita a tabela de preços.

O trigger tem uma regra que vale conhecer: **sem preço cadastrado, ele não
inventa.** A linha entra com `custo_usd` nulo e a chamada fica registrada
(quantas foram, de qual modelo, quantos tokens) sem alegar um custo. Áudio
exige `usd_por_minuto`; o resto exige `usd_por_1k_entrada`.

Existe também uma coluna `medicao` (`'medido'` ou `'estimado'`), para o dia em
que alguma chamada só puder ser estimada. Hoje tudo que se grava é `medido`.

Um aviso para quem for ler o código: o comentário no topo de
`supabase/migrations/0022_clubcut.sql` diz que a instrumentação não existe.
Era verdade quando aquela migration foi escrita e ficou desatualizada aqui —
migration aplicada não se reescreve. **Esta página é a versão corrente.**

### O que já está instrumentado

O fluxo de atendimento faz **três** chamadas pagas por mensagem. Duas foram
instrumentadas, no **rascunho** do fluxo `rJO1n7cFeNDIJyB5`:

| Chamada | Situação |
|---|---|
| Descrição de imagem (visão) | **Instrumentada.** A OpenAI devolve `usage`, e o nó grava modelo, tokens de entrada e de saída. |
| Transcrição de áudio (`whisper-1`) | **Contada, não precificada.** A chamada é registrada, mas o `whisper-1` cobra por minuto e não devolve duração — e o webhook não traz os segundos do áudio. Falta a Edge Function mandar `seconds` no corpo. |
| O agente | **Não instrumentada, e não é descuido.** A saída do nó de agente é só `{ output: "…" }`: o consumo de tokens fica no sub-nó do modelo, inalcançável de qualquer nó seguinte. Buscar isso exige um coletor separado lendo a API do n8n depois da execução. |

Os dois nós novos entram como **ramo paralelo**, não em série, e com
`onError: continueRegularOutput`. A propriedade que isso compra: se o Supabase
estiver fora do ar, a mensagem do cliente continua sendo respondida. Falhar em
registrar um custo nunca pode derrubar um atendimento.

### O que falta para o número aparecer na tela

Três coisas, em ordem de esforço:

1. **Preencher `precos_modelo`.** Nasceu vazia de propósito — chutar o preço
   da OpenAI produziria uma margem falsa, que é pior que nenhuma. Enquanto
   estiver vazia, o trigger grava tudo com `custo_usd` nulo e a tela continua
   mostrando "—".
2. **Publicar os dois rascunhos**, o de atendimento e o de sincronização. O de
   atendimento mexe no fluxo que atende cliente de verdade; a versão publicada
   segue rodando intocada até alguém olhar o diff e decidir.
3. **Passar `seconds` no webhook de áudio**, do lado da Edge Function. Sem
   isso o `whisper-1` fica contado e não precificado para sempre.

Feito 1 e 2, a margem por cliente aparece em `/operacao` — parcial, cobrindo
visão e (com o 3) transcrição, ainda sem o agente, que é justamente a maior
das três. Vale dizer isso na tela quando chegar lá: um custo parcial
apresentado como total é a mesma mentira que o zero seria.

O agente e a reconciliação contra a fatura real da OpenAI ficaram
deliberadamente para depois.

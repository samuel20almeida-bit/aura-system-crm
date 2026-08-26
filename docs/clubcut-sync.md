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
- `custo_ia_usd` pode ser nulo ou ausente. **Hoje é sempre nulo** (veja o
  final desta página).
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

## A consulta, do lado do ClubCut

Roda no Supabase do ClubCut. Uma linha por salão ativo por dia da janela —
inclusive dias zerados, que são informação (o cliente não usou) e não
ausência de dado.

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
  null::numeric as custo_ia_usd,
  0 as execucoes_erro
from salao_dia sd
order by sd.dia desc, sd.salon_id;
```

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

## O que ainda falta

`custo_ia_usd` chega nulo porque **o ClubCut não mede custo de IA**. Nenhuma
tabela guarda token, modelo ou preço, e o fluxo de atendimento faz três
chamadas pagas por mensagem — agente, transcrição de áudio e descrição de
imagem — sem registrar nenhuma.

A coluna nasce nula (e não zero) de propósito: zero afirmaria que não custou
nada. Enquanto for nula, a tela `/operacao` mostra "—" e diz "custo de IA
ainda não medido" em vez de exibir uma margem inventada.

Fechar isso é a tabela `consumo_ia` do lado do ClubCut, mais um nó no fim do
fluxo de atendimento gravando o `usage` que a OpenAI já devolve. Feito isso,
o único ajuste aqui é preencher `custo_ia_usd` na consulta acima — o CRM já
aceita, guarda e mostra.

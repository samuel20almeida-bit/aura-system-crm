-- Encolhe a publicação de tempo real para a única tabela que tem assinante.
--
-- A 0011 publicou dez tabelas porque o plano da Parte I previa sete tarefas.
-- Ela parou em três, e o único consumidor de `useLiveRefresh` no app é o painel
-- de atividade da /início, que assina `activity_log` e mais nada. As outras nove
-- ficaram publicadas sem ouvinte.
--
-- Dois motivos para tirá-las, não um:
--
-- 1. Custo. `replica identity full` grava a linha ANTIGA inteira no WAL em todo
--    UPDATE e DELETE, e a publicação faz o walsender decodificar isso para o
--    slot do Realtime. Pequeno nesta carga, mas pago sem retorno.
--
-- 2. Superfície. O payload de um evento leva a linha inteira. `clients` carrega
--    nome, e-mail e telefone de terceiros — pessoas que não são usuárias deste
--    sistema; `invoices` carrega o contas a receber; `deals`, o pipeline. As
--    políticas dessas tabelas são `auth.uid() is not null`, então qualquer conta
--    autenticada receberia tudo isso EMPURRADO, ao vivo, em vez de precisar
--    consultar. Com dois sócios que já têm leitura total, não é escalada de
--    privilégio. Passa a ser no dia em que existir uma terceira conta.
--
-- O negócio mudou para agentes por assinatura e a Fase 3 reescreve o modelo do
-- CRM, então republicar depois é trabalho de uma linha sobre as tabelas certas —
-- não sobre estas, que vão ser aposentadas.

alter publication supabase_realtime set table public.activity_log;

alter table public.tasks replica identity default;
alter table public.invoices replica identity default;
alter table public.clients replica identity default;
alter table public.deals replica identity default;
alter table public.time_entries replica identity default;
alter table public.goals replica identity default;
alter table public.task_comments replica identity default;
alter table public.task_checklist_items replica identity default;
alter table public.task_attachments replica identity default;

-- Presença ao vivo: fecha o canal `aura:presenca` para quem não está logado.
--
-- Antes disto o canal era PÚBLICO. A anon key e o tópico "aura:presenca" viajam
-- no bundle do cliente, então qualquer pessoa que abrisse /login, lesse o JS e
-- assinasse o tópico veria, ao vivo, o primeiro nome dos dois sócios, as
-- iniciais, o UUID de autenticação de cada um e em que tela cada um está — e
-- podia se anunciar com uma chave forjada, inclusive a do outro sócio,
-- injetando um par falso na barra superior dos dois.
--
-- A correção tem DUAS metades e elas andam juntas:
--   1. `config.private = true` no cliente (src/lib/realtime/usePresence.ts);
--   2. as policies abaixo.
-- Só a metade 1 e a presença morre: `realtime.messages` tem RLS ligada, e sem
-- policy nenhuma o canal privado é negado na entrada. Só a metade 2 e nada
-- muda: canal público não passa por autorização nenhuma.
--
-- MODO DE FALHA A LEMBRAR: policy errada NÃO dá erro na tela. A entrada é
-- negada e a faixa de presença simplesmente nunca aparece. Se no teste de duas
-- telas ninguém aparecer online, é aqui que se olha primeiro.
--
-- Como o Realtime usa esta tabela (docs "Realtime Authorization"): ao entrar no
-- canal, o servidor faz uma consulta em `realtime.messages` com o tópico
-- pedido, calcula as permissões do cliente e desfaz a transação. Nenhuma linha
-- é gravada aqui. `realtime.topic()` devolve o tópico que o cliente pediu —
-- confirmado presente neste projeto — e `extension` diz o tipo de mensagem:
-- 'presence' é o que este canal usa (nunca 'broadcast', nunca
-- 'postgres_changes'), por isso as policies são estreitas nas duas dimensões.

-- Repetível: `create policy` não tem `if not exists`, e toda migration deste
-- projeto precisa sobreviver a um replay (supabase db reset, branch de preview).
drop policy if exists "presenca_aura_leitura" on realtime.messages;
drop policy if exists "presenca_aura_escrita" on realtime.messages;

-- Leitura: receber quem mais está no canal. É esta permissão que autoriza a
-- ENTRADA no tópico — sem pelo menos uma permissão de leitura ou escrita, a
-- entrada é recusada.
create policy "presenca_aura_leitura"
on realtime.messages
for select
to authenticated
using (
  (select realtime.topic()) = 'aura:presenca'
  and realtime.messages.extension = 'presence'
);

-- Escrita: anunciar a própria presença (`channel.track` no hook).
create policy "presenca_aura_escrita"
on realtime.messages
for insert
to authenticated
with check (
  (select realtime.topic()) = 'aura:presenca'
  and realtime.messages.extension = 'presence'
);

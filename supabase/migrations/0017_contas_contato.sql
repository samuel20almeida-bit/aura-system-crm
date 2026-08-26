-- `telefone`, `site` e `email` já existem no banco (adicionados fora do
-- histórico de migrations); só falta `endereco` para o dado de prospecção
-- de mapas/local business, que sempre vem com endereço completo.
alter table public.contas
  add column endereco text;

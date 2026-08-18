-- Contato do prospect: a 0015 desenhou `contas` sem telefone/endereço/site,
-- mas o negócio vende agentes de WhatsApp — sem telefone não existe outreach.
-- Colunas nascem vazias, preenchidas à medida que a prospecção roda.
alter table public.contas
  add column telefone text,
  add column endereco text,
  add column site text;

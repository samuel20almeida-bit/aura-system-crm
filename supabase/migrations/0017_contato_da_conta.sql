-- Gap real reportado pelo Samuel: não existe onde guardar e-mail, telefone ou
-- site do cliente em `contas`, e nenhum campo da conta é editável depois do
-- cadastro (a gaveta do Pipeline só exibe "A CONTA" em modo leitura). Esta
-- migration só abre espaço para o dado; a edição em si é Server Action + UI,
-- não schema.
alter table public.contas
  add column email text,
  add column telefone text,
  add column site text;

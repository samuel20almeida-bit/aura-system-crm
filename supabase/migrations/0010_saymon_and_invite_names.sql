-- Autoriza o segundo fundador e faz o convite carregar o nome da pessoa.
--
-- Antes, o perfil era montado a partir do trecho do e-mail antes do @:
-- samuel20almeida@gmail.com virava "Samuel20almeida" e castrocollin01@gmail.com
-- viraria "Castrocollin01". O sistema mostra o primeiro nome em toda parte
-- (responsável por tarefa, autor de comentário, dono de meta), então o convite
-- passa a poder trazer o nome e as iniciais, e o e-mail vira só o fallback.

alter table public.allowed_emails add column if not exists full_name text;
alter table public.allowed_emails add column if not exists initials text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  name_part text;
  invited public.allowed_emails%rowtype;
begin
  select * into invited
  from public.allowed_emails
  where lower(email) = lower(new.email);

  name_part := split_part(new.email, '@', 1);

  insert into public.profiles (id, email, full_name, initials)
  values (
    new.id,
    new.email,
    coalesce(nullif(invited.full_name, ''), initcap(replace(name_part, '.', ' '))),
    coalesce(nullif(invited.initials, ''), upper(left(name_part, 2)))
  );
  return new;
end;
$$;

insert into public.allowed_emails (email, note, full_name, initials) values
  ('castrocollin01@gmail.com', 'Fundador', 'Saymon', 'SY')
on conflict (email) do update
  set note = excluded.note,
      full_name = excluded.full_name,
      initials = excluded.initials;

update public.allowed_emails
   set full_name = 'Samuel', initials = 'SA'
 where lower(email) = 'samuel20almeida@gmail.com';

-- O perfil do Samuel já existe, então o gatilho não roda mais para ele.
update public.profiles
   set full_name = 'Samuel'
 where lower(email) = 'samuel20almeida@gmail.com'
   and full_name = 'Samuel20almeida';

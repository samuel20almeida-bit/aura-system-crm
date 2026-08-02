-- Restrict signup to invited founders only, and auto-create a profile row.

create table public.allowed_emails (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);

create or replace function public.check_allowed_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(new.email)
  ) then
    raise exception 'Este e-mail não está autorizado a criar uma conta no Aura Studio.';
  end if;
  return new;
end;
$$;

create trigger on_auth_user_restrict
  before insert on auth.users
  for each row execute function public.check_allowed_email();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  name_part text;
begin
  name_part := split_part(new.email, '@', 1);
  insert into public.profiles (id, email, full_name, initials)
  values (
    new.id,
    new.email,
    initcap(replace(name_part, '.', ' ')),
    upper(left(name_part, 2))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

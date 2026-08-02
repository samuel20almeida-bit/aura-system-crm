-- Seed: authorize the founder accounts to sign up, and default playbook categories.
-- No demo/fake business data (clients, tasks, invoices) — the workspace starts empty.

insert into public.allowed_emails (email, note) values
  ('samuel20almeida@gmail.com', 'Fundador')
on conflict (email) do nothing;

insert into public.playbook_categories (name, position) values
  ('Onboarding', 0),
  ('Design', 1),
  ('Atendimento', 2),
  ('Financeiro', 3),
  ('Comercial', 4)
on conflict do nothing;

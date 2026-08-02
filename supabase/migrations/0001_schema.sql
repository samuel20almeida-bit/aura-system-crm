-- Aura Studio — internal management system
-- Core schema: profiles, clients, contracts, invoices, pipeline, tasks, time tracking, goals, playbooks

create extension if not exists "pgcrypto";

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role_title text,
  initials text not null,
  weekly_capacity_hours numeric not null default 40,
  created_at timestamptz not null default now()
);

-- ============ CLIENTS ============
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code_prefix text not null,
  color text not null default '#0B6B54',
  segment text,
  contact_name text,
  contact_email text,
  contact_phone text,
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active','inactive')),
  client_since date,
  notes text,
  created_at timestamptz not null default now()
);
create unique index clients_code_prefix_idx on public.clients (upper(code_prefix));

-- ============ CONTRACTS ============
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  contract_type text not null check (contract_type in ('annual','monthly','project')),
  value numeric,
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('active','ended')),
  created_at timestamptz not null default now()
);

-- ============ INVOICES ============
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  reference_period text not null,
  due_date date not null,
  amount numeric not null,
  status text not null default 'pending' check (status in ('paid','pending','overdue')),
  paid_at date,
  created_at timestamptz not null default now()
);

-- ============ PIPELINE (DEALS) ============
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_id uuid references public.clients(id) on delete set null,
  stage text not null default 'lead' check (stage in ('lead','proposal','negotiation','won','lost')),
  value numeric,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ TASKS (KANBAN) ============
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  client_id uuid references public.clients(id) on delete set null,
  is_internal boolean not null default false,
  area text,
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  estimated_hours numeric,
  labels text[] not null default '{}',
  recurrence text,
  position integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_status_idx on public.tasks (status);
create index tasks_client_idx on public.tasks (client_id);

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  assignee_id uuid references public.profiles(id) on delete set null,
  position integer not null default 0
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  filename text not null,
  url text,
  created_at timestamptz not null default now()
);

-- ============ TIME TRACKING ============
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  minutes integer,
  note text,
  billable boolean not null default true,
  created_at timestamptz not null default now()
);
create index time_entries_user_idx on public.time_entries (user_id);
create index time_entries_running_idx on public.time_entries (user_id) where ended_at is null;

-- ============ GOALS ============
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  quarter text not null,
  area text not null,
  title text not null,
  owner_id uuid references public.profiles(id) on delete set null,
  target numeric not null,
  current numeric not null default 0,
  unit text not null default 'number' check (unit in ('number','currency','percent','hours')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============ PLAYBOOKS ============
create table public.playbook_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position integer not null default 0
);

create table public.playbooks (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.playbook_categories(id) on delete cascade,
  name text not null,
  type text not null default 'document' check (type in ('executable','document','draft')),
  estimated_days integer,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.playbook_steps (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references public.playbooks(id) on delete cascade,
  position integer not null default 0,
  title text not null
);

create table public.playbook_runs (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references public.playbooks(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress','done'))
);

create table public.playbook_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.playbook_runs(id) on delete cascade,
  step_id uuid not null references public.playbook_steps(id) on delete cascade,
  done boolean not null default false
);

-- ============ ACTIVITY LOG ============
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  verb text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index activity_log_created_idx on public.activity_log (created_at desc);

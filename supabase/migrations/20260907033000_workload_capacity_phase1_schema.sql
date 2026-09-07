-- Issue #187 (Workload/Capacidade), gota 1: modelo de dados mínimo.
-- Esforço estimado vira coluna dedicada em tasks (não custom field —
-- custom_field_values é JSONB genérico, ruim pra agregação/índice em
-- volume, ~7-8k tarefas ativas hoje). Nullable: tarefa sem estimativa cai
-- no fallback "contagem de tarefas" na agregação (gota 2).
alter table public.tasks
  add column if not exists estimated_hours numeric(6,2);

-- Capacidade semanal por usuário (jornada configurável, default 40h).
create table if not exists public.user_capacity (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  weekly_hours numeric(5,2) not null default 40 check (weekly_hours >= 0),
  updated_at timestamptz not null default now()
);

-- Ausências (férias, licença etc.) — reduz capacidade disponível nos dias
-- afetados, junto com fins de semana e company_holidays (já existe, #184).
create table if not exists public.user_time_off (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint valid_range check (end_date >= start_date)
);
create index if not exists idx_user_time_off_range on public.user_time_off (user_id, start_date, end_date);

alter table public.user_capacity enable row level security;
alter table public.user_time_off enable row level security;

-- SELECT aberto a qualquer autenticado (a view de Workload precisa ler
-- capacidade/ausências de todo mundo pra montar a matriz — não existe hoje
-- conceito de "equipe" na RLS de tasks pra restringir por escopo, mesmo
-- padrão de company_holidays). Escrita: o próprio usuário (autoatendimento
-- de férias/capacidade) OU quem já pode gerenciar configurações (is_manager()).
create policy user_capacity_select on public.user_capacity
  for select to authenticated using (true);
create policy user_capacity_write on public.user_capacity
  for all to authenticated
  using (user_id = auth.uid() or public.is_manager())
  with check (user_id = auth.uid() or public.is_manager());

create policy user_time_off_select on public.user_time_off
  for select to authenticated using (true);
create policy user_time_off_write on public.user_time_off
  for all to authenticated
  using (user_id = auth.uid() or public.is_manager())
  with check (user_id = auth.uid() or public.is_manager());

-- Índice de suporte pro RPC de agregação da gota 2 (hot path: responsável +
-- prazo, só tarefas "normais" — mesmo padrão parcial das issues #184/#185).
create index if not exists idx_tasks_workload_lookup
  on public.tasks (main_assignee_id, due_date)
  where deleted_at is null and archived_at is null;

-- Issue #186 (Time Tracking), MVP: cronômetro + lançamento manual por tarefa.
-- Mesmo padrão de FK/RLS de task_comments (CASCADE em task_id, can_access_task
-- como base de visibilidade), mas UPDATE/DELETE mais restrito: só quem
-- lançou OU is_manager() pode editar/excluir horas de terceiros (seção 7 da
-- issue — diferente de comentários, que qualquer um com acesso à tarefa edita).

create table if not exists public.task_time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes integer,
  is_billable boolean not null default true,
  description text,
  source text not null default 'manual' check (source in ('timer', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint duration_or_running check (ended_at is not null or duration_minutes is null),
  constraint duration_non_negative check (duration_minutes is null or duration_minutes >= 0)
);

-- "Uma pessoa não pode ter timers conflitantes sem regra explícita" (critério
-- funcional da issue): no máximo UM cronômetro rodando (ended_at is null) por
-- usuário, em qualquer tarefa — garantido no banco, não só na UI.
create unique index if not exists one_running_timer_per_user
  on public.task_time_entries (user_id) where ended_at is null;

create index if not exists idx_time_entries_task on public.task_time_entries (task_id);
create index if not exists idx_time_entries_user_date on public.task_time_entries (user_id, started_at);

alter table public.task_time_entries enable row level security;

create policy task_time_entries_select on public.task_time_entries
  for select using (public.can_access_task(task_id));

create policy task_time_entries_ins on public.task_time_entries
  for insert with check (public.can_access_task(task_id) and user_id = auth.uid());

create policy task_time_entries_upd on public.task_time_entries
  for update
  using (public.can_access_task(task_id) and (user_id = auth.uid() or public.is_manager()))
  with check (public.can_access_task(task_id) and (user_id = auth.uid() or public.is_manager()));

create policy task_time_entries_del on public.task_time_entries
  for delete using (public.can_access_task(task_id) and (user_id = auth.uid() or public.is_manager()));

-- Agregação server-side, mesmo padrão de get_dashboard_summary/
-- get_workload_summary (SECURITY INVOKER, respeita RLS linha a linha).
-- Formato (user_id, entry_date, ...) espelha get_workload_summary de
-- propósito — fica pronto pra virar a linha "realizado" ao lado de
-- "planejado" na Workload (#187), integração futura ainda não conectada na UI.
create or replace function public.get_time_tracking_summary(
  p_list_ids uuid[] default null,
  p_period_start date default (current_date - 30),
  p_period_end date default current_date
)
returns table(
  user_id uuid,
  entry_date date,
  actual_minutes bigint,
  billable_minutes bigint
)
language sql
stable
security invoker
set search_path = public
as $function$
  select
    e.user_id,
    e.started_at::date as entry_date,
    sum(coalesce(e.duration_minutes, 0))::bigint as actual_minutes,
    sum(case when e.is_billable then coalesce(e.duration_minutes, 0) else 0 end)::bigint as billable_minutes
  from public.task_time_entries e
  join public.tasks t on t.id = e.task_id
  where e.ended_at is not null
    and e.started_at::date >= p_period_start
    and e.started_at::date <= p_period_end
    and (p_list_ids is null or t.list_id = any(p_list_ids))
  group by e.user_id, e.started_at::date
  order by e.user_id, e.started_at::date;
$function$;

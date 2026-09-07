-- Issue #188 (Goals/OKRs, inspirado no ClickUp): Goal -> Targets.
-- Goal = objetivo de alto nível (nome, prazo, descrição, dono(s), acesso).
-- Target = item mensurável que compõe o Goal: number, currency, boolean ou task.
-- Progresso do Goal = média do progresso de cada Target (mesmo padrão do ClickUp).

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  color text not null default '#7c3aed',
  due_date date,
  access text not null default 'workspace' check (access in ('workspace', 'private')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.goal_owners (
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (goal_id, user_id)
);

create table public.goal_targets (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  type text not null check (type in ('number', 'currency', 'boolean', 'task')),
  name text not null,
  unit text,
  start_value numeric,
  target_value numeric,
  current_value numeric,
  is_done boolean not null default false,
  task_id uuid references public.tasks(id) on delete set null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_goal_targets_goal_id on public.goal_targets(goal_id);
create index idx_goal_owners_user_id on public.goal_owners(user_id);

-- Regra de visibilidade: goal 'workspace' é aberto a todo autenticado; goal
-- 'private' só pra criador, dono(s) listados em goal_owners, ou is_manager().
-- Mesmo padrão SECURITY DEFINER de can_access_list/can_access_task.
create or replace function public.can_access_goal(p_goal uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.goals g
    where g.id = p_goal
      and (
        g.access = 'workspace'
        or g.created_by = auth.uid()
        or public.is_manager()
        or exists (select 1 from public.goal_owners go where go.goal_id = g.id and go.user_id = auth.uid())
      )
  );
$$;

-- Quem pode editar/excluir: criador, dono(s), ou is_manager() (não qualquer
-- um que só enxerga por ser 'workspace').
create or replace function public.can_edit_goal(p_goal uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.goals g
    where g.id = p_goal
      and (
        g.created_by = auth.uid()
        or public.is_manager()
        or exists (select 1 from public.goal_owners go where go.goal_id = g.id and go.user_id = auth.uid())
      )
  );
$$;

alter table public.goals enable row level security;
alter table public.goal_owners enable row level security;
alter table public.goal_targets enable row level security;

create policy goals_select on public.goals
  for select using (public.can_access_goal(id));

create policy goals_ins on public.goals
  for insert with check (created_by = auth.uid());

create policy goals_upd on public.goals
  for update using (public.can_edit_goal(id)) with check (public.can_edit_goal(id));

create policy goals_del on public.goals
  for delete using (public.can_edit_goal(id));

create policy goal_owners_select on public.goal_owners
  for select using (public.can_access_goal(goal_id));

create policy goal_owners_write on public.goal_owners
  for all using (public.can_edit_goal(goal_id)) with check (public.can_edit_goal(goal_id));

create policy goal_targets_select on public.goal_targets
  for select using (public.can_access_goal(goal_id));

create policy goal_targets_write on public.goal_targets
  for all using (public.can_edit_goal(goal_id)) with check (public.can_edit_goal(goal_id));

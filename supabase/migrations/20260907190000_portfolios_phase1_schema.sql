-- Issue #189 (Portfolios, inspirado no ClickUp): coleção nomeada de Lists
-- com visão executiva agregada (progresso, saúde). NÃO duplica dados de
-- tarefa — a agregação usa a mesma RPC get_dashboard_summary já existente
-- pro Dashboard, filtrada client-side pras listas do portfolio. Permissão
-- é herdada: portfolio_lists só guarda QUAIS listas fazem parte; os números
-- por lista vêm de get_dashboard_summary, que já respeita RLS linha a linha
-- (SECURITY INVOKER via can_access_task) — ninguém vê números de lista que
-- não teria acesso de qualquer forma.

create table public.portfolios (
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

create table public.portfolio_owners (
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (portfolio_id, user_id)
);

create table public.portfolio_lists (
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  list_id uuid not null references public.lists(id) on delete cascade,
  order_index integer not null default 0,
  primary key (portfolio_id, list_id)
);

create index idx_portfolio_lists_portfolio_id on public.portfolio_lists(portfolio_id);
create index idx_portfolio_owners_user_id on public.portfolio_owners(user_id);

create or replace function public.can_access_portfolio(p_portfolio uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.portfolios p
    where p.id = p_portfolio
      and (
        p.access = 'workspace'
        or p.created_by = auth.uid()
        or public.is_manager()
        or exists (select 1 from public.portfolio_owners po where po.portfolio_id = p.id and po.user_id = auth.uid())
      )
  );
$$;

create or replace function public.can_edit_portfolio(p_portfolio uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.portfolios p
    where p.id = p_portfolio
      and (
        p.created_by = auth.uid()
        or public.is_manager()
        or exists (select 1 from public.portfolio_owners po where po.portfolio_id = p.id and po.user_id = auth.uid())
      )
  );
$$;

alter table public.portfolios enable row level security;
alter table public.portfolio_owners enable row level security;
alter table public.portfolio_lists enable row level security;

-- SELECT direto nas colunas da própria linha (NÃO reconsulta portfolios) —
-- lição da issue #188: self-lookup na mesma tabela quebra RETURNING de INSERT.
create policy portfolios_select on public.portfolios
  for select to authenticated using (
    access = 'workspace'
    or created_by = auth.uid()
    or public.is_manager()
    or exists (select 1 from public.portfolio_owners po where po.portfolio_id = portfolios.id and po.user_id = auth.uid())
  );

create policy portfolios_ins on public.portfolios
  for insert to authenticated with check (created_by = auth.uid());

create policy portfolios_upd on public.portfolios
  for update to authenticated using (public.can_edit_portfolio(id)) with check (public.can_edit_portfolio(id));

create policy portfolios_del on public.portfolios
  for delete to authenticated using (public.can_edit_portfolio(id));

create policy portfolio_owners_select on public.portfolio_owners
  for select to authenticated using (public.can_access_portfolio(portfolio_id));

create policy portfolio_owners_write on public.portfolio_owners
  for all to authenticated using (public.can_edit_portfolio(portfolio_id)) with check (public.can_edit_portfolio(portfolio_id));

create policy portfolio_lists_select on public.portfolio_lists
  for select to authenticated using (public.can_access_portfolio(portfolio_id));

create policy portfolio_lists_write on public.portfolio_lists
  for all to authenticated using (public.can_edit_portfolio(portfolio_id)) with check (public.can_edit_portfolio(portfolio_id));

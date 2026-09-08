-- Issue #192 (Mapa Mental): dois modos, igual ao ClickUp real (testado ao
-- vivo em app.clickup.com) — "Tarefas" (espelha Lista -> Tarefa -> Subtarefa
-- via tasks.parent_id, que já existe, sem tabela nova) e "Forma livre"
-- (brainstorming solto, canvas próprio). Esta migration só cobre "Forma
-- livre" — mesma estrutura de public.whiteboards (issue #191), reaproveitando
-- a engine tldraw já instalada (não reinventar engine gráfica).

create table public.mind_maps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  access text not null default 'workspace' check (access in ('workspace', 'private')),
  document jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.mind_map_owners (
  mind_map_id uuid not null references public.mind_maps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (mind_map_id, user_id)
);

create index idx_mind_map_owners_user_id on public.mind_map_owners(user_id);

create or replace function public.can_access_mind_map(p_mind_map uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mind_maps m
    where m.id = p_mind_map
      and (
        m.access = 'workspace'
        or m.created_by = auth.uid()
        or public.is_manager()
        or exists (select 1 from public.mind_map_owners mo where mo.mind_map_id = m.id and mo.user_id = auth.uid())
      )
  );
$$;

create or replace function public.can_edit_mind_map(p_mind_map uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mind_maps m
    where m.id = p_mind_map
      and (
        m.created_by = auth.uid()
        or public.is_manager()
        or exists (select 1 from public.mind_map_owners mo where mo.mind_map_id = m.id and mo.user_id = auth.uid())
      )
  );
$$;

alter table public.mind_maps enable row level security;
alter table public.mind_map_owners enable row level security;

-- SELECT direto nas colunas (não reconsulta mind_maps) — lição da #188:
-- self-lookup na mesma tabela quebra RETURNING de INSERT.
create policy mind_maps_select on public.mind_maps
  for select to authenticated using (
    access = 'workspace'
    or created_by = auth.uid()
    or public.is_manager()
    or exists (select 1 from public.mind_map_owners mo where mo.mind_map_id = mind_maps.id and mo.user_id = auth.uid())
  );

create policy mind_maps_ins on public.mind_maps
  for insert to authenticated with check (created_by = auth.uid());

-- Autosave: qualquer um com acesso pode salvar o canvas, não só quem edita
-- metadados — mesmo padrão de whiteboards_upd.
create policy mind_maps_upd on public.mind_maps
  for update to authenticated using (public.can_access_mind_map(id)) with check (public.can_access_mind_map(id));

create policy mind_maps_del on public.mind_maps
  for delete to authenticated using (public.can_edit_mind_map(id));

create policy mind_map_owners_select on public.mind_map_owners
  for select to authenticated using (public.can_access_mind_map(mind_map_id));

create policy mind_map_owners_write on public.mind_map_owners
  for all to authenticated using (public.can_edit_mind_map(mind_map_id)) with check (public.can_edit_mind_map(mind_map_id));

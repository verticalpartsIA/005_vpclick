-- Issue #191 (Whiteboards colaborativos): quadro branco (canvas infinito,
-- formas, conectores, sticky notes) com autosave, vinculável a tarefas.
-- Engine gráfica é a biblioteca tldraw (open-source), não construída do
-- zero — issue pede explicitamente "não reinventar engine gráfica sem
-- justificar". Escopo desta fase: SEM colaboração em tempo real (precisaria
-- de infra de sync — websocket/CRDT — que este projeto não tem; documentado
-- como próximo incremento). Persistência via snapshot jsonb com autosave.

create table public.whiteboards (
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

create table public.whiteboard_owners (
  whiteboard_id uuid not null references public.whiteboards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (whiteboard_id, user_id)
);

create table public.whiteboard_tasks (
  whiteboard_id uuid not null references public.whiteboards(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (whiteboard_id, task_id)
);

create index idx_whiteboard_owners_user_id on public.whiteboard_owners(user_id);
create index idx_whiteboard_tasks_task_id on public.whiteboard_tasks(task_id);

create or replace function public.can_access_whiteboard(p_whiteboard uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.whiteboards w
    where w.id = p_whiteboard
      and (
        w.access = 'workspace'
        or w.created_by = auth.uid()
        or public.is_manager()
        or exists (select 1 from public.whiteboard_owners wo where wo.whiteboard_id = w.id and wo.user_id = auth.uid())
      )
  );
$$;

create or replace function public.can_edit_whiteboard(p_whiteboard uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.whiteboards w
    where w.id = p_whiteboard
      and (
        w.created_by = auth.uid()
        or public.is_manager()
        or exists (select 1 from public.whiteboard_owners wo where wo.whiteboard_id = w.id and wo.user_id = auth.uid())
      )
  );
$$;

alter table public.whiteboards enable row level security;
alter table public.whiteboard_owners enable row level security;
alter table public.whiteboard_tasks enable row level security;

-- SELECT direto nas colunas (NÃO reconsulta whiteboards) — lição da #188:
-- self-lookup na mesma tabela quebra RETURNING de INSERT.
create policy whiteboards_select on public.whiteboards
  for select to authenticated using (
    access = 'workspace'
    or created_by = auth.uid()
    or public.is_manager()
    or exists (select 1 from public.whiteboard_owners wo where wo.whiteboard_id = whiteboards.id and wo.user_id = auth.uid())
  );

create policy whiteboards_ins on public.whiteboards
  for insert to authenticated with check (created_by = auth.uid());

-- Qualquer um com acesso pode salvar o canvas (autosave), não só quem edita
-- metadados — colaboração dentro do quadro é o ponto central da feature.
create policy whiteboards_upd on public.whiteboards
  for update to authenticated using (public.can_access_whiteboard(id)) with check (public.can_access_whiteboard(id));

create policy whiteboards_del on public.whiteboards
  for delete to authenticated using (public.can_edit_whiteboard(id));

create policy whiteboard_owners_select on public.whiteboard_owners
  for select to authenticated using (public.can_access_whiteboard(whiteboard_id));

create policy whiteboard_owners_write on public.whiteboard_owners
  for all to authenticated using (public.can_edit_whiteboard(whiteboard_id)) with check (public.can_edit_whiteboard(whiteboard_id));

create policy whiteboard_tasks_select on public.whiteboard_tasks
  for select to authenticated using (public.can_access_whiteboard(whiteboard_id));

create policy whiteboard_tasks_write on public.whiteboard_tasks
  for all to authenticated using (public.can_access_whiteboard(whiteboard_id)) with check (public.can_access_whiteboard(whiteboard_id));

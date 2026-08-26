-- Permite comentarios para qualquer usuario com acesso legitimo a tarefa.
--
-- O app agora insere comentarios com ID gerado no cliente e sem RETURNING, mas
-- as policies tambem precisam estar explicitas: quem consegue acessar a tarefa
-- pode comentar, editar/atribuir/resolver conforme as regras atuais da tela.

alter table public.task_comments enable row level security;

grant select, insert, update, delete on table public.task_comments to authenticated;

drop policy if exists "Enable all for authenticated users" on public.task_comments;
drop policy if exists auth_task_comments on public.task_comments;
drop policy if exists task_comments_select on public.task_comments;
drop policy if exists task_comments_ins on public.task_comments;
drop policy if exists task_comments_upd on public.task_comments;
drop policy if exists task_comments_del on public.task_comments;

create policy task_comments_select
  on public.task_comments
  for select to authenticated
  using (public.can_access_task(task_id));

create policy task_comments_ins
  on public.task_comments
  for insert to authenticated
  with check (
    public.can_access_task(task_id)
    and user_id = (select auth.uid())
  );

create policy task_comments_upd
  on public.task_comments
  for update to authenticated
  using (public.can_access_task(task_id))
  with check (public.can_access_task(task_id));

create policy task_comments_del
  on public.task_comments
  for delete to authenticated
  using (public.can_access_task(task_id));

alter table public.task_comments replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_comments'
  ) then
    alter publication supabase_realtime add table public.task_comments;
  end if;
end $$;

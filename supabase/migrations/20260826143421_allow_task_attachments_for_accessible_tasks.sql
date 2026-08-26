-- Permite anexos e links para qualquer usuario com acesso legitimo a tarefa.
--
-- Contexto do bug: colaboradores com acesso por alcada/responsabilidade podiam
-- abrir a tarefa, mas o fluxo de anexos dependia de policies de Storage e de
-- task_attachments alinhadas com public.can_access_task(task_id). Quando alguma
-- policy antiga ficava permissiva demais ou restritiva demais, o sintoma era
-- inconsistente: upload parecia acontecer, mas o anexo sumia ao reabrir.

alter table public.task_attachments enable row level security;

grant select, insert, update, delete on table public.task_attachments to authenticated;

drop policy if exists "Enable all for authenticated users" on public.task_attachments;
drop policy if exists auth_task_attachments on public.task_attachments;
drop policy if exists task_attachments_select on public.task_attachments;
drop policy if exists task_attachments_ins on public.task_attachments;
drop policy if exists task_attachments_upd on public.task_attachments;
drop policy if exists task_attachments_del on public.task_attachments;

create policy task_attachments_select
  on public.task_attachments
  for select to authenticated
  using (public.can_access_task(task_id));

create policy task_attachments_ins
  on public.task_attachments
  for insert to authenticated
  with check (public.can_access_task(task_id));

create policy task_attachments_upd
  on public.task_attachments
  for update to authenticated
  using (public.can_access_task(task_id))
  with check (public.can_access_task(task_id));

create policy task_attachments_del
  on public.task_attachments
  for delete to authenticated
  using (public.can_access_task(task_id));

alter table public.task_attachments replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_attachments'
  ) then
    alter publication supabase_realtime add table public.task_attachments;
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('task-files', 'task-files', true)
on conflict (id) do update set public = true;

drop policy if exists "vpclick_storage_read" on storage.objects;
drop policy if exists "vpclick_storage_insert" on storage.objects;
drop policy if exists "vpclick_storage_update" on storage.objects;
drop policy if exists "vpclick_storage_delete" on storage.objects;
drop policy if exists "vpclick_task_files_read" on storage.objects;
drop policy if exists "vpclick_task_files_insert" on storage.objects;
drop policy if exists "vpclick_task_files_update" on storage.objects;
drop policy if exists "vpclick_task_files_delete" on storage.objects;
drop policy if exists "vpclick_general_files_read" on storage.objects;
drop policy if exists "vpclick_general_files_insert" on storage.objects;
drop policy if exists "vpclick_general_files_update" on storage.objects;
drop policy if exists "vpclick_general_files_delete" on storage.objects;

create policy "vpclick_general_files_read"
  on storage.objects
  for select
  using (bucket_id in ('task-files', 'doc-files', 'avatars'));

create policy "vpclick_general_files_insert"
  on storage.objects
  for insert to authenticated
  with check (bucket_id in ('doc-files', 'avatars'));

create policy "vpclick_general_files_update"
  on storage.objects
  for update to authenticated
  using (bucket_id in ('doc-files', 'avatars'))
  with check (bucket_id in ('doc-files', 'avatars'));

create policy "vpclick_general_files_delete"
  on storage.objects
  for delete to authenticated
  using (bucket_id in ('doc-files', 'avatars'));

create policy "vpclick_task_files_insert"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'task-files'
    and case
      when name ~ '^tasks/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
        then public.can_access_task(split_part(name, '/', 2)::uuid)
      else false
    end
  );

create policy "vpclick_task_files_update"
  on storage.objects
  for update to authenticated
  using (
    bucket_id = 'task-files'
    and case
      when name ~ '^tasks/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
        then public.can_access_task(split_part(name, '/', 2)::uuid)
      else false
    end
  )
  with check (
    bucket_id = 'task-files'
    and case
      when name ~ '^tasks/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
        then public.can_access_task(split_part(name, '/', 2)::uuid)
      else false
    end
  );

create policy "vpclick_task_files_delete"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-files'
    and case
      when name ~ '^tasks/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
        then public.can_access_task(split_part(name, '/', 2)::uuid)
      else false
    end
  );

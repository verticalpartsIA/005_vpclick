-- Migration 31 — Fase 2b-2 da RLS: fechar ESCRITAS estruturais + docs
-- APLICADA e VALIDADA em produção (migration `rls_fase2b2_write_lockdown_hierarchy_docs`).
-- Estrutura (spaces/folders/lists) = ação de ADMIN/GESTOR (a UI gateia assim) via
-- helper is_manager(). docs/doc_attachments = quem acessa a pasta (ou o criador).
-- Validado por impersonação (Caio COLABORADOR + Arilene GESTOR):
--   ✔ colaborador NÃO edita estrutura (0 linhas / is_manager=false)
--   ✔ gestor edita estrutura acessível (1 linha)
--   ✔ colaborador cria doc em pasta acessível; bloqueado em inacessível (42501)
-- NOTA: o app renomeia/edita estrutura sem .select(), então não sofre do artefato
-- RETURNING+SELECT. A criação de ESPAÇO por não-admin é tratada na migration 32
-- (trigger) + ajuste no handleCreateSpace (id do cliente, sem RETURNING).

create or replace function public.is_manager() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles
                where id = (select auth.uid()) and role in ('ADMIN','GESTOR'));
$$;
revoke execute on function public.is_manager() from public;
grant  execute on function public.is_manager() to authenticated;

-- spaces / folders / lists: escrita = manager
drop policy if exists spaces_ins on public.spaces;
drop policy if exists spaces_upd on public.spaces;
drop policy if exists spaces_del on public.spaces;
create policy spaces_ins on public.spaces for insert to authenticated with check (public.is_manager());
create policy spaces_upd on public.spaces for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy spaces_del on public.spaces for delete to authenticated using (public.is_manager());

drop policy if exists folders_ins on public.folders;
drop policy if exists folders_upd on public.folders;
drop policy if exists folders_del on public.folders;
create policy folders_ins on public.folders for insert to authenticated with check (public.is_manager());
create policy folders_upd on public.folders for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy folders_del on public.folders for delete to authenticated using (public.is_manager());

drop policy if exists lists_ins on public.lists;
drop policy if exists lists_upd on public.lists;
drop policy if exists lists_del on public.lists;
create policy lists_ins on public.lists for insert to authenticated with check (public.is_manager());
create policy lists_upd on public.lists for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy lists_del on public.lists for delete to authenticated using (public.is_manager());

-- docs: quem acessa a pasta, ou o criador
drop policy if exists docs_ins on public.docs;
drop policy if exists docs_upd on public.docs;
drop policy if exists docs_del on public.docs;
create policy docs_ins on public.docs for insert to authenticated
  with check (public.can_access_folder(folder_id));
create policy docs_upd on public.docs for update to authenticated
  using (public.can_access_folder(folder_id) or created_by = (select auth.uid()))
  with check (public.can_access_folder(folder_id) or created_by = (select auth.uid()));
create policy docs_del on public.docs for delete to authenticated
  using (public.can_access_folder(folder_id) or created_by = (select auth.uid()));

-- doc_attachments: via doc pai
drop policy if exists doc_attachments_ins on public.doc_attachments;
drop policy if exists doc_attachments_upd on public.doc_attachments;
drop policy if exists doc_attachments_del on public.doc_attachments;
create policy doc_attachments_ins on public.doc_attachments for insert to authenticated
  with check (exists (select 1 from public.docs d where d.id = doc_attachments.doc_id
                      and (public.can_access_folder(d.folder_id) or d.created_by = (select auth.uid()))));
create policy doc_attachments_upd on public.doc_attachments for update to authenticated
  using (exists (select 1 from public.docs d where d.id = doc_attachments.doc_id
                 and (public.can_access_folder(d.folder_id) or d.created_by = (select auth.uid()))))
  with check (exists (select 1 from public.docs d where d.id = doc_attachments.doc_id
                 and (public.can_access_folder(d.folder_id) or d.created_by = (select auth.uid()))));
create policy doc_attachments_del on public.doc_attachments for delete to authenticated
  using (exists (select 1 from public.docs d where d.id = doc_attachments.doc_id
                 and (public.can_access_folder(d.folder_id) or d.created_by = (select auth.uid()))));

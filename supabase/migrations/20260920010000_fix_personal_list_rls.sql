-- Corrige RLS de "Lista pessoal" (lists.owner_id, sem folder_id).
--
-- can_access_folder(NULL) so retorna true pra is_admin() (as duas outras
-- clausulas dependem de comparar contra um folder_id de verdade). Como
-- lists_select/tasks via can_access_list usam can_access_folder(folder_id) e
-- lists_ins exige is_manager(), o resultado em producao era: COLABORADOR
-- (29 dos 42 usuarios) nem consegue criar a propria lista pessoal (INSERT
-- barrado), e um GESTOR que consegue criar (is_manager() = true) nunca mais
-- volta a ve-la no proximo carregamento (SELECT exige is_admin()) nem
-- consegue inserir tarefas dentro dela (can_access_list -> can_access_folder
-- -> is_admin()). Unico registro de "Lista pessoal" em producao pertence a
-- um ADMIN, que e o unico role coberto por acidente. Ver App.tsx
-- ensurePersonalList()/onNavigate('Lista pessoal').
--
-- Fix: dono de uma lista pessoal (folder_id is null) pode sempre ler/criar/
-- editar a propria, e can_access_list reconhece o mesmo caso pra permitir
-- inserir tarefas nela.

create or replace function public.can_access_list(p_list uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.lists l
    where l.id = p_list
      and (
        public.can_access_folder(l.folder_id)
        or (l.folder_id is null and l.owner_id = (select auth.uid()))
      )
  );
$$;

drop policy if exists lists_select on public.lists;
create policy lists_select
  on public.lists
  for select to authenticated
  using (
    can_access_folder(folder_id)
    or (folder_id is null and owner_id = (select auth.uid()))
  );

drop policy if exists lists_ins on public.lists;
create policy lists_ins
  on public.lists
  for insert to authenticated
  with check (
    is_manager()
    or (folder_id is null and owner_id = (select auth.uid()))
  );

drop policy if exists lists_upd on public.lists;
create policy lists_upd
  on public.lists
  for update to authenticated
  using (is_manager() or (folder_id is null and owner_id = (select auth.uid())))
  with check (is_manager() or (folder_id is null and owner_id = (select auth.uid())));

drop policy if exists lists_del on public.lists;
create policy lists_del
  on public.lists
  for delete to authenticated
  using (is_manager() or (folder_id is null and owner_id = (select auth.uid())));

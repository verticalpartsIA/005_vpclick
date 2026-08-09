-- Migration 34 — CORREÇÃO CRÍTICA: `.insert().select()` (RETURNING) por não-admin
-- APLICADA e VALIDADA em produção (migration `rls_fix_select_policies_avoid_self_reference`).
--
-- BUG (regressão da Fase 2a/2b): criar tarefa/lista/pasta (e clones) falhava com
--   ERROR 42501: new row violates row-level security policy
-- para colaborador/gestor. O smoke test pegou (criar espaço/pasta não conclui;
-- "erro RLS em tasks"). Causa: as políticas de SELECT chamavam
-- can_access_task/list/folder(id), que RE-CONSULTAM a própria tabela para a linha
-- nova; como essas funções são STABLE (snapshot do início do statement), NÃO
-- enxergam a linha recém-inserida → o RETURNING é barrado (o app usa
-- `.insert().select()` em quase tudo).
--
-- Correção: as políticas de SELECT passam a usar as COLUNAS DA PRÓPRIA LINHA
-- (list_id/folder_id/space_id/assignees) em vez de re-consultar a tabela. Mesma
-- semântica (o pai já existe), sem auto-referência → funciona no SELECT normal e
-- no RETURNING. Validado: criar tarefa/lista/pasta com RETURNING passa;
-- visibilidade preservada (colaborador de teste continua vendo exatamente 227
-- tarefas). spaces continua via trigger grant_space_creator_access + id no
-- cliente (o acesso do space novo depende de user_access, gravado no mesmo
-- statement pelo trigger).

-- tasks: inline do corpo do can_access_task usando colunas da linha
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (
       public.can_access_list(list_id)
    or main_assignee_id = (select auth.uid())
    or (select auth.uid()) = any(secondary_assignee_ids)
    or created_by = (select auth.uid())
    or exists (select 1 from public.task_watchers w where w.task_id = tasks.id and w.user_id = (select auth.uid()))
  );

-- lists: usa o folder_id da linha (a pasta já existe)
drop policy if exists lists_select on public.lists;
create policy lists_select on public.lists for select to authenticated
  using (public.can_access_folder(folder_id));

-- folders: usa id/space_id da linha (o espaço já existe; sem re-consultar folders)
drop policy if exists folders_select on public.folders;
create policy folders_select on public.folders for select to authenticated
  using (
       public.is_admin()
    or public.can_access_space(space_id)
    or exists (select 1 from public.user_access ua where ua.user_id = (select auth.uid()) and folders.id = any(ua.folder_ids))
  );

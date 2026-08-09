-- Migration 30 — Fase 2b-1 da RLS: fechar ESCRITAS de tarefas e sub-entidades
-- =============================================================================
-- APLICADA e VALIDADA em produção (migration `rls_fase2b1_write_lockdown_tasks`).
-- Substitui as policies de escrita TEMPORÁRIAS (`true`) da Fase 2a por regras
-- reais em tasks + sub-entidades (comments/checklists/attachments/dependencies/
-- activities/extension_logs) + custom_field_values.
--
-- Modelo:
--   • INSERT usa can_access_list(list_id) / can_access_task(task_id|entity_id) —
--     a linha ainda não existe, então NÃO dá para usar can_access_task(id) no
--     check de tasks.
--   • UPDATE: USING can_access_task (linha atual). O WITH CHECK de tasks valida a
--     acessibilidade PÓS-escrita pelas COLUNAS NOVAS (list_id/assignees/created_by)
--     — evita auto-referência que leria o estado antigo, e preserva o caso de um
--     responsável editar tarefa em lista que ele não acessa (atribuição entre times).
--   • DELETE: USING can_access_task.
--
-- NÃO tocadas aqui (Fase 2b-2): escritas de spaces/folders/lists/docs/
-- doc_attachments (ações estruturais de ADMIN/GESTOR) — seguem `true` temporário.
--
-- VALIDAÇÃO por impersonação (COLABORADOR Caio + GESTOR Arilene):
--   ✔ update/delete de tarefa/sub-entidade ACESSÍVEL → permitido
--   ✔ update/delete INACESSÍVEL → bloqueado (0 linhas)
--   ✔ insert de tarefa em lista ACESSÍVEL → permitido
--   ✔ insert de tarefa em lista INACESSÍVEL → erro RLS (42501)
--   ✔ responsável editando tarefa atribuída em lista NÃO acessível → permitido
-- CAVEAT: automação onCreateTask que mire uma lista que o ator NÃO acessa seria
--   bloqueada (raro; a falha da automação é capturada e não é fatal).

-- tasks
drop policy if exists tasks_ins on public.tasks;
drop policy if exists tasks_upd on public.tasks;
drop policy if exists tasks_del on public.tasks;
create policy tasks_ins on public.tasks for insert to authenticated
  with check (public.can_access_list(list_id));
create policy tasks_upd on public.tasks for update to authenticated
  using (public.can_access_task(id))
  with check (
       public.can_access_list(list_id)
    or main_assignee_id = (select auth.uid())
    or (select auth.uid()) = any(secondary_assignee_ids)
    or created_by = (select auth.uid())
  );
create policy tasks_del on public.tasks for delete to authenticated
  using (public.can_access_task(id));

-- sub-entidades com task_id (CRUD)
drop policy if exists task_comments_ins on public.task_comments;
drop policy if exists task_comments_upd on public.task_comments;
drop policy if exists task_comments_del on public.task_comments;
create policy task_comments_ins on public.task_comments for insert to authenticated with check (public.can_access_task(task_id));
create policy task_comments_upd on public.task_comments for update to authenticated using (public.can_access_task(task_id)) with check (public.can_access_task(task_id));
create policy task_comments_del on public.task_comments for delete to authenticated using (public.can_access_task(task_id));

drop policy if exists task_checklists_ins on public.task_checklists;
drop policy if exists task_checklists_upd on public.task_checklists;
drop policy if exists task_checklists_del on public.task_checklists;
create policy task_checklists_ins on public.task_checklists for insert to authenticated with check (public.can_access_task(task_id));
create policy task_checklists_upd on public.task_checklists for update to authenticated using (public.can_access_task(task_id)) with check (public.can_access_task(task_id));
create policy task_checklists_del on public.task_checklists for delete to authenticated using (public.can_access_task(task_id));

drop policy if exists task_attachments_ins on public.task_attachments;
drop policy if exists task_attachments_upd on public.task_attachments;
drop policy if exists task_attachments_del on public.task_attachments;
create policy task_attachments_ins on public.task_attachments for insert to authenticated with check (public.can_access_task(task_id));
create policy task_attachments_upd on public.task_attachments for update to authenticated using (public.can_access_task(task_id)) with check (public.can_access_task(task_id));
create policy task_attachments_del on public.task_attachments for delete to authenticated using (public.can_access_task(task_id));

drop policy if exists task_dependencies_ins on public.task_dependencies;
drop policy if exists task_dependencies_upd on public.task_dependencies;
drop policy if exists task_dependencies_del on public.task_dependencies;
create policy task_dependencies_ins on public.task_dependencies for insert to authenticated with check (public.can_access_task(task_id));
create policy task_dependencies_upd on public.task_dependencies for update to authenticated using (public.can_access_task(task_id)) with check (public.can_access_task(task_id));
create policy task_dependencies_del on public.task_dependencies for delete to authenticated using (public.can_access_task(task_id));

-- append-only
drop policy if exists task_activities_ins on public.task_activities;
create policy task_activities_ins on public.task_activities for insert to authenticated with check (public.can_access_task(task_id));

drop policy if exists task_extension_logs_ins on public.task_extension_logs;
create policy task_extension_logs_ins on public.task_extension_logs for insert to authenticated with check (public.can_access_task(task_id));

-- custom_field_values (entity_id = task)
drop policy if exists custom_field_values_ins on public.custom_field_values;
drop policy if exists custom_field_values_upd on public.custom_field_values;
drop policy if exists custom_field_values_del on public.custom_field_values;
create policy custom_field_values_ins on public.custom_field_values for insert to authenticated with check (public.can_access_task(entity_id));
create policy custom_field_values_upd on public.custom_field_values for update to authenticated using (public.can_access_task(entity_id)) with check (public.can_access_task(entity_id));
create policy custom_field_values_del on public.custom_field_values for delete to authenticated using (public.can_access_task(entity_id));

-- ROLLBACK: recriar as policies temporárias `true` (drop as *_ins/_upd/_del acima
-- e `create policy <nome> for <cmd> to authenticated using(true) with check(true)`).

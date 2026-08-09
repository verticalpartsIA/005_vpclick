-- Migration 33 — Fase 3 da RLS: fechar ESCRITAS de config workspace-wide
-- APLICADA e VALIDADA em produção (migration `rls_fase3_config_write_lockdown`).
--
-- Config compartilhada (campos personalizados, grupos/opções de status, workspace):
-- LEITURA livre (todos precisam ler as definições) mas ESCRITA só is_manager()
-- (ADMIN/GESTOR). Antes era `ALL true` — um colaborador criava/alterava config
-- global (o smoke test pegou: colaborador criou "Campo Smoke"). O botão
-- "Gerenciar campos" dentro da tarefa também foi gateado por papel no App.tsx.
-- Validado por impersonação: colaborador NÃO cria campo (42501), gestor cria,
-- colaborador continua LENDO os campos (SELECT true).
--
-- workspace_tags ficou de fora (tags podem ser criadas por colaborador ao marcar
-- tarefas — verificar o fluxo antes de fechar).

-- custom_fields
drop policy if exists auth_custom_fields on public.custom_fields;
create policy custom_fields_select on public.custom_fields for select to authenticated using (true);
create policy custom_fields_ins on public.custom_fields for insert to authenticated with check (public.is_manager());
create policy custom_fields_upd on public.custom_fields for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy custom_fields_del on public.custom_fields for delete to authenticated using (public.is_manager());

-- task_status_groups
drop policy if exists auth_task_status_groups on public.task_status_groups;
create policy task_status_groups_select on public.task_status_groups for select to authenticated using (true);
create policy task_status_groups_ins on public.task_status_groups for insert to authenticated with check (public.is_manager());
create policy task_status_groups_upd on public.task_status_groups for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy task_status_groups_del on public.task_status_groups for delete to authenticated using (public.is_manager());

-- task_status_options
drop policy if exists auth_task_status_options on public.task_status_options;
create policy task_status_options_select on public.task_status_options for select to authenticated using (true);
create policy task_status_options_ins on public.task_status_options for insert to authenticated with check (public.is_manager());
create policy task_status_options_upd on public.task_status_options for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy task_status_options_del on public.task_status_options for delete to authenticated using (public.is_manager());

-- workspaces
drop policy if exists auth_workspaces on public.workspaces;
create policy workspaces_select on public.workspaces for select to authenticated using (true);
create policy workspaces_ins on public.workspaces for insert to authenticated with check (public.is_manager());
create policy workspaces_upd on public.workspaces for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy workspaces_del on public.workspaces for delete to authenticated using (public.is_manager());

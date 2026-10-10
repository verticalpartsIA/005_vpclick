-- Corrige o lint de performance "unindexed_foreign_keys" do Supabase (51
-- ocorrências): colunas de foreign key sem índice cobrindo, que deixam joins,
-- filtros e a verificação de dependentes em DELETE/UPDATE mais lentos que o
-- necessário (sequential scan em vez de index scan).
--
-- CREATE INDEX simples (não CONCURRENTLY) — migrations do Supabase rodam
-- dentro de uma transação, e CONCURRENTLY não pode rodar em transação. Nas
-- tabelas atuais (milhares de linhas, não milhões) o lock breve é aceitável.
--
-- IF NOT EXISTS: idempotente, seguro reaplicar.

create index if not exists idx_auth_pins_user_id on public.auth_pins (user_id);
create index if not exists idx_automations_created_by on public.automations (created_by);
create index if not exists idx_automations_list_id on public.automations (list_id);
create index if not exists idx_company_holidays_created_by on public.company_holidays (created_by);
create index if not exists idx_custom_fields_created_by on public.custom_fields (created_by);
create index if not exists idx_doc_attachments_created_by on public.doc_attachments (created_by);
create index if not exists idx_doc_attachments_doc_id on public.doc_attachments (doc_id);
create index if not exists idx_docs_created_by on public.docs (created_by);
create index if not exists idx_docs_folder_id on public.docs (folder_id);
create index if not exists idx_docs_parent_id on public.docs (parent_id);
create index if not exists idx_folder_permissions_user_id on public.folder_permissions (user_id);
create index if not exists idx_form_questions_custom_field_id on public.form_questions (custom_field_id);
create index if not exists idx_form_submissions_submitted_by on public.form_submissions (submitted_by);
create index if not exists idx_form_submissions_task_id on public.form_submissions (task_id);
create index if not exists idx_forms_created_by on public.forms (created_by);
create index if not exists idx_forms_default_assignee_id on public.forms (default_assignee_id);
create index if not exists idx_goal_targets_task_id on public.goal_targets (task_id);
create index if not exists idx_goals_created_by on public.goals (created_by);
create index if not exists idx_list_column_prefs_updated_by on public.list_column_prefs (updated_by);
create index if not exists idx_list_permissions_user_id on public.list_permissions (user_id);
create index if not exists idx_lists_status_group_id on public.lists (status_group_id);
create index if not exists idx_meeting_action_items_task_id on public.meeting_action_items (task_id);
create index if not exists idx_meeting_rooms_created_by on public.meeting_rooms (created_by);
create index if not exists idx_meetings_created_by on public.meetings (created_by);
create index if not exists idx_mind_maps_created_by on public.mind_maps (created_by);
create index if not exists idx_notification_dispatch_log_recipient_user_id on public.notification_dispatch_log (recipient_user_id);
create index if not exists idx_notifications_actor_id on public.notifications (actor_id);
create index if not exists idx_notifications_comment_id on public.notifications (comment_id);
create index if not exists idx_notifications_task_id on public.notifications (task_id);
create index if not exists idx_portfolio_lists_list_id on public.portfolio_lists (list_id);
create index if not exists idx_portfolios_created_by on public.portfolios (created_by);
create index if not exists idx_projects_manager_id on public.projects (manager_id);
create index if not exists idx_reminders_task_id on public.reminders (task_id);
create index if not exists idx_spaces_workspace_id on public.spaces (workspace_id);
create index if not exists idx_task_activities_user_id on public.task_activities (user_id);
create index if not exists idx_task_comments_resolved_by on public.task_comments (resolved_by);
create index if not exists idx_task_comments_user_id on public.task_comments (user_id);
create index if not exists idx_task_dependencies_created_by on public.task_dependencies (created_by);
create index if not exists idx_task_extension_logs_updated_by on public.task_extension_logs (updated_by);
create index if not exists idx_task_recurrence_rules_created_by on public.task_recurrence_rules (created_by);
create index if not exists idx_task_status_options_group_id on public.task_status_options (group_id);
create index if not exists idx_tasks_archived_by on public.tasks (archived_by);
create index if not exists idx_tasks_deleted_by on public.tasks (deleted_by);
create index if not exists idx_tasks_parent_id on public.tasks (parent_id);
create index if not exists idx_tasks_project_id on public.tasks (project_id);
create index if not exists idx_tasks_recurrence_parent_task_id on public.tasks (recurrence_parent_task_id);
create index if not exists idx_team_members_user_id on public.team_members (user_id);
create index if not exists idx_teams_created_by on public.teams (created_by);
create index if not exists idx_user_time_off_created_by on public.user_time_off (created_by);
create index if not exists idx_whiteboards_created_by on public.whiteboards (created_by);
create index if not exists idx_workspace_tags_created_by on public.workspace_tags (created_by);

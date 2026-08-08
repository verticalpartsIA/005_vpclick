-- Migration 28 — Fase 2a da RLS: FECHAR AS LEITURAS do núcleo de conteúdo
-- =============================================================================
-- ⚠️ NÃO APLICADA. Rascunho revisável para a próxima sessão. Aplicar via MCP
-- apply_migration SOMENTE após validação por impersonação (ver "PLANO DE
-- VALIDAÇÃO" no fim) — RLS errada TRANCA usuários fora.
--
-- OBJETIVO: hoje spaces/folders/lists/tasks/docs e as sub-entidades de tarefa
-- têm policy `ALL USING true` (leitura aberta) → qualquer autenticado baixa
-- TUDO via API/Realtime. Esta fase troca a LEITURA (SELECT) por regras reais que
-- espelham EXATAMENTE os filtros do cliente (App.tsx):
--   • allowedFolderIdSet (2612): pasta acessível = folder_id concedido OU a
--     pasta pertence a um space concedido (user_access.space_ids/folder_ids).
--   • scopeTasks (2623): tarefa visível = está em lista acessível OU o usuário é
--     responsável (main/secondary). AQUI a RLS é um pouco MAIS permissiva de
--     propósito (inclui created_by e observador) para não quebrar os fluxos de
--     Inbox/notificação que abrem a tarefa direto por id (fetchTaskDetails).
--   • ADMIN vê tudo (is_admin()). GESTOR e COLABORADOR veem só o concedido
--     (confirmado: filteredSpaces só libera geral para ADMIN).
--
-- ESCOPO desta fase: só SELECT. As ESCRITAS (insert/update/delete) ficam
-- TEMPORARIAMENTE abertas (policies `true`) para NÃO quebrar criação/edição/
-- automação/duplicação enquanto validamos as leituras. A Fase 2b (migration 29,
-- rascunho no fim deste arquivo) fecha as escritas com validação própria.
--
-- Pré-requisitos já em produção: Fase 0 (índices) e Fase 1 (is_admin(),
-- user_access/profiles fechados). GOTCHA aprendido na Fase 1: revogar EXECUTE
-- tem que ser `from public` (não de anon/authenticated).

-- ── Funções auxiliares (SECURITY DEFINER p/ ler a hierarquia sem cair na RLS) ─
-- language sql + STABLE → inlináveis pelo planner (melhor performance por linha).
create or replace function public.can_access_space(p_space uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.user_access ua
    where ua.user_id = (select auth.uid()) and p_space = any(ua.space_ids)
  );
$$;

create or replace function public.can_access_folder(p_folder uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or exists (select 1 from public.user_access ua
               where ua.user_id = (select auth.uid()) and p_folder = any(ua.folder_ids))
    or exists (select 1 from public.folders f
               where f.id = p_folder and public.can_access_space(f.space_id));
$$;

create or replace function public.can_access_list(p_list uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lists l
                 where l.id = p_list and public.can_access_folder(l.folder_id));
$$;

-- Tarefa acessível = lista acessível OU responsável/criador/observador.
create or replace function public.can_access_task(p_task uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task and (
         public.can_access_list(t.list_id)
      or t.main_assignee_id = (select auth.uid())
      or (select auth.uid()) = any(t.secondary_assignee_ids)
      or t.created_by = (select auth.uid())
      or exists (select 1 from public.task_watchers w
                 where w.task_id = t.id and w.user_id = (select auth.uid()))
    )
  );
$$;

-- Grants: authenticated PRECISA executar (a RLS chama). Fora de PUBLIC.
revoke execute on function public.can_access_space(uuid), public.can_access_folder(uuid),
                          public.can_access_list(uuid), public.can_access_task(uuid) from public;
grant  execute on function public.can_access_space(uuid), public.can_access_folder(uuid),
                          public.can_access_list(uuid), public.can_access_task(uuid) to authenticated;

-- Helper p/ policies temporárias de escrita (mantém o comportamento atual).
-- (inline abaixo como `with check (true)` / `using (true)`.)

-- ── spaces ───────────────────────────────────────────────────────────────────
drop policy if exists auth_spaces on public.spaces;
create policy spaces_select on public.spaces for select to authenticated using (public.can_access_space(id));
create policy spaces_ins on public.spaces for insert to authenticated with check (true);
create policy spaces_upd on public.spaces for update to authenticated using (true) with check (true);
create policy spaces_del on public.spaces for delete to authenticated using (true);

-- ── folders ──────────────────────────────────────────────────────────────────
drop policy if exists auth_folders on public.folders;
create policy folders_select on public.folders for select to authenticated using (public.can_access_folder(id));
create policy folders_ins on public.folders for insert to authenticated with check (true);
create policy folders_upd on public.folders for update to authenticated using (true) with check (true);
create policy folders_del on public.folders for delete to authenticated using (true);

-- ── lists ────────────────────────────────────────────────────────────────────
drop policy if exists auth_lists on public.lists;
create policy lists_select on public.lists for select to authenticated using (public.can_access_list(id));
create policy lists_ins on public.lists for insert to authenticated with check (true);
create policy lists_upd on public.lists for update to authenticated using (true) with check (true);
create policy lists_del on public.lists for delete to authenticated using (true);

-- ── tasks ────────────────────────────────────────────────────────────────────
drop policy if exists auth_tasks on public.tasks;
create policy tasks_select on public.tasks for select to authenticated using (public.can_access_task(id));
create policy tasks_ins on public.tasks for insert to authenticated with check (true);
create policy tasks_upd on public.tasks for update to authenticated using (true) with check (true);
create policy tasks_del on public.tasks for delete to authenticated using (true);

-- ── docs / doc_attachments ───────────────────────────────────────────────────
drop policy if exists auth_docs on public.docs;
create policy docs_select on public.docs for select to authenticated
  using (public.can_access_folder(folder_id) or created_by = (select auth.uid()));
create policy docs_ins on public.docs for insert to authenticated with check (true);
create policy docs_upd on public.docs for update to authenticated using (true) with check (true);
create policy docs_del on public.docs for delete to authenticated using (true);

drop policy if exists "Enable all for authenticated users" on public.doc_attachments;
create policy doc_attachments_select on public.doc_attachments for select to authenticated
  using (exists (select 1 from public.docs d
                 where d.id = doc_attachments.doc_id
                   and (public.can_access_folder(d.folder_id) or d.created_by = (select auth.uid()))));
create policy doc_attachments_ins on public.doc_attachments for insert to authenticated with check (true);
create policy doc_attachments_upd on public.doc_attachments for update to authenticated using (true) with check (true);
create policy doc_attachments_del on public.doc_attachments for delete to authenticated using (true);

-- ── sub-entidades de tarefa (todas têm task_id) → can_access_task(task_id) ────
-- task_comments (tinha 2 policies ALL true)
drop policy if exists "Enable all for authenticated users" on public.task_comments;
drop policy if exists auth_task_comments on public.task_comments;
create policy task_comments_select on public.task_comments for select to authenticated using (public.can_access_task(task_id));
create policy task_comments_ins on public.task_comments for insert to authenticated with check (true);
create policy task_comments_upd on public.task_comments for update to authenticated using (true) with check (true);
create policy task_comments_del on public.task_comments for delete to authenticated using (true);

-- task_checklists
drop policy if exists auth_task_checklists on public.task_checklists;
create policy task_checklists_select on public.task_checklists for select to authenticated using (public.can_access_task(task_id));
create policy task_checklists_ins on public.task_checklists for insert to authenticated with check (true);
create policy task_checklists_upd on public.task_checklists for update to authenticated using (true) with check (true);
create policy task_checklists_del on public.task_checklists for delete to authenticated using (true);

-- task_attachments (tinha 2 policies ALL true)
drop policy if exists "Enable all for authenticated users" on public.task_attachments;
drop policy if exists auth_task_attachments on public.task_attachments;
create policy task_attachments_select on public.task_attachments for select to authenticated using (public.can_access_task(task_id));
create policy task_attachments_ins on public.task_attachments for insert to authenticated with check (true);
create policy task_attachments_upd on public.task_attachments for update to authenticated using (true) with check (true);
create policy task_attachments_del on public.task_attachments for delete to authenticated using (true);

-- task_activities (já era SELECT/INSERT separados)
drop policy if exists "Permitir leitura para usuários autenticados" on public.task_activities;
drop policy if exists "Permitir inserção para usuários autenticados" on public.task_activities;
create policy task_activities_select on public.task_activities for select to authenticated using (public.can_access_task(task_id));
create policy task_activities_ins on public.task_activities for insert to authenticated with check (true);

-- task_dependencies
drop policy if exists task_dependencies_authenticated on public.task_dependencies;
create policy task_dependencies_select on public.task_dependencies for select to authenticated using (public.can_access_task(task_id));
create policy task_dependencies_ins on public.task_dependencies for insert to authenticated with check (true);
create policy task_dependencies_upd on public.task_dependencies for update to authenticated using (true) with check (true);
create policy task_dependencies_del on public.task_dependencies for delete to authenticated using (true);

-- task_extension_logs (tinha 2 policies ALL true)
drop policy if exists "Enable all for authenticated users" on public.task_extension_logs;
drop policy if exists auth_task_extension_logs on public.task_extension_logs;
create policy task_extension_logs_select on public.task_extension_logs for select to authenticated using (public.can_access_task(task_id));
create policy task_extension_logs_ins on public.task_extension_logs for insert to authenticated with check (true);

-- custom_field_values (todos os custom_fields são target TASK → entity_id = task)
drop policy if exists auth_custom_field_values on public.custom_field_values;
create policy custom_field_values_select on public.custom_field_values for select to authenticated using (public.can_access_task(entity_id));
create policy custom_field_values_ins on public.custom_field_values for insert to authenticated with check (true);
create policy custom_field_values_upd on public.custom_field_values for update to authenticated using (true) with check (true);
create policy custom_field_values_del on public.custom_field_values for delete to authenticated using (true);

-- ── NÃO tocadas nesta fase (motivo): ─────────────────────────────────────────
--   • projects: sem ligação com a hierarquia (só manager_id) — decidir escopo à
--     parte (deixar legível? por manager_id? por tarefas acessíveis?).
--   • custom_fields, workspaces, workspace_tags, task_status_groups/options:
--     config/definições compartilhadas — leitura ampla é aceitável (não são
--     "dados do usuário"). Revisar na Fase 3.
--   • task_watchers, teams, team_members, notifications, meetings: já têm
--     policies próprias (não ALL-true) — revisar depois se necessário.

-- =============================================================================
-- PLANO DE VALIDAÇÃO (rodar ANTES de considerar aplicada — via execute_sql,
-- impersonando com `set local role authenticated; set local request.jwt.claims`)
-- =============================================================================
-- Usar 1 ADMIN, 1 COLABORADOR com acesso a ALGUNS spaces, e uma tarefa fora do
-- acesso dele mas onde ele é responsável.
--   R1. admin: count(*) de tasks/lists/folders/spaces == totais (vê tudo).
--   R2. colaborador: count(spaces) == nº de spaces concedidos (não o total).
--   R3. colaborador: count(folders) == pastas concedidas + pastas dos spaces concedidos (== allowedFolderIdSet).
--   R4. colaborador: count(tasks) == tarefas em listas acessíveis ∪ onde é responsável — comparar com scopeTasks do app.
--   R5. colaborador: SELECT de uma tarefa de um space SEM acesso e onde ele NÃO é responsável → 0 linhas.
--   R6. colaborador: SELECT dessa mesma tarefa se ele for responsável → 1 linha (fluxo Inbox).
--   R7. sub-entidades: colaborador só vê comments/checklists/attachments/custom_field_values de tarefas que ele vê.
--   R8. PERFORMANCE: EXPLAIN ANALYZE de `select * from tasks` como colaborador (7k linhas) — confirmar uso dos índices da Fase 0 e tempo aceitável. Se lento, revisar (STABLE/inline, índices).
--   R9. Smoke real no app: logar como colaborador e como admin; confirmar sidebar/tarefas/docs carregam certo e nada some indevidamente.
-- Se QUALQUER checagem falhar → rollback (abaixo) e revisar.

-- ── ROLLBACK (restaura o estado ALL-true anterior) ───────────────────────────
--   drop policy if exists spaces_select on public.spaces; drop policy if exists spaces_ins on public.spaces;
--   drop policy if exists spaces_upd on public.spaces; drop policy if exists spaces_del on public.spaces;
--   create policy auth_spaces on public.spaces for all to authenticated using (true);
--   -- (repetir o mesmo padrão para folders/lists/tasks/docs/doc_attachments e cada
--   --  sub-entidade, recriando a policy `... for all to authenticated using (true)`
--   --  com o nome original listado nos DROP acima.)

-- =============================================================================
-- FASE 2b — FECHAR AS ESCRITAS (rascunho de desenho; validar caminho a caminho)
-- =============================================================================
-- Trocar as policies temporárias `*_ins/_upd/_del ... true` por regras reais.
-- CUIDADO: em INSERT não dá para usar can_access_task(id) (a linha ainda não
-- existe) → usar can_access_list(list_id). Caminhos a validar sem quebrar:
--   • criar tarefa (insert em lista acessível): with check (can_access_list(list_id)).
--   • mover tarefa (update de list_id): using (can_access_task(id)) with check (can_access_list(list_id)).
--   • bulk ops (status/priority/move/delete) — via taskRepo; conferem acesso.
--   • duplicação de tarefa (insertTaskClone) e de lista (cloneRow): inserem em
--     lista/pasta que o duplicador acessa → ok com can_access_list.
--   • automação onCreateTask/onCreateSubtask: created_by = actor; garantir que o
--     actor tem can_access_list da lista alvo.
--   • sub-entidades (comments/checklists/attachments/activities/deps/ext_logs/
--     custom_field_values): with check (can_access_task(task_id|entity_id)).
--   • spaces/folders/lists: criar/editar exige papel ADMIN/GESTOR (ver App.tsx
--     3046/4659). Escrita = is_admin() OR is_gestor()? Criar helper is_gestor().
-- Validar cada um por impersonação (insert/update dentro de begin;...;rollback;).

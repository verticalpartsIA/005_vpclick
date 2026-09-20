-- Corrige o lint de performance "auth_rls_initplan" do Supabase (31
-- ocorrências) em todas as políticas de RLS afetadas do projeto.
--
-- Problema: uma política que escreve `auth.uid()` direto na expressão faz o
-- Postgres reavaliar essa função PARA CADA LINHA verificada, em vez de uma
-- única vez por consulta. Envolvendo a chamada numa subconsulta —
-- `(select auth.uid())` — o planejador consegue tratá-la como InitPlan
-- (avaliada uma vez, resultado reaproveitado pra todas as linhas). Mesmo
-- resultado, custo bem menor em tabelas grandes (ex.: notifications,
-- task_watchers, crescem com o uso diário).
--
-- Nenhuma mudança de comportamento/autorização — só a forma de escrever a
-- mesma condição. Cobre as 31 políticas exatas apontadas pelo advisor
-- (mcp__Supabase__get_advisors, type=performance, 2026-09-19); funções
-- auxiliares chamadas por outras políticas (is_manager(), can_access_task(),
-- can_edit_form() etc.) não foram tocadas aqui — não apareceram no advisor
-- porque a política em si não referencia auth.uid() diretamente (fica dentro
-- da função, fora do escopo deste lint específico).

alter policy "Users can view their own pins" on public.auth_pins
  using ((select auth.uid()) = user_id);

alter policy "Acesso total para admins e gestores em pastas" on public.folder_permissions
  using (exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.role = any (array['ADMIN','GESTOR'])
  ));

alter policy "Usuários podem ver suas próprias permissões em pastas" on public.folder_permissions
  using (user_id = (select auth.uid()));

alter policy teams_write on public.teams
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = any (array['ADMIN','GESTOR'])
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = any (array['ADMIN','GESTOR'])
  ));

alter policy team_members_write on public.team_members
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = any (array['ADMIN','GESTOR'])
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = any (array['ADMIN','GESTOR'])
  ));

alter policy notifications_select on public.notifications
  using (user_id = (select auth.uid()));

alter policy notifications_update on public.notifications
  using (user_id = (select auth.uid()));

alter policy notifications_delete on public.notifications
  using (user_id = (select auth.uid()));

alter policy user_favorites_select on public.user_favorites
  using (user_id = (select auth.uid()));

alter policy user_favorites_insert on public.user_favorites
  with check (user_id = (select auth.uid()));

alter policy user_favorites_delete on public.user_favorites
  using (user_id = (select auth.uid()));

alter policy task_watchers_insert on public.task_watchers
  with check (user_id = (select auth.uid()));

alter policy task_watchers_delete on public.task_watchers
  using (user_id = (select auth.uid()));

alter policy meetings_delete on public.meetings
  using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = any (array['ADMIN','GESTOR'])
    )
  );

alter policy user_capacity_write on public.user_capacity
  using (user_id = (select auth.uid()) or is_manager())
  with check (user_id = (select auth.uid()) or is_manager());

alter policy user_time_off_write on public.user_time_off
  using (user_id = (select auth.uid()) or is_manager())
  with check (user_id = (select auth.uid()) or is_manager());

alter policy task_time_entries_ins on public.task_time_entries
  with check (can_access_task(task_id) and user_id = (select auth.uid()));

alter policy task_time_entries_upd on public.task_time_entries
  using (can_access_task(task_id) and (user_id = (select auth.uid()) or is_manager()))
  with check (can_access_task(task_id) and (user_id = (select auth.uid()) or is_manager()));

alter policy task_time_entries_del on public.task_time_entries
  using (can_access_task(task_id) and (user_id = (select auth.uid()) or is_manager()));

alter policy goals_ins on public.goals
  with check (created_by = (select auth.uid()));

alter policy goals_select on public.goals
  using (
    access = 'workspace'
    or created_by = (select auth.uid())
    or is_manager()
    or exists (select 1 from public.goal_owners go where go.goal_id = goals.id and go.user_id = (select auth.uid()))
  );

alter policy portfolios_ins on public.portfolios
  with check (created_by = (select auth.uid()));

alter policy portfolios_select on public.portfolios
  using (
    access = 'workspace'
    or created_by = (select auth.uid())
    or is_manager()
    or exists (select 1 from public.portfolio_owners po where po.portfolio_id = portfolios.id and po.user_id = (select auth.uid()))
  );

alter policy forms_ins on public.forms
  with check (created_by = (select auth.uid()) and can_access_list(list_id));

alter policy forms_select on public.forms
  using (can_access_list(list_id) or created_by = (select auth.uid()) or is_manager());

alter policy form_submissions_ins on public.form_submissions
  with check (submitted_by = (select auth.uid()) and can_access_form(form_id));

alter policy form_submissions_select on public.form_submissions
  using (submitted_by = (select auth.uid()) or can_edit_form(form_id));

alter policy whiteboards_ins on public.whiteboards
  with check (created_by = (select auth.uid()));

alter policy whiteboards_select on public.whiteboards
  using (
    access = 'workspace'
    or created_by = (select auth.uid())
    or is_manager()
    or exists (select 1 from public.whiteboard_owners wo where wo.whiteboard_id = whiteboards.id and wo.user_id = (select auth.uid()))
  );

alter policy mind_maps_ins on public.mind_maps
  with check (created_by = (select auth.uid()));

alter policy mind_maps_select on public.mind_maps
  using (
    access = 'workspace'
    or created_by = (select auth.uid())
    or is_manager()
    or exists (select 1 from public.mind_map_owners mo where mo.mind_map_id = mind_maps.id and mo.user_id = (select auth.uid()))
  );

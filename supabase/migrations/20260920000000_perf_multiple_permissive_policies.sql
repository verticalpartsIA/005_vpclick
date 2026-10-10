-- Corrige o lint de performance "multiple_permissive_policies" do Supabase
-- (15 ocorrências): em cada uma das 15 tabelas abaixo, havia uma política
-- "_select" (FOR SELECT) e uma política "_write" (FOR ALL, que já cobre
-- SELECT também) — as duas PERMISSIVE, então toda leitura avaliava as duas
-- condições (combinadas por OR) em vez de uma só.
--
-- Correção: uma única política de SELECT por tabela, com a condição unida
-- (select_qual OR write_qual — exatamente o resultado que a combinação das
-- duas políticas antigas já produzia, então nenhuma autorização muda) e a
-- política de escrita restrita a INSERT/UPDATE/DELETE (Postgres não permite
-- "FOR INSERT, UPDATE, DELETE" numa política só — precisa de uma por
-- comando, mesma condição repetida nas três).
--
-- Em 7 das 15 tabelas a condição de SELECT já era `true` ou já continha a
-- condição de escrita dentro do próprio OR — nesses casos a política de
-- SELECT já existente cobre o resultado combinado sem precisar de ALTER.

-- company_holidays: select já é `true` (cobre write=is_manager() trivialmente)
drop policy company_holidays_write on public.company_holidays;
create policy company_holidays_insert on public.company_holidays for insert with check (is_manager());
create policy company_holidays_update on public.company_holidays for update using (is_manager()) with check (is_manager());
create policy company_holidays_delete on public.company_holidays for delete using (is_manager());

-- folder_permissions: precisa unir as duas condições no select
alter policy "Usuários podem ver suas próprias permissões em pastas" on public.folder_permissions
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['ADMIN','GESTOR']))
  );
drop policy "Acesso total para admins e gestores em pastas" on public.folder_permissions;
create policy folder_permissions_insert on public.folder_permissions for insert with check (
  exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['ADMIN','GESTOR']))
);
create policy folder_permissions_update on public.folder_permissions for update using (
  exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['ADMIN','GESTOR']))
) with check (
  exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['ADMIN','GESTOR']))
);
create policy folder_permissions_delete on public.folder_permissions for delete using (
  exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['ADMIN','GESTOR']))
);

-- form_questions: união can_access_form OR can_edit_form
alter policy form_questions_select on public.form_questions
  using (can_access_form(form_id) or can_edit_form(form_id));
drop policy form_questions_write on public.form_questions;
create policy form_questions_insert on public.form_questions for insert with check (can_edit_form(form_id));
create policy form_questions_update on public.form_questions for update using (can_edit_form(form_id)) with check (can_edit_form(form_id));
create policy form_questions_delete on public.form_questions for delete using (can_edit_form(form_id));

-- goal_owners: união can_access_goal OR can_edit_goal
alter policy goal_owners_select on public.goal_owners
  using (can_access_goal(goal_id) or can_edit_goal(goal_id));
drop policy goal_owners_write on public.goal_owners;
create policy goal_owners_insert on public.goal_owners for insert with check (can_edit_goal(goal_id));
create policy goal_owners_update on public.goal_owners for update using (can_edit_goal(goal_id)) with check (can_edit_goal(goal_id));
create policy goal_owners_delete on public.goal_owners for delete using (can_edit_goal(goal_id));

-- goal_targets: mesma união
alter policy goal_targets_select on public.goal_targets
  using (can_access_goal(goal_id) or can_edit_goal(goal_id));
drop policy goal_targets_write on public.goal_targets;
create policy goal_targets_insert on public.goal_targets for insert with check (can_edit_goal(goal_id));
create policy goal_targets_update on public.goal_targets for update using (can_edit_goal(goal_id)) with check (can_edit_goal(goal_id));
create policy goal_targets_delete on public.goal_targets for delete using (can_edit_goal(goal_id));

-- mind_map_owners: união can_access_mind_map OR can_edit_mind_map
alter policy mind_map_owners_select on public.mind_map_owners
  using (can_access_mind_map(mind_map_id) or can_edit_mind_map(mind_map_id));
drop policy mind_map_owners_write on public.mind_map_owners;
create policy mind_map_owners_insert on public.mind_map_owners for insert with check (can_edit_mind_map(mind_map_id));
create policy mind_map_owners_update on public.mind_map_owners for update using (can_edit_mind_map(mind_map_id)) with check (can_edit_mind_map(mind_map_id));
create policy mind_map_owners_delete on public.mind_map_owners for delete using (can_edit_mind_map(mind_map_id));

-- portfolio_lists: união can_access_portfolio OR can_edit_portfolio
alter policy portfolio_lists_select on public.portfolio_lists
  using (can_access_portfolio(portfolio_id) or can_edit_portfolio(portfolio_id));
drop policy portfolio_lists_write on public.portfolio_lists;
create policy portfolio_lists_insert on public.portfolio_lists for insert with check (can_edit_portfolio(portfolio_id));
create policy portfolio_lists_update on public.portfolio_lists for update using (can_edit_portfolio(portfolio_id)) with check (can_edit_portfolio(portfolio_id));
create policy portfolio_lists_delete on public.portfolio_lists for delete using (can_edit_portfolio(portfolio_id));

-- portfolio_owners: mesma união
alter policy portfolio_owners_select on public.portfolio_owners
  using (can_access_portfolio(portfolio_id) or can_edit_portfolio(portfolio_id));
drop policy portfolio_owners_write on public.portfolio_owners;
create policy portfolio_owners_insert on public.portfolio_owners for insert with check (can_edit_portfolio(portfolio_id));
create policy portfolio_owners_update on public.portfolio_owners for update using (can_edit_portfolio(portfolio_id)) with check (can_edit_portfolio(portfolio_id));
create policy portfolio_owners_delete on public.portfolio_owners for delete using (can_edit_portfolio(portfolio_id));

-- team_members: select já é `true`
drop policy team_members_write on public.team_members;
create policy team_members_insert on public.team_members for insert with check (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = any (array['ADMIN','GESTOR']))
);
create policy team_members_update on public.team_members for update using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = any (array['ADMIN','GESTOR']))
) with check (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = any (array['ADMIN','GESTOR']))
);
create policy team_members_delete on public.team_members for delete using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = any (array['ADMIN','GESTOR']))
);

-- teams: select já é `true`
drop policy teams_write on public.teams;
create policy teams_insert on public.teams for insert with check (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = any (array['ADMIN','GESTOR']))
);
create policy teams_update on public.teams for update using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = any (array['ADMIN','GESTOR']))
) with check (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = any (array['ADMIN','GESTOR']))
);
create policy teams_delete on public.teams for delete using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = any (array['ADMIN','GESTOR']))
);

-- user_access: select já inclui "or is_admin()" — já cobre write=is_admin()
drop policy user_access_write on public.user_access;
create policy user_access_insert on public.user_access for insert with check (is_admin());
create policy user_access_update on public.user_access for update using (is_admin()) with check (is_admin());
create policy user_access_delete on public.user_access for delete using (is_admin());

-- user_capacity: select já é `true`
drop policy user_capacity_write on public.user_capacity;
create policy user_capacity_insert on public.user_capacity for insert with check ((select auth.uid()) = user_id or is_manager());
create policy user_capacity_update on public.user_capacity for update using ((select auth.uid()) = user_id or is_manager()) with check ((select auth.uid()) = user_id or is_manager());
create policy user_capacity_delete on public.user_capacity for delete using ((select auth.uid()) = user_id or is_manager());

-- user_time_off: select já é `true`
drop policy user_time_off_write on public.user_time_off;
create policy user_time_off_insert on public.user_time_off for insert with check ((select auth.uid()) = user_id or is_manager());
create policy user_time_off_update on public.user_time_off for update using ((select auth.uid()) = user_id or is_manager()) with check ((select auth.uid()) = user_id or is_manager());
create policy user_time_off_delete on public.user_time_off for delete using ((select auth.uid()) = user_id or is_manager());

-- whiteboard_owners: união can_access_whiteboard OR can_edit_whiteboard
alter policy whiteboard_owners_select on public.whiteboard_owners
  using (can_access_whiteboard(whiteboard_id) or can_edit_whiteboard(whiteboard_id));
drop policy whiteboard_owners_write on public.whiteboard_owners;
create policy whiteboard_owners_insert on public.whiteboard_owners for insert with check (can_edit_whiteboard(whiteboard_id));
create policy whiteboard_owners_update on public.whiteboard_owners for update using (can_edit_whiteboard(whiteboard_id)) with check (can_edit_whiteboard(whiteboard_id));
create policy whiteboard_owners_delete on public.whiteboard_owners for delete using (can_edit_whiteboard(whiteboard_id));

-- whiteboard_tasks: select e write já usam a MESMA função (can_access_whiteboard) — sem alter
drop policy whiteboard_tasks_write on public.whiteboard_tasks;
create policy whiteboard_tasks_insert on public.whiteboard_tasks for insert with check (can_access_whiteboard(whiteboard_id));
create policy whiteboard_tasks_update on public.whiteboard_tasks for update using (can_access_whiteboard(whiteboard_id)) with check (can_access_whiteboard(whiteboard_id));
create policy whiteboard_tasks_delete on public.whiteboard_tasks for delete using (can_access_whiteboard(whiteboard_id));

-- Escopa as policies de goals explicitamente pra "authenticated" (estavam
-- em PUBLIC implícito) — mesmo padrão de lists/tasks/user_time_off.
drop policy goals_select on public.goals;
drop policy goals_ins on public.goals;
drop policy goals_upd on public.goals;
drop policy goals_del on public.goals;
drop policy goal_owners_select on public.goal_owners;
drop policy goal_owners_write on public.goal_owners;
drop policy goal_targets_select on public.goal_targets;
drop policy goal_targets_write on public.goal_targets;

create policy goals_select on public.goals
  for select to authenticated using (public.can_access_goal(id));

create policy goals_ins on public.goals
  for insert to authenticated with check (created_by = auth.uid());

create policy goals_upd on public.goals
  for update to authenticated using (public.can_edit_goal(id)) with check (public.can_edit_goal(id));

create policy goals_del on public.goals
  for delete to authenticated using (public.can_edit_goal(id));

create policy goal_owners_select on public.goal_owners
  for select to authenticated using (public.can_access_goal(goal_id));

create policy goal_owners_write on public.goal_owners
  for all to authenticated using (public.can_edit_goal(goal_id)) with check (public.can_edit_goal(goal_id));

create policy goal_targets_select on public.goal_targets
  for select to authenticated using (public.can_access_goal(goal_id));

create policy goal_targets_write on public.goal_targets
  for all to authenticated using (public.can_edit_goal(goal_id)) with check (public.can_edit_goal(goal_id));

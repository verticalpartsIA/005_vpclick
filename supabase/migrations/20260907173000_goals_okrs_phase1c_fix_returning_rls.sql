-- Causa raiz confirmada por teste manual: a policy goals_select usava
-- can_access_goal(id), que reconsulta a própria tabela goals via SELECT
-- (self-join). Isso quebra especificamente o RETURNING de um INSERT em
-- goals (Postgres reavalia a policy de SELECT sobre a linha nova recém-
-- inserida pra poder devolvê-la, e o self-lookup não a enxerga de forma
-- confiável nesse momento) — confirmado: INSERT sem RETURNING funciona,
-- COM RETURNING sempre falha com "new row violates row-level security
-- policy for table goals", mesmo com created_by = auth.uid() idêntico.
-- Fix: goals_select passa a checar as colunas da própria linha nova
-- diretamente (sem reconsultar goals), só faz sub-select em goal_owners
-- (tabela diferente, sem o mesmo problema).
drop policy goals_select on public.goals;
create policy goals_select on public.goals
  for select to authenticated using (
    access = 'workspace'
    or created_by = auth.uid()
    or public.is_manager()
    or exists (select 1 from public.goal_owners go where go.goal_id = goals.id and go.user_id = auth.uid())
  );

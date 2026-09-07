-- Issue #187 (Workload/Capacidade), gota 2: RPC de agregação server-side —
-- mesmo padrão arquitetural de get_dashboard_summary (SECURITY INVOKER,
-- respeita RLS de `tasks` linha a linha via can_access_task, nunca traz
-- tarefa por tarefa pro cliente). Distribui estimated_hours igualmente
-- pelos dias úteis (exclui sáb/dom + company_holidays + user_time_off do
-- responsável) entre start_date e due_date, dentro do período pedido.
--
-- Decisão de produto assumida (não confirmada com o negócio — documentar
-- se precisar mudar depois): tarefa com múltiplos responsáveis DUPLICA o
-- esforço pra cada um (mesmo comportamento padrão do ClickUp), não divide.
--
-- Gap aceito nesta gota: tarefas sem due_date não entram na agregação
-- (não têm "quando" pra distribuir) — ficam de fora do resultado.
create or replace function public.get_workload_summary(
  p_list_ids uuid[] default null,
  p_period_start date default (current_date - 7),
  p_period_end date default (current_date + 30)
)
returns table(
  user_id uuid,
  bucket_date date,
  planned_hours numeric,
  task_count bigint
)
language sql
stable
security invoker
set search_path = public
as $function$
  with scoped as (
    select
      t.id,
      t.estimated_hours,
      t.main_assignee_id,
      t.secondary_assignee_ids,
      greatest(coalesce(t.start_date, t.due_date), p_period_start) as range_start,
      least(t.due_date, p_period_end) as range_end
    from public.tasks t
    where t.deleted_at is null
      and t.archived_at is null
      and t.due_date is not null
      and t.due_date >= p_period_start
      and coalesce(t.start_date, t.due_date) <= p_period_end
      and (p_list_ids is null or t.list_id = any(p_list_ids))
  ),
  assignees as (
    select s.id, s.estimated_hours, s.range_start, s.range_end, s.main_assignee_id as assignee_id
    from scoped s
    where s.main_assignee_id is not null
    union all
    select s.id, s.estimated_hours, s.range_start, s.range_end, unnest(s.secondary_assignee_ids) as assignee_id
    from scoped s
    where s.secondary_assignee_ids is not null and array_length(s.secondary_assignee_ids, 1) > 0
  ),
  business_days as (
    select
      a.id, a.assignee_id, a.estimated_hours,
      d::date as day
    from assignees a
    cross join lateral generate_series(a.range_start, a.range_end, interval '1 day') as d
    where extract(dow from d) not in (0, 6)
      and not exists (select 1 from public.company_holidays h where h.date = d::date)
      and not exists (
        select 1 from public.user_time_off o
        where o.user_id = a.assignee_id and d::date between o.start_date and o.end_date
      )
  ),
  day_counts as (
    select id, assignee_id, estimated_hours, count(*) as n_days
    from business_days
    group by id, assignee_id, estimated_hours
  )
  select
    bd.assignee_id as user_id,
    bd.day as bucket_date,
    sum(coalesce(dc.estimated_hours, 0) / nullif(dc.n_days, 0)) as planned_hours,
    count(distinct bd.id) as task_count
  from business_days bd
  join day_counts dc on dc.id = bd.id and dc.assignee_id = bd.assignee_id
  group by bd.assignee_id, bd.day
  order by bd.assignee_id, bd.day;
$function$;

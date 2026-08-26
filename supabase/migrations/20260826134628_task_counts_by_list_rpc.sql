-- Contadores rápidos da sidebar: em vez de o navegador baixar uma linha por
-- tarefa só para contar, o Postgres devolve o resumo por lista/status.
-- SECURITY INVOKER mantém as policies/RLS do usuário autenticado.
create or replace function public.get_task_counts_by_list(p_list_ids uuid[] default null)
returns table (
  list_id uuid,
  status text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.list_id,
    t.status,
    count(*)::bigint as total_count
  from public.tasks t
  where
    p_list_ids is null
    or (
      cardinality(p_list_ids) > 0
      and t.list_id = any(p_list_ids)
    )
  group by t.list_id, t.status
  order by t.list_id, t.status;
$$;

revoke execute on function public.get_task_counts_by_list(uuid[]) from public;
revoke execute on function public.get_task_counts_by_list(uuid[]) from anon;
grant execute on function public.get_task_counts_by_list(uuid[]) to authenticated;

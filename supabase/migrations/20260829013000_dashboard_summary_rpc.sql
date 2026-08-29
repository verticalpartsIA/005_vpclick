-- Resumo agregado do Dashboard (visão global, workspace inteiro): antes o
-- navegador precisava baixar uma linha por tarefa (chegando a dezenas de
-- milhares) só pra computar Total/Concluídas/Atrasadas/Em Dia/Aguardando/
-- Prorrogadas, o Radar de Saúde, a pizza de status, o ranking por usuário e a
-- distribuição por prioridade — e um código que pulava esse carregamento por
-- completo na visão global (achado de QA: Dashboard ficava em branco).
--
-- Esta função devolve uma célula por combinação real de
-- (lista, responsável, status, prioridade, saúde, teve extensão de prazo) —
-- a cardinalidade dessas combinações é ordens de grandeza menor que o total
-- de tarefas (várias tarefas caem na mesma célula), então o cliente consegue
-- montar todos os widgets do Dashboard sem baixar uma linha por tarefa.
--
-- A classificação de saúde (health_key) espelha EXATAMENTE getTaskHealth
-- (App.tsx) — nunca reordenar os `when` aqui sem espelhar lá também (e
-- vice-versa), senão os números do Dashboard divergem do resto do app.
--
-- SECURITY INVOKER mantém a RLS de tasks valendo por linha (mesmo padrão de
-- get_task_counts_by_list).
create or replace function public.get_dashboard_summary(p_period text default 'all')
returns table (
  list_id uuid,
  main_assignee_id uuid,
  status text,
  priority text,
  health_key text,
  is_extended boolean,
  count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with cutoff as (
    select case p_period
      when '7d' then (current_date - 7)
      when '30d' then (current_date - 30)
      when '90d' then (current_date - 90)
      else null
    end as cutoff_date
  ),
  scoped as (
    select t.*
    from public.tasks t
    cross join cutoff c
    where c.cutoff_date is null
       or coalesce(t.due_date, t.start_date, t.created_at::date) >= c.cutoff_date
  ),
  classified as (
    select
      list_id,
      main_assignee_id,
      status,
      priority,
      coalesce(extension_count, 0) > 0 as is_extended,
      case
        -- 1. Terminal / concluído
        when lower(status) like '%conclu%' or lower(status) like '%aprovado%' or lower(status) like '%fechado%'
          then 'done'
        -- 2. Cancelado / Reprovado — terminal, não conta como atraso
        when lower(status) like '%cancel%' or lower(status) like '%reprova%'
          then 'cancelled'
        -- 3. Aguardando / Bloqueado / Pendente — em espera, NÃO é atraso
        when lower(status) like '%aguardando%' or lower(status) like '%pendente%' or lower(status) like '%enviada%'
          or lower(status) like '%em espera%' or lower(status) like '%bloqueada%'
          or lower(status) like '%em analise%' or lower(status) like '%em análise%'
          then 'blocked'
        when due_date is null
          then 'nodate'
        when start_date is not null and current_date < start_date
          then 'waiting'
        when current_date > due_date
          then 'late'
        -- Intervalo degenerado (due <= start) cai no mesmo "tranquilo" que o
        -- pct=1 do cálculo em JS (total <= 0 → pct = 1 → 'ok').
        when (due_date - coalesce(start_date, current_date)) <= 0
          then 'ok'
        when (due_date - current_date)::numeric / (due_date - coalesce(start_date, current_date))::numeric > 0.5
          then 'ok'
        when (due_date - current_date)::numeric / (due_date - coalesce(start_date, current_date))::numeric > 0.2
          then 'warning'
        else 'urgent'
      end as health_key
    from scoped
  )
  select
    list_id,
    main_assignee_id,
    status,
    priority,
    health_key,
    is_extended,
    count(*)::bigint as count
  from classified
  group by list_id, main_assignee_id, status, priority, health_key, is_extended;
$$;

revoke execute on function public.get_dashboard_summary(text) from public;
revoke execute on function public.get_dashboard_summary(text) from anon;
grant execute on function public.get_dashboard_summary(text) to authenticated;

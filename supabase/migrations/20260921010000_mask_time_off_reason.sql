-- user_time_off_select era `using(true)`: qualquer usuário autenticado lia
-- a coluna `reason` (texto livre — pode ser motivo médico/pessoal) de
-- QUALQUER outra pessoa direto pela API REST. O app só usa essa tabela pra
-- pintar "Ausente" no grid de Workload (sem mostrar o motivo pra quem não
-- é gestor — WorkloadCapacityModal em App.tsx só mostra `reason` dentro do
-- modal "Configurar capacidade", que só abre pra quem tem canManageCapacity)
-- então o vazamento nunca aparecia na tela, só batendo na API direto.
--
-- Fix: trava o SELECT na tabela pra dono ou gestor (mesma regra já usada em
-- insert/update/delete), e expõe get_visible_time_off(), que mascara
-- `reason` como null pra quem não é dono/gestor — usada pela visão "quem
-- está fora" que todo mundo legitimamente precisa ver (só as datas, sem o
-- motivo).

drop policy if exists user_time_off_select on public.user_time_off;
create policy user_time_off_select
  on public.user_time_off
  for select to authenticated
  using (is_manager() or user_id = (select auth.uid()));

create or replace function public.get_visible_time_off(p_user_ids uuid[] default null)
returns table (id uuid, user_id uuid, start_date date, end_date date, reason text)
language sql
stable security definer
set search_path to 'public'
as $$
  select
    t.id,
    t.user_id,
    t.start_date,
    t.end_date,
    case when public.is_manager() or t.user_id = (select auth.uid()) then t.reason else null end as reason
  from public.user_time_off t
  where p_user_ids is null or t.user_id = any(p_user_ids);
$$;

grant execute on function public.get_visible_time_off(uuid[]) to authenticated;

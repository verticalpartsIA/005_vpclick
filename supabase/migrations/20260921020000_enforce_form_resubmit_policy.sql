-- forms.allow_resubmit existe desde a fase 1 (migration
-- 20260907194500_forms_phase1_schema.sql) e o builder no client já deixa
-- desmarcar "Permitir enviar de novo", mas nada nunca checava a flag — nem
-- client nem banco. Resultado: desmarcar a opção não tinha efeito nenhum,
-- qualquer um respondia o mesmo formulário (e criava tarefas duplicadas)
-- quantas vezes quisesse.
--
-- O fix no client (FormFillModal) cobre o caminho normal (impede reabrir o
-- formulário se já respondeu), mas só o client não pega duplo clique/duas
-- abas abertas ao mesmo tempo — daí o trigger aqui, que é a trava de
-- verdade contra a corrida.

create or replace function public.enforce_form_resubmit_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allow_resubmit boolean;
begin
  select allow_resubmit into v_allow_resubmit from public.forms where id = new.form_id;

  if v_allow_resubmit is false and exists (
    select 1 from public.form_submissions
    where form_id = new.form_id and submitted_by = new.submitted_by
  ) then
    raise exception 'Você já respondeu este formulário.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger form_submissions_resubmit_guard
  before insert on public.form_submissions
  for each row execute function public.enforce_form_resubmit_policy();

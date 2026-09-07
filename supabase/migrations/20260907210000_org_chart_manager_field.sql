-- Issue "Equipes completo" (gráfico organizacional): adiciona hierarquia de
-- gerente por usuário, inspirado no "Gráfico organizacional" do ClickUp real
-- (testado ao vivo em app.clickup.com). `teams`/`team_members` já existiam
-- (feature "Equipes" anterior) — isso só adiciona a peça de hierarquia que
-- faltava.

alter table public.profiles add column manager_id uuid references public.profiles(id) on delete set null;
create index idx_profiles_manager_id on public.profiles(manager_id);

-- RPC dedicada em vez de abrir a policy de UPDATE de profiles pra GESTOR:
-- profiles_update hoje só permite o próprio usuário ou ADMIN (is_admin()).
-- Ampliar isso pra GESTOR deixaria GESTOR editar QUALQUER coluna de QUALQUER
-- perfil (nome, email, role...), não só o gerente. Uma função SECURITY
-- DEFINER estreita o privilégio exatamente ao campo manager_id.
create or replace function public.update_user_manager(p_user_id uuid, p_manager_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_manager() then
    raise exception 'Somente ADMIN ou GESTOR podem definir o gerente de um usuário.';
  end if;
  if p_manager_id = p_user_id then
    raise exception 'Um usuário não pode ser gerente de si mesmo.';
  end if;
  -- Evita ciclo direto (A gerente de B, B gerente de A). Ciclos mais longos
  -- (A->B->C->A) ficariam só como um organograma "errado" visualmente, não
  -- quebram nada tecnicamente, e detectar ciclo arbitrário exigiria um
  -- recursive CTE aqui — fora do escopo desta primeira fase.
  if p_manager_id is not null and exists (
    select 1 from public.profiles where id = p_manager_id and manager_id = p_user_id
  ) then
    raise exception 'Isso criaria um ciclo: % já tem % como gerente.', p_manager_id, p_user_id;
  end if;
  update public.profiles set manager_id = p_manager_id where id = p_user_id;
end;
$$;

-- Migration 35 — RPC de leitura para o alerta de contas inativas no Painel Admin
--
-- Caso real que motivou isso: Emily Oliveira saiu da empresa e ninguém rodou o
-- fluxo de desativação (handleAdminDeleteUser) — o perfil dela ficou com
-- is_active=true e ela seguiu aparecendo no "Ranking da Equipe" do Dashboard
-- como se fosse parte do time atual. Levantamento mostrou outras contas na
-- mesma situação (Rafael Nunes, Guilherme Garcia, Jovanna Mello, Milene
-- Gusmão, Vinicius Leite — 120+ dias sem login).
--
-- O Painel Admin precisa saber há quantos dias cada conta ativa não loga para
-- sinalizar isso. Esse dado (last_sign_in_at) só existe em auth.users, que o
-- client não acessa via PostgREST (schema não exposto). Esta função expõe só
-- (id, last_sign_in_at) — nada de PII adicional — e só para quem já é ADMIN.

create or replace function public.get_users_last_sign_in()
returns table(id uuid, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id, u.last_sign_in_at
  from auth.users u
  where public.is_admin();
$$;

revoke execute on function public.get_users_last_sign_in() from anon;
grant  execute on function public.get_users_last_sign_in() to authenticated;

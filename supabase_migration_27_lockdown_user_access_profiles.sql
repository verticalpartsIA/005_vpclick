-- Migration 27 — Fase 1 da RLS: fechar a "raiz da confiança"
--
-- Fecha os dois pontos que hoje permitem auto-escalonamento total, SEM ainda
-- mexer no núcleo de conteúdo (tasks/lists/... ficam para a Fase 2). Baixo
-- tráfego, alto ganho de segurança.
--
--   1. user_access: hoje é `USING true` (ALL) — qualquer autenticado reescreve
--      os próprios acessos e libera tudo. Passa a: cada um lê só a própria linha
--      (ADMIN lê todas); só ADMIN escreve.
--   2. profiles UPDATE: hoje é `USING true` — qualquer um edita qualquer perfil.
--      Passa a: só a própria linha ou ADMIN. (A proteção do campo `role` já é
--      garantida pelo trigger enforce_profile_role_authorization, que vê OLD/NEW.)
--   3. Endurece as funções SECURITY DEFINER expostas como RPC (advisors).
--
-- Pré-condição de comportamento verificada no app: a ÚNICA escrita de
-- user_access é o painel admin (useUsers.handleAdminUpdateAccess); um usuário
-- comum só precisa ler a própria linha. Perfis são atualizados pelo próprio
-- usuário (avatar/tema/nome) ou por admin.

-- ── Helper: is_admin() ──────────────────────────────────────────────────────
-- SECURITY DEFINER (lê profiles sem cair na RLS de profiles → sem recursão),
-- STABLE, search_path fixo. Base das políticas de Fase 1 e 2.
create or replace function public.is_admin() returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'ADMIN'
  );
$$;

revoke execute on function public.is_admin() from anon;
grant  execute on function public.is_admin() to authenticated;

-- ── user_access: leitura da própria linha (ou ADMIN); escrita só ADMIN ───────
drop policy if exists auth_user_access on public.user_access;

create policy user_access_select on public.user_access
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy user_access_write on public.user_access
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── profiles: UPDATE só da própria linha ou por ADMIN ────────────────────────
-- (INSERT e SELECT permanecem como estão; role continua protegido pelo trigger.)
drop policy if exists auth_profiles_update on public.profiles;

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- ── Endurecimento das funções SECURITY DEFINER expostas via RPC (advisors) ───
-- São funções de trigger — não devem ser chamáveis diretamente pela API. Os
-- triggers continuam disparando normalmente (não dependem do EXECUTE do papel).
revoke execute on function public.enforce_profile_role_authorization() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- search_path mutável (advisors 0011) — fixa sem alterar o corpo das funções.
alter function public.handle_new_user() set search_path = public;
alter function public.update_updated_at_column() set search_path = public;

-- ── Rollback (se necessário) ─────────────────────────────────────────────────
--   drop policy if exists user_access_select on public.user_access;
--   drop policy if exists user_access_write  on public.user_access;
--   create policy auth_user_access on public.user_access for all to authenticated using (true);
--   drop policy if exists profiles_update on public.profiles;
--   create policy auth_profiles_update on public.profiles for update to authenticated using (true);
--   -- (revogações de EXECUTE e search_path podem ser deixados; são melhorias seguras)

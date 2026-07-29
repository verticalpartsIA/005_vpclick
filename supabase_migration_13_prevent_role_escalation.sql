-- ============================================
-- VP CLICK - Migration 13: impede auto-promoção de role em profiles
-- ============================================
--
-- Achado do Codex review no PR #43 (supabase/functions/admin-user-management):
-- a policy "auth_profiles_update" (supabase_migrations.sql:185) dá UPDATE
-- irrestrito em profiles pra qualquer usuário autenticado. Isso significa
-- que a Edge Function admin-user-management, que autoriza olhando
-- profiles.role = 'ADMIN', podia ser furada: qualquer colaborador rodava
--   supabase.from('profiles').update({ role: 'ADMIN' }).eq('id', meuId)
-- pelo cliente autenticado normal, virava "ADMIN" na tabela e só então
-- chamava a Edge Function — que aprovava a ação achando que era admin de
-- verdade. Na prática dava pra criar usuário, resetar senha de qualquer um
-- e excluir contas.
--
-- Este trigger fecha essa brecha: só quem já É admin (ou uma chamada
-- server-side com a service_role, onde auth.uid() vem NULL) pode gravar um
-- role diferente do padrão COLABORADOR em qualquer linha de profiles —
-- inclusive na própria. Não substitui a correção completa do RLS permissivo
-- (CRIT-02 em docs/SECURITY_REMEDIATION.md), mas fecha o caminho mais grave
-- de escalonamento de privilégio enquanto CRIT-02 não é resolvido.

CREATE OR REPLACE FUNCTION public.enforce_profile_role_authorization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Chamadas com a service_role (Edge Functions, SSO, provisionamento) não
  -- têm auth.uid() e já passam por fora do RLS — deixa como está.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    IF caller_role IS DISTINCT FROM 'ADMIN' THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar o papel (role) de um usuário.';
    END IF;
  ELSIF TG_OP = 'INSERT' AND NEW.role IS DISTINCT FROM 'COLABORADOR' THEN
    IF caller_role IS DISTINCT FROM 'ADMIN' THEN
      RAISE EXCEPTION 'Apenas administradores podem criar perfis com papel diferente de COLABORADOR.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_role_authorization ON public.profiles;
CREATE TRIGGER trg_enforce_profile_role_authorization
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_role_authorization();

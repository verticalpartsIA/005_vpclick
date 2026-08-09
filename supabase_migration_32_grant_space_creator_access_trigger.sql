-- Migration 32 — Conserta a regressão "gestor/não-admin cria espaço"
-- APLICADA em produção (migration `rls_fase2b2_grant_space_creator_access_trigger`).
--
-- Contexto: a Fase 1 fechou escrita em user_access (só ADMIN) e a Fase 2a fechou
-- a leitura de spaces. O fluxo antigo do app (escrever user_access + ler o espaço
-- de volta via .select()) quebrou para não-admins. Este trigger concede acesso ao
-- CRIADOR do espaço no servidor (SECURITY DEFINER), sem reabrir auto-escalonamento
-- (só concede o espaço recém-criado). O app foi ajustado em paralelo para inserir
-- o espaço com id gerado no cliente e SEM RETURNING (can_access_space é STABLE e
-- não enxerga o grant do trigger no mesmo statement, então RETURNING falharia).
--
-- Validado: gestor insere espaço (id explícito, sem returning) → passa; o trigger
-- grava o acesso (space_id entra no user_access.space_ids do criador).

create or replace function public.grant_space_creator_access() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    insert into public.user_access (user_id, space_ids, folder_ids)
      values ((select auth.uid()), array[new.id], '{}'::uuid[])
    on conflict (user_id) do update
      set space_ids = array(select distinct unnest(public.user_access.space_ids || excluded.space_ids)),
          updated_at = now();
  end if;
  return new;
end $$;

drop trigger if exists trg_grant_space_creator_access on public.spaces;
create trigger trg_grant_space_creator_access
  after insert on public.spaces
  for each row execute function public.grant_space_creator_access();

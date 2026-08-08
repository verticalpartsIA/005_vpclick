-- Migration 29 — Fase 2c da RLS: performance das queries de leitura
-- =============================================================================
-- APLICADA em produção (migrations `rls_fase2c_title_trigram_index` +
-- `rls_fase2c_can_access_task_cost_hint`). Complementa a app-side (contadores
-- filtrados por lista acessível — ver useTaskCountIndex/fetchTaskCountIndex).
--
-- Contexto: a RLS da Fase 2a avalia can_access_task() por linha. Em queries
-- FILTRADAS por list_id (hot path, fetchTaskRowsByListIds) usa idx_tasks_list_id
-- → ~130ms, ok. Mas queries NÃO-filtradas varriam as ~7k tarefas:
--   • contadores (badges): resolvido no app filtrando por listas acessíveis.
--   • busca por título (ilike): ~5,2s. Ver nota abaixo.

-- 1) Índice trigram no título — deixa `title ilike '%termo%'` usar índice.
create extension if not exists pg_trgm;
create index if not exists idx_tasks_title_trgm on public.tasks using gin (title gin_trgm_ops);

-- 2) Custo realista de can_access_task — a função é cara (join + lookups). Dizer
--    isso ao planner faz ele preferir reduzir linhas por índice antes de chamá-la.
alter function public.can_access_task(uuid) cost 1000;

-- =============================================================================
-- NOTA (limitação conhecida) — busca por título ainda NÃO fica rápida sob RLS:
-- o operador ILIKE (~~*) não é LEAKPROOF, então o Postgres, por segurança, não
-- aplica o filtro de título (via índice trigram) ANTES da barreira de RLS
-- can_access_task — para não avaliar o filtro do usuário em linhas que ele não
-- pode ver. Resultado: mesmo com o índice trigram, a busca faz seq scan sob RLS
-- (confirmado: com `enable_seqscan=off` ele ainda evita o índice). SEM RLS o
-- índice é usado (0,4ms).
--
-- FIX FUTURO (Fase 2c-2): expor a busca via função SECURITY DEFINER, ex.:
--   create function search_tasks(term text, lim int) returns setof tasks
--     language sql stable security definer set search_path=public as $$
--     select t.* from tasks t
--     where t.title ilike '%'||term||'%'   -- usa o índice trigram (sem barreira RLS aqui dentro)
--       and public.can_access_task(t.id)   -- aplica o acesso explicitamente
--     limit lim $$;
-- e o app chama supabase.rpc('search_tasks', ...) em vez do .ilike direto.
-- O índice trigram desta migration já deixa isso pronto.
--
-- ROLLBACK:
--   alter function public.can_access_task(uuid) cost 100;  -- default
--   drop index if exists public.idx_tasks_title_trgm;
--   -- (manter a extensão pg_trgm; é inofensiva)

-- Migration 26 — Fase 0 da RLS: índices de suporte
--
-- Objetivo: dar suporte à futura RLS hierárquica (task → list → folder → space
-- e lookup em user_access) E corrigir um gargalo de performance que já existe
-- hoje — nenhuma dessas colunas de FK/hierarquia estava indexada, então buscas
-- como `fetchTaskRowsByListIds` (tasks WHERE list_id IN (...)) fazem seq scan
-- em ~7k linhas a cada carregamento.
--
-- Seguro e reversível: só cria índices, não altera dados nem políticas. As
-- tabelas são pequenas (milhares de linhas), então o lock de criação é
-- desprezível. Idempotente via IF NOT EXISTS.

create index if not exists idx_tasks_list_id        on public.tasks(list_id);
create index if not exists idx_tasks_main_assignee  on public.tasks(main_assignee_id);
create index if not exists idx_tasks_created_by     on public.tasks(created_by);
create index if not exists idx_lists_folder_id      on public.lists(folder_id);
create index if not exists idx_folders_space_id     on public.folders(space_id);

-- user_access guarda os espaços/pastas concedidos como arrays; GIN acelera os
-- testes de pertencimento (space_id = ANY(space_ids)) que a RLS fará.
create index if not exists idx_user_access_space_ids  on public.user_access using gin(space_ids);
create index if not exists idx_user_access_folder_ids on public.user_access using gin(folder_ids);

-- Rollback (se necessário):
--   drop index if exists public.idx_tasks_list_id, public.idx_tasks_main_assignee,
--     public.idx_tasks_created_by, public.idx_lists_folder_id, public.idx_folders_space_id,
--     public.idx_user_access_space_ids, public.idx_user_access_folder_ids;

-- Migration 11 — Habilita realtime para tarefas, comentários e acessos
--
-- Diagnóstico: a publicação `supabase_realtime` só continha a tabela
-- `notifications`. Por isso, as subscriptions do app para `user_access` (e a nova
-- para `tasks`/`task_comments`) nunca recebiam eventos — mudanças de status,
-- comentários e permissões não apareciam ao vivo em outras abas/usuários (bug #4).
--
-- Esta migration adiciona as tabelas à publicação. É uma mudança ADITIVA e segura:
-- apenas passa a transmitir alterações dessas tabelas via realtime. A entrega a
-- cada cliente continua respeitando o RLS da tabela.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_comments'
  ) then
    alter publication supabase_realtime add table public.task_comments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_access'
  ) then
    alter publication supabase_realtime add table public.user_access;
  end if;
end $$;

-- ============================================
-- VP CLICK - MIGRATION 25: REPLICA IDENTITY FULL EM TASKS E TASK_COMMENTS
-- Já aplicada no projeto Supabase VP CLICK via MCP. Este arquivo documenta a
-- alteração; execute no SQL Editor apenas se precisar reaplicar em outro ambiente:
-- https://supabase.com/dashboard/project/sfpnjwllcmentoocylow/sql/new
-- ============================================

-- Mesmo motivo da migration 23 (que corrigiu `notifications`), agora para as
-- tabelas do núcleo. As duas têm RLS habilitada e estavam com replica identity
-- padrão (só a PK). No Realtime, a RLS é avaliada por cliente para decidir se o
-- evento é entregue; num DELETE, a única coluna disponível é a da replica
-- identity. Com apenas a PK, a policy de SELECT (que olha outras colunas, ex.:
-- acesso via lista) não é avaliável e o evento DELETE é suprimido — a exclusão
-- de uma tarefa não chegava aos outros usuários conectados (a tarefa ficava
-- "fantasma" na tela deles até um refresh). REPLICA IDENTITY FULL inclui a
-- linha antiga completa no payload.old, permitindo a avaliação da RLS.
--
-- Custo: FULL registra a linha antiga inteira no WAL em UPDATE/DELETE (mais
-- volume de replicação). Aceitável para estas tabelas.
ALTER TABLE tasks REPLICA IDENTITY FULL;
ALTER TABLE task_comments REPLICA IDENTITY FULL;

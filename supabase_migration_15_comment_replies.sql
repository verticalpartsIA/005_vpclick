-- ============================================
-- VP CLICK - MIGRATION 15: RESPOSTAS EM COMENTÁRIOS (threads, item 2 da sidebar "Início")
-- Já aplicada no projeto Supabase VP CLICK via MCP. Este arquivo documenta a
-- alteração; execute no SQL Editor apenas se precisar reaplicar em outro ambiente:
-- https://supabase.com/dashboard/project/sfpnjwllcmentoocylow/sql/new
-- ============================================

-- task_comments: um nível de resposta (thread), igual ao modelo do ClickUp
ALTER TABLE task_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES task_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_task_comments_parent_comment_id ON task_comments(parent_comment_id);

-- notifications: novo tipo 'reply' (avisa quem participou da thread)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['mention'::text, 'team_mention'::text, 'assignment'::text, 'comment'::text, 'automation'::text, 'reply'::text]));

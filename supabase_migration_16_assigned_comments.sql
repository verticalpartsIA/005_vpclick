-- ============================================
-- VP CLICK - MIGRATION 16: COMENTÁRIOS ATRIBUÍDOS (item 3 da sidebar "Início", estilo ClickUp)
-- Já aplicada no projeto Supabase VP CLICK via MCP. Este arquivo documenta a
-- alteração; execute no SQL Editor apenas se precisar reaplicar em outro ambiente:
-- https://supabase.com/dashboard/project/sfpnjwllcmentoocylow/sql/new
-- ============================================

-- task_comments: qualquer comentário (raiz ou resposta) pode virar um item de
-- ação atribuído a uma pessoa, igual ao "Assign comments" do ClickUp.
-- assigned_by pode diferir do autor do comentário (quem atribui nem sempre é
-- quem escreveu). resolved_at/resolved_by ficam nulos até a pessoa marcar
-- como resolvido.
ALTER TABLE task_comments
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_task_comments_assigned_to ON task_comments(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_comments_assigned_by ON task_comments(assigned_by) WHERE assigned_by IS NOT NULL;

-- notifications: novos tipos 'comment_assigned' (avisa o atribuído) e
-- 'comment_resolved' (avisa quem atribuiu, quando resolvido)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['mention'::text, 'team_mention'::text, 'assignment'::text, 'comment'::text, 'automation'::text, 'reply'::text, 'comment_assigned'::text, 'comment_resolved'::text]));

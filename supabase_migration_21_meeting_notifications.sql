-- ============================================
-- VP CLICK - MIGRATION 21: NOTIFICAÇÃO DE PARTICIPANTES DE REUNIÃO
-- Já aplicada no projeto Supabase VP CLICK via MCP. Este arquivo documenta a
-- alteração; execute no SQL Editor apenas se precisar reaplicar em outro ambiente:
-- https://supabase.com/dashboard/project/sfpnjwllcmentoocylow/sql/new
-- ============================================

-- notifications: novo tipo 'meeting' (avisa participantes ao serem
-- adicionados a uma reunião) + meeting_id pra permitir abrir a reunião
-- direto a partir da notificação (sino/Caixa de entrada).
ALTER TABLE notifications ADD COLUMN meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['mention'::text, 'team_mention'::text, 'assignment'::text, 'comment'::text, 'automation'::text, 'reply'::text, 'comment_assigned'::text, 'comment_resolved'::text, 'meeting'::text]));

CREATE INDEX idx_notifications_meeting_id ON notifications(meeting_id) WHERE meeting_id IS NOT NULL;

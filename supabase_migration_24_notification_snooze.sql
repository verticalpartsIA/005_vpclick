-- ============================================
-- VP CLICK - MIGRATION 24: ADIAR NOTIFICAÇÃO (SNOOZE)
-- Já aplicada no projeto Supabase VP CLICK via MCP. Este arquivo documenta a
-- alteração; execute no SQL Editor apenas se precisar reaplicar em outro ambiente:
-- https://supabase.com/dashboard/project/sfpnjwllcmentoocylow/sql/new
-- ============================================

-- Caixa de Entrada (InboxView) só tinha "marcar como lida" — sem apagar nem
-- adiar, as outras duas ações básicas de qualquer inbox (inclusive o
-- ClickUp real). Apagar não precisa de coluna nova (é um DELETE simples);
-- adiar precisa guardar até quando a notificação deve ficar escondida da
-- aba "Todas"/"Não lidas" e reaparecer sozinha.
ALTER TABLE notifications ADD COLUMN snoozed_until TIMESTAMPTZ;

CREATE INDEX idx_notifications_snoozed_until ON notifications(snoozed_until) WHERE snoozed_until IS NOT NULL;

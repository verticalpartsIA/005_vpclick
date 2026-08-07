-- ============================================
-- VP CLICK - MIGRATION 23: REPLICA IDENTITY FULL EM NOTIFICATIONS
-- Já aplicada no projeto Supabase VP CLICK via MCP. Este arquivo documenta a
-- alteração; execute no SQL Editor apenas se precisar reaplicar em outro ambiente:
-- https://supabase.com/dashboard/project/sfpnjwllcmentoocylow/sql/new
-- ============================================

-- Ao desmarcar uma reunião (migration 22), o FK notifications.meeting_id
-- ON DELETE CASCADE (migration 21) apaga a notificação do convite. Mas com a
-- replica identity padrão (só a PK), o evento DELETE do Realtime chega sem
-- user_id — o filtro `user_id=eq.<id>` do NotificationBell/InboxView não
-- casa e a notificação nunca é removida da tela de quem estava com o
-- sino/Caixa de Entrada aberta. REPLICA IDENTITY FULL inclui a linha
-- completa no payload.old, permitindo o filtro e a remoção em tempo real.
ALTER TABLE notifications REPLICA IDENTITY FULL;

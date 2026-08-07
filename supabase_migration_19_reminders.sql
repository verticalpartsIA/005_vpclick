-- ============================================
-- VP CLICK - MIGRATION 19: LEMBRETES (item 7 da sidebar "Início", "Hoje e atrasadas", estilo ClickUp)
-- Já aplicada no projeto Supabase VP CLICK via MCP. Este arquivo documenta a
-- alteração; execute no SQL Editor apenas se precisar reaplicar em outro ambiente:
-- https://supabase.com/dashboard/project/sfpnjwllcmentoocylow/sql/new
-- ============================================

-- Lembretes: entidade separada de tarefa — título, detalhes, data/hora de
-- vencimento, preferência de notificação (só guardada, sem disparo real —
-- decisão com o usuário: sem infra de cron/job agendado no v1). Pode virar
-- tarefa de verdade (task_id) ou ser delegado (user_id muda de dono,
-- created_by preserva quem criou/delegou originalmente).
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  details TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  notify_preference TEXT NOT NULL DEFAULT 'off'
    CHECK (notify_preference = ANY (ARRAY['on_due'::text, '10_min_before'::text, '1_hour_before'::text, 'custom'::text, 'off'::text])),
  custom_notify_at TIMESTAMPTZ,
  user_id UUID NOT NULL REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_created_by ON reminders(created_by);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_reminders ON reminders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- VP CLICK - MIGRATION 20: SALAS DE REUNIÃO (reservas com detecção de conflito)
-- Já aplicada no projeto Supabase VP CLICK via MCP. Este arquivo documenta a
-- alteração; execute no SQL Editor apenas se precisar reaplicar em outro ambiente:
-- https://supabase.com/dashboard/project/sfpnjwllcmentoocylow/sql/new
-- ============================================

-- Salas de reunião física (2º Andar | Diretoria, 3º Andar | Espaço Gourmet,
-- Mezanino | Engenharia, etc.) — lista simples, qualquer usuário pode
-- cadastrar uma nova direto no seletor de reunião (mesmo padrão de criar
-- Espaço/Tag). is_active permite "arquivar" uma sala sem quebrar o
-- histórico de reuniões que já a referenciam.
CREATE TABLE meeting_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE meeting_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_meeting_rooms ON meeting_rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO meeting_rooms (name) VALUES
  ('2º Andar | Diretoria'),
  ('3º Andar | Espaço Gourmet'),
  ('Mezanino | Engenharia');

-- Reunião ganha sala (opcional — reunião remota não precisa de sala física)
-- e horário de término. meeting_date já existia como o início; sem um fim,
-- não dá pra detectar sobreposição de horário na mesma sala.
ALTER TABLE meetings ADD COLUMN room_id UUID REFERENCES meeting_rooms(id) ON DELETE SET NULL;
ALTER TABLE meetings ADD COLUMN end_date TIMESTAMPTZ;

CREATE INDEX idx_meetings_room_id ON meetings(room_id);

-- ============================================
-- VP CLICK - MIGRATION 17: REUNIÕES (item 4 da sidebar "Início", estilo ClickUp)
-- Já aplicada no projeto Supabase VP CLICK via MCP. Este arquivo documenta a
-- alteração; execute no SQL Editor apenas se precisar reaplicar em outro ambiente:
-- https://supabase.com/dashboard/project/sfpnjwllcmentoocylow/sql/new
-- ============================================

-- Versão "manual + IA" (decidida com o usuário): sem integração de calendário
-- nem bot entrando em chamada de vídeo como o AI Notetaker do ClickUp — o
-- usuário cola as notas/transcrição depois da reunião e a IA (mesmo Claude do
-- ask-ai, via a nova edge function summarize-meeting) gera o resumo e extrai
-- os itens de ação.
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  participant_ids UUID[] NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  summary TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Itens de ação extraídos pela IA (ou adicionados à mão). task_id fica nulo
-- até alguém clicar em "Criar tarefa" no item — a partir daí ele vira uma
-- tarefa de verdade e o item de ação só espelha o estado dela.
CREATE TABLE meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  task_id UUID REFERENCES tasks(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meetings_meeting_date ON meetings(meeting_date DESC);
CREATE INDEX idx_meeting_action_items_meeting_id ON meeting_action_items(meeting_id);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_meetings ON meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_meeting_action_items ON meeting_action_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

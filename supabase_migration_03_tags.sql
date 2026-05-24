-- ============================================================
-- MIGRATION 03: Tags em tarefas
-- Executar no Supabase SQL Editor
-- https://supabase.com/dashboard/project/sfpnjwllcmentoocylow/sql
-- ============================================================

-- Adiciona coluna tags à tabela tasks (array de texto)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- Índice GIN para buscas eficientes em arrays
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN (tags);

-- Tabela auxiliar de tags disponíveis no workspace (paleta de cores)
CREATE TABLE IF NOT EXISTS workspace_tags (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT '#6366f1',
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, name)
);

ALTER TABLE workspace_tags ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'workspace_tags' AND policyname = 'workspace_tags_authenticated'
  ) THEN
    CREATE POLICY "workspace_tags_authenticated"
      ON workspace_tags FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workspace_tags_workspace
  ON workspace_tags(workspace_id);

-- ============================================================
-- Verificar:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'tasks' AND column_name = 'tags';
-- ============================================================

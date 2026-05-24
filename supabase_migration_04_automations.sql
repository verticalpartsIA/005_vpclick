-- ============================================================
-- MIGRATION 04: Automations + Logs
-- Executar no Supabase SQL Editor
-- https://supabase.com/dashboard/project/sfpnjwllcmentoocylow/sql
-- ============================================================

-- 1) Renomear colunas existentes para o novo schema
ALTER TABLE automations RENAME COLUMN is_active TO enabled;
ALTER TABLE automations RENAME COLUMN trigger_params TO trigger_config;

-- 2) Adicionar colunas faltantes
ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS run_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT now();

-- 3) Garantir DEFAULT e NOT NULL em trigger_config
ALTER TABLE automations ALTER COLUMN trigger_config SET DEFAULT '{}';
UPDATE automations SET trigger_config = '{}' WHERE trigger_config IS NULL;
ALTER TABLE automations ALTER COLUMN trigger_config SET NOT NULL;

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_automations_workspace ON automations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_automations_enabled   ON automations(enabled) WHERE enabled = true;

-- 5) Tabela de log de execuções
CREATE TABLE IF NOT EXISTS automation_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
  triggered_by    TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  actions_taken   JSONB NOT NULL DEFAULT '[]',
  error_message   TEXT,
  executed_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'automation_logs' AND policyname = 'automation_logs_authenticated'
  ) THEN
    CREATE POLICY "automation_logs_authenticated"
      ON automation_logs FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_automation_logs_automation ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_task       ON automation_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_executed   ON automation_logs(executed_at DESC);

-- 6) Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS automations_updated_at ON automations;
CREATE TRIGGER automations_updated_at
  BEFORE UPDATE ON automations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Verificar:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('automations', 'automation_logs');
-- Deve retornar 2 linhas.
-- ============================================================

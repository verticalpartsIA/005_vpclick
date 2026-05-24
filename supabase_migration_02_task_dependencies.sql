-- ============================================================
-- MIGRATION 02: Task Dependencies
-- Executar no Supabase SQL Editor do projeto
-- https://supabase.com/dashboard/project/sfpnjwllcmentoocylow/sql
-- ============================================================

-- Tabela de dependências entre tarefas
CREATE TABLE IF NOT EXISTS task_dependencies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('blocks', 'blocked_by', 'relates_to')),
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT now(),

  -- Impede duplicatas e auto-referência
  CONSTRAINT no_self_dependency CHECK (task_id <> depends_on_id),
  UNIQUE(task_id, depends_on_id, type)
);

-- RLS
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_dependencies_authenticated"
  ON task_dependencies FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Índices para performance
CREATE INDEX idx_task_dependencies_task_id       ON task_dependencies(task_id);
CREATE INDEX idx_task_dependencies_depends_on_id ON task_dependencies(depends_on_id);

-- ============================================================
-- EXECUTAR NO SUPABASE E CONFIRMAR: SELECT * FROM task_dependencies LIMIT 1;
-- ============================================================

-- ============================================
-- VP CLICK - MIGRATION 07: COMENTÁRIOS (edit/delete) + FAVORITOS + WATCHERS
-- Execute no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/sfpnjwllcmentoocylow/sql/new
-- ============================================

-- task_comments: suporte a edição e exclusão
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Favoritos sincronizados por usuário (substitui localStorage)
CREATE TABLE IF NOT EXISTS user_favorites (
  user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type     TEXT NOT NULL CHECK (type IN ('list', 'folder', 'space')),
  item_id  UUID NOT NULL,
  item_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, type, item_id)
);

-- Watchers (observadores de tarefas)
CREATE TABLE IF NOT EXISTS task_watchers (
  task_id  UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (task_id, user_id)
);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_watchers  ENABLE ROW LEVEL SECURITY;

-- Favoritos: cada usuário gerencia os próprios
DO $$ BEGIN
  CREATE POLICY "user_favorites_select" ON user_favorites FOR SELECT TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "user_favorites_insert" ON user_favorites FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "user_favorites_delete" ON user_favorites FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Watchers: todos veem; cada um gerencia a própria inscrição
DO $$ BEGIN
  CREATE POLICY "task_watchers_select" ON task_watchers FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "task_watchers_insert" ON task_watchers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "task_watchers_delete" ON task_watchers FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

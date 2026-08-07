-- ============================================================
-- VP CLICK — Baseline retroativo para o histórico de migrations
-- rastreado pelo Supabase (supabase_migrations.schema_migrations).
--
-- Diagnóstico: o schema inicial (profiles, tasks, docs, lists, etc.) foi
-- aplicado direto no SQL Editor (arquivo supabase_migrations.sql) e nunca
-- ficou registrado no histórico de migrations do Supabase. Toda a cadeia de
-- migrations tracked (create_auth_pins_table, add_created_by_to_docs, ...)
-- assume esse schema já existente. Isso faz a feature de Preview Branch
-- (replay do zero) falhar sempre no mesmo ponto:
--   ERROR: relation "docs" does not exist
--   ALTER TABLE docs ADD COLUMN created_by UUID REFERENCES profiles(id)
--
-- Esta migration recria, de forma IDEMPOTENTE (IF NOT EXISTS / duplicate_object),
-- o schema base que faltava no histórico — para já existir em produção, ela é
-- um no-op; para uma branch de preview nova, ela cria a base antes que as
-- migrations tracked rodem por cima. É inserida com uma versão anterior à mais
-- antiga já registrada (20260224120437), então roda primeiro no replay.
--
-- Fora do escopo (não causa erro, apenas fidelidade menor no preview):
-- RLS/policies de task_status_groups/task_status_options (tabelas só existem
-- depois, criadas pela migration tracked "create_status_tables").
--
-- Registro: aplicada em produção (sfpnjwllcmentoocylow) via execute_sql — no-op,
-- pois todo o schema já existia — e inserida em
-- supabase_migrations.schema_migrations com version = '20260101000000'
-- (anterior à mais antiga migration tracked, 20260224120437) para que o
-- replay do Preview Branch a execute primeiro. Este arquivo é só o registro
-- no repositório, seguindo a convenção dos demais supabase_migration_*.sql.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Schema base (== supabase_migrations.sql) ──────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar TEXT DEFAULT 'https://picsum.photos/seed/user/100',
  role TEXT NOT NULL DEFAULT 'COLABORADOR' CHECK (role IN ('ADMIN', 'GESTOR', 'COLABORADOR')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spaces (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  color TEXT DEFAULT '#3b82f6',
  icon TEXT DEFAULT 'Layout',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_system BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS folders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_private_link_enabled BOOLEAN DEFAULT FALSE,
  default_permission TEXT DEFAULT 'Edição total'
);

CREATE TABLE IF NOT EXISTS lists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  hidden_fields JSONB DEFAULT '[]'::jsonb,
  hidden_standard_fields JSONB DEFAULT '[]'::jsonb,
  is_private_link_enabled BOOLEAN DEFAULT FALSE,
  default_permission TEXT DEFAULT 'Edição total'
  -- status_group_id é adicionado pela migration tracked "create_status_tables"
  -- (a tabela task_status_groups só existe a partir dali).
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT,
  manager_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'A fazer',
  priority TEXT DEFAULT 'Media',
  main_assignee_id UUID REFERENCES profiles(id),
  secondary_assignee_ids UUID[] DEFAULT '{}',
  start_date DATE,
  due_date DATE,
  extension_count INTEGER DEFAULT 0,
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  parent_id UUID REFERENCES tasks(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  order_index INTEGER DEFAULT 0
  -- created_by e hidden_fields são adicionados pelas migrations tracked
  -- "add_created_by_to_tasks" (sem IF NOT EXISTS — não pode já existir aqui)
  -- e "add_hidden_fields_to_tasks".
);

CREATE TABLE IF NOT EXISTS task_checklists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- updated_at/deleted_at vêm da seção "Comentários" mais abaixo.
);

CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT,
  size INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_extension_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  old_date DATE,
  new_date DATE,
  reason TEXT,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  is_mandatory BOOLEAN DEFAULT FALSE,
  default_value JSONB,
  config JSONB,
  target TEXT DEFAULT 'TASK',
  visible_to TEXT[] DEFAULT ARRAY['ADMIN','GESTOR','COLABORADOR'],
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  field_id UUID REFERENCES custom_fields(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  value JSONB,
  UNIQUE(field_id, entity_id)
);

CREATE TABLE IF NOT EXISTS user_access (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  space_ids UUID[] DEFAULT '{}',
  folder_ids UUID[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS docs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT DEFAULT 'Comece a escrever aqui...',
  header_image TEXT,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- created_by (sem IF NOT EXISTS na migration tracked), parent_id e is_wiki
  -- são adicionados pelas migrations tracked correspondentes.
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_extension_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "auth_profiles_select" ON profiles FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "auth_profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "auth_profiles_update" ON profiles FOR UPDATE TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "auth_workspaces" ON workspaces FOR ALL TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "auth_spaces" ON spaces FOR ALL TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "auth_folders" ON folders FOR ALL TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "auth_lists" ON lists FOR ALL TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "auth_tasks" ON tasks FOR ALL TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "auth_task_checklists" ON task_checklists FOR ALL TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "auth_task_comments" ON task_comments FOR ALL TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "auth_task_attachments" ON task_attachments FOR ALL TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "auth_task_extension_logs" ON task_extension_logs FOR ALL TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "auth_custom_fields" ON custom_fields FOR ALL TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "auth_custom_field_values" ON custom_field_values FOR ALL TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "auth_user_access" ON user_access FOR ALL TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "auth_docs" ON docs FOR ALL TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "auth_projects" ON projects FOR ALL TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(new.raw_user_meta_data->>'avatar', 'https://picsum.photos/seed/' || new.id::text || '/100'),
    COALESCE(new.raw_user_meta_data->>'role', 'COLABORADOR')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

INSERT INTO workspaces (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'VERTICALPARTS')
ON CONFLICT (id) DO NOTHING;

-- ── automations (schema ORIGINAL, pré-rename — a migration tracked
-- "migration_04_automations" faz RENAME COLUMN is_active→enabled e
-- trigger_params→trigger_config, então precisa encontrar esses nomes) ──
CREATE TABLE IF NOT EXISTS automations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  list_id UUID REFERENCES lists(id),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'status_changed','priority_changed','assignee_changed',
    'due_date_arrives','task_created','task_moved','custom_field_changed'
  )),
  trigger_params JSONB,
  conditions JSONB DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "auth_automations" ON automations FOR ALL TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Migration 02: dependências entre tarefas ──────────────────
CREATE TABLE IF NOT EXISTS task_dependencies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('blocks', 'blocked_by', 'relates_to')),
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT no_self_dependency CHECK (task_id <> depends_on_id),
  UNIQUE(task_id, depends_on_id, type)
);
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "task_dependencies_authenticated" ON task_dependencies FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id       ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on_id ON task_dependencies(depends_on_id);

-- ── Migration 03: tags em tarefas ──────────────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN (tags);

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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspace_tags' AND policyname = 'workspace_tags_authenticated') THEN
    CREATE POLICY "workspace_tags_authenticated" ON workspace_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_workspace_tags_workspace ON workspace_tags(workspace_id);

-- ── Migration 05 (só o schema — sem os dados de seed, específicos
-- desta instância de produção) ────────────────────────────────
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS vpclick_integration_links (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_project   TEXT        NOT NULL,
  source_table     TEXT        NOT NULL,
  source_record_id TEXT        NOT NULL,
  vpclick_task_id  UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  vpclick_list_id  TEXT        NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_project, source_table, source_record_id)
);
ALTER TABLE vpclick_integration_links ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vpclick_integration_links' AND policyname = 'integration_links_auth') THEN
    CREATE POLICY "integration_links_auth" ON vpclick_integration_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vpclick_integration_links' AND policyname = 'integration_links_service') THEN
    CREATE POLICY "integration_links_service" ON vpclick_integration_links FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_integration_links_source ON vpclick_integration_links(source_project, source_table, source_record_id);
CREATE INDEX IF NOT EXISTS idx_integration_links_task ON vpclick_integration_links(vpclick_task_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS integration_links_updated_at ON vpclick_integration_links;
CREATE TRIGGER integration_links_updated_at
  BEFORE UPDATE ON vpclick_integration_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Migration 06: equipes + notificações (sem a parte de
-- task_status_groups/options — essas tabelas só existem depois) ──
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#8b5cf6',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id),
  type TEXT NOT NULL DEFAULT 'mention'
    CHECK (type IN ('mention', 'team_mention', 'assignment', 'comment', 'automation')),
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES task_comments(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, read, created_at DESC);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "teams_select" ON teams FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "teams_write" ON teams FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('ADMIN','GESTOR')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('ADMIN','GESTOR')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "team_members_select" ON team_members FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "team_members_write" ON team_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('ADMIN','GESTOR')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('ADMIN','GESTOR')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "notifications_delete" ON notifications FOR DELETE TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Migration 07: comentários (edição/exclusão) + favoritos + watchers ──
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type     TEXT NOT NULL CHECK (type IN ('list', 'folder', 'space')),
  item_id  UUID NOT NULL,
  item_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, type, item_id)
);

CREATE TABLE IF NOT EXISTS task_watchers (
  task_id  UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (task_id, user_id)
);

ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_watchers  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "user_favorites_select" ON user_favorites FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "user_favorites_insert" ON user_favorites FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "user_favorites_delete" ON user_favorites FOR DELETE TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "task_watchers_select" ON task_watchers FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "task_watchers_insert" ON task_watchers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "task_watchers_delete" ON task_watchers FOR DELETE TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Migration 09: buckets de storage + políticas (versão final) ──
DROP POLICY IF EXISTS "vpclick_storage_read" ON storage.objects;
DROP POLICY IF EXISTS "vpclick_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "vpclick_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "vpclick_storage_delete" ON storage.objects;

CREATE POLICY "vpclick_storage_read" ON storage.objects
  FOR SELECT
  USING (bucket_id IN ('task-files', 'doc-files', 'avatars'));

CREATE POLICY "vpclick_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('task-files', 'doc-files', 'avatars'));

CREATE POLICY "vpclick_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('task-files', 'doc-files', 'avatars'))
  WITH CHECK (bucket_id IN ('task-files', 'doc-files', 'avatars'));

CREATE POLICY "vpclick_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('task-files', 'doc-files', 'avatars'));

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('task-files', 'task-files', true),
  ('doc-files',  'doc-files',  true),
  ('avatars',    'avatars',    true)
ON CONFLICT (id) DO UPDATE SET public = true;

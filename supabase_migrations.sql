-- ============================================
-- VP CLICK - SQL MIGRATIONS
-- Execute no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/sfpnjwllcmentoocylow/sql/new
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de perfis (vinculada ao auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar TEXT DEFAULT 'https://picsum.photos/seed/user/100',
  role TEXT NOT NULL DEFAULT 'COLABORADOR' CHECK (role IN ('ADMIN', 'GESTOR', 'COLABORADOR')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spaces
CREATE TABLE IF NOT EXISTS spaces (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  color TEXT DEFAULT '#3b82f6',
  icon TEXT DEFAULT 'Layout',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Folders
CREATE TABLE IF NOT EXISTS folders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lists
CREATE TABLE IF NOT EXISTS lists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT,
  manager_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checklists de tarefas
CREATE TABLE IF NOT EXISTS task_checklists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comentários de tarefas
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anexos de tarefas
CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT,
  size INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log de extensões de prazo
CREATE TABLE IF NOT EXISTS task_extension_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  old_date DATE,
  new_date DATE,
  reason TEXT,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campos customizados
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

-- Valores de campos customizados
CREATE TABLE IF NOT EXISTS custom_field_values (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  field_id UUID REFERENCES custom_fields(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  value JSONB,
  UNIQUE(field_id, entity_id)
);

-- Controle de acesso de usuário
CREATE TABLE IF NOT EXISTS user_access (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  space_ids UUID[] DEFAULT '{}',
  folder_ids UUID[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documentos
CREATE TABLE IF NOT EXISTS docs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT DEFAULT 'Comece a escrever aqui...',
  header_image TEXT,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Habilitar Row Level Security
-- ============================================
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

-- ============================================
-- Políticas RLS (usuários autenticados têm acesso)
-- ============================================
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

-- ============================================
-- Trigger: cria perfil automaticamente ao criar usuário no Auth
-- ============================================
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

-- ============================================
-- Workspace padrão VerticalParts
-- ============================================
INSERT INTO workspaces (id, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'VERTICALPARTS')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Definir o usuário geovane.silva como ADMIN
-- (Executar DEPOIS de criar o usuário no Auth)
-- ============================================
UPDATE profiles 
SET name = 'Geovane Silva', role = 'ADMIN'
WHERE email = 'geovane.silva@verticalparts.com.br';

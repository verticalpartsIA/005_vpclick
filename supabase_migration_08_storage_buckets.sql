-- ============================================
-- VP CLICK - MIGRATION 08: BUCKETS DE STORAGE + POLÍTICAS
-- Corrige: usuários não conseguem anexar arquivos nas tarefas
-- Execute no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/sfpnjwllcmentoocylow/sql/new
-- ============================================

-- Buckets usados pelo app (públicos para leitura via getPublicUrl):
--   task-files → anexos de tarefas (aba Anexos + clipe do comentário)
--   doc-files  → documentos e uploads gerais
--   avatars    → fotos de perfil (Painel do Administrador)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('task-files', 'task-files', true),
  ('doc-files',  'doc-files',  true),
  ('avatars',    'avatars',    true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================
-- Políticas em storage.objects
-- Leitura: pública (os buckets são públicos e as URLs são publicUrl)
-- Escrita (insert/update/delete): qualquer usuário autenticado
-- ============================================

DO $$ BEGIN
  CREATE POLICY "vpclick_storage_read" ON storage.objects
    FOR SELECT
    USING (bucket_id IN ('task-files', 'doc-files', 'avatars'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "vpclick_storage_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id IN ('task-files', 'doc-files', 'avatars'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- upsert: true no upload exige UPDATE além de INSERT
DO $$ BEGIN
  CREATE POLICY "vpclick_storage_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id IN ('task-files', 'doc-files', 'avatars'))
    WITH CHECK (bucket_id IN ('task-files', 'doc-files', 'avatars'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "vpclick_storage_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id IN ('task-files', 'doc-files', 'avatars'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- Verificação (rode após executar):
--   SELECT id, public FROM storage.buckets
--   WHERE id IN ('task-files','doc-files','avatars');
-- Deve retornar 3 linhas com public = true.
-- ============================================

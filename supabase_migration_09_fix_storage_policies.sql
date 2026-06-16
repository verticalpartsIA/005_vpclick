-- ============================================
-- VP CLICK - MIGRATION 09: CORRIGE POLÍTICAS DE STORAGE
-- Recria as políticas de storage para garantir acesso a todos os usuários autenticados
-- Execute no SQL Editor do Supabase quando algum usuário não consegue anexar arquivos.
-- ============================================

-- Remove políticas existentes para recriar sem conflito
DROP POLICY IF EXISTS "vpclick_storage_read" ON storage.objects;
DROP POLICY IF EXISTS "vpclick_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "vpclick_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "vpclick_storage_delete" ON storage.objects;

-- Recria políticas limpas
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

-- Garante que os buckets existem e são públicos
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('task-files', 'task-files', true),
  ('doc-files',  'doc-files',  true),
  ('avatars',    'avatars',    true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Verificação: SELECT id, public FROM storage.buckets WHERE id IN ('task-files','doc-files','avatars');
-- Deve retornar 3 linhas com public = true.

-- ============================================
-- VP CLICK - MIGRATION 18: LISTA PESSOAL (item 8 da sidebar "Início", estilo ClickUp)
-- Já aplicada no projeto Supabase VP CLICK via MCP. Este arquivo documenta a
-- alteração; execute no SQL Editor apenas se precisar reaplicar em outro ambiente:
-- https://supabase.com/dashboard/project/sfpnjwllcmentoocylow/sql/new
-- ============================================

-- Lista pessoal: uma lista que vive fora da hierarquia normal (sem pasta),
-- privada de cada usuário. Privacidade só no client (decisão com o usuário):
-- a lista não aparece na árvore de Espaços/Pastas de ninguém além do dono, e
-- só é alcançável pelo item "Lista pessoal" de cada um, que busca a lista
-- pelo próprio user_id — mesmo nível de segurança (RLS permissiva) já usado
-- no resto do app.
ALTER TABLE lists ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lists_owner_id_unique ON lists(owner_id) WHERE owner_id IS NOT NULL;

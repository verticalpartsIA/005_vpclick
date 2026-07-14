-- ============================================
-- VP CLICK - MIGRATION 12: WIKI EM DOCS (páginas aninhadas + marcação de wiki)
-- Já aplicada em produção via MCP do Supabase (nome: add_is_wiki_to_docs).
-- Este arquivo é só o registro no repositório, para consistência com as
-- demais migrations numeradas.
-- ============================================

-- `docs.parent_id` já existia (migration "add_parent_id_to_docs", 2026-03-19),
-- mas nunca era lido/escrito pelo frontend — os Docs eram sempre uma lista
-- plana dentro da pasta. Isso passou a ser usado para permitir subpáginas
-- (um Doc "raiz" com várias subpáginas aninhadas, ao estilo Wiki do ClickUp).

-- Nova coluna: marca um Doc como "wiki" (fonte oficial/destacada), distinto
-- de um documento comum.
alter table public.docs add column if not exists is_wiki boolean not null default false;

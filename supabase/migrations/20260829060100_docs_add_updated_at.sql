-- Pré-requisito para incluir Documentos (wiki) na Fase 1 do RAG (.rag/rag.md,
-- Seção 26 lista "indexação de documentos e tarefas" já na Fase 1).
--
-- `docs` não tinha nenhuma marca de última atualização — só `created_at`. Sem
-- isso, o pipeline de indexação não tem como saber que um documento mudou e
-- precisa ser reindexado (a estratégia de checksum/versão da Seção 35.3-35.4
-- do documento pressupõe um `source_updated_at` por fonte). Aditivo, não
-- afeta nenhuma leitura/escrita existente de `docs`.
--
-- O app (handleUpdateDoc, App.tsx) passa a enviar `updated_at` a cada edição.
alter table public.docs
  add column if not exists updated_at timestamptz not null default now();

comment on column public.docs.updated_at is
  'Pré-requisito para indexação RAG (Fase 1, .rag/rag.md secao 34.2): sem essa marca, o pipeline de indexacao nao tem como detectar que um documento mudou e precisa ser reindexado. Atualizada pelo app a cada edicao (handleUpdateDoc, App.tsx).';

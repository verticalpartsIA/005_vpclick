-- Corrige achado de review (PR #175, Codex): confiar no client (App.tsx)
-- para escrever `docs.updated_at` a cada edição é frágil — qualquer outro
-- caminho de escrita (PostgREST direto, script administrativo, uma futura
-- Edge Function) não passa por handleUpdateDoc e deixaria `updated_at`
-- parado enquanto o conteúdo muda; o valor também fica sujeito a
-- desvio de relógio do navegador. O indexador RAG (Fase 1) depende dessa
-- marca para saber que precisa reindexar.
--
-- `update_updated_at_column()` já existe e já é usada por `automations` e
-- `vpclick_integration_links` (mesmo padrão, não inventamos nada novo) —
-- só reaproveitamos aqui para `docs`.
create trigger docs_updated_at
  before update on public.docs
  for each row
  execute function public.update_updated_at_column();

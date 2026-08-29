-- Habilita a extensão pgvector — pré-requisito de infraestrutura para a Fase 1
-- do RAG do VPClick (ver .rag/rag.md, Seção 8: "PostgreSQL com pgvector" é a
-- opção arquitetural preferencial, já que o projeto já roda em Supabase).
--
-- Só cria o tipo `vector` e os métodos de índice ivfflat/hnsw disponíveis no
-- Postgres — não cria nenhuma tabela nem afeta nada existente. Reversível com
-- `drop extension vector` (só falha se alguma coluna/índice já a referenciar).
create extension if not exists vector;

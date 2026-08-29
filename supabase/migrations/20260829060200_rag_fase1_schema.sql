-- RAG do VPClick — Fase 1: Fundação segura (.rag/rag.md, Seção 26).
--
-- Cria só o esqueleto de indexação (rag_documents/rag_chunks) + a função de
-- ACL que os protege. NÃO cria nenhum indexador, chunker ou embedding de
-- verdade ainda — isso é passo seguinte, depois de decidir o provedor/modelo
-- de embedding (Seção 7.1 do documento pede explicitamente para não fixar
-- isso sem avaliação; não decidimos sozinhos).
--
-- Decisões tomadas aqui, e por quê (auditadas contra o schema e a RLS reais
-- deste projeto, não contra o DDL ilustrativo do documento):
--
-- 1. SEM coluna `workspace_id`: o schema real não tem essa coluna em
--    `tasks`/`lists`/`folders` (só em `spaces`), e a tabela `workspaces` tem
--    zero linhas — é andaime de multi-tenant nunca populado. Inventar um
--    `workspace_id` aqui violaria a regra "não inventar tabelas, rotas, APIs,
--    permissões ou entidades" (item 6 das instruções originais). A
--    autorização real já vem por inteiro de `rag_can_access_source`.
--
-- 2. ACL via `rag_can_access_source(source_type, source_id)`, que despacha
--    para as funções de RLS JÁ EXISTENTES e validadas (`can_access_task`,
--    `can_access_folder`) — não duplica nem reinventa autorização (Seção 37,
--    item 2 do documento: "reutilizar ... funções canônicas equivalentes").
--
-- 3. Identidade determinística (UUID v5, Seção 35.2) e o próprio chunking são
--    responsabilidade do indexador (código), não desta migration — por isso
--    `id` aqui é `uuid primary key` sem `default`, preenchido pelo worker.
--
-- 4. Estratégia de versão: "documento lógico estável" (Seção 35.3, opção 1) —
--    `unique (source_type, source_id)` en rag_documents, sem versão na chave;
--    um upsert atualiza o registro atual. Histórico/auditoria fica para uma
--    tabela separada quando isso for necessário (não faz parte da Fase 1).
--
-- 5. Coluna `embedding` fica SEM dimensão fixada (`vector`, não `vector(n)`)
--    até decidirmos modelo/dimensão de embedding — index HNSW/ivfflat exige
--    dimensão fixa e será criado numa migration futura, depois dessa escolha
--    (Seção 7.1: "não fixar neste documento um fornecedor como regra eterna").
--
-- 6. Só leitura é liberada para `authenticated`, e só via a ACL acima. Nenhuma
--    policy de escrita para `authenticated` — apenas o worker de indexação,
--    rodando como `service_role` (que ignora RLS por padrão), pode escrever.
--    (Seção 37, item 8: "impedir escrita pelo usuário final".)

create or replace function public.rag_can_access_source(p_source_type text, p_source_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_source_type
    when 'task' then public.can_access_task(p_source_id)
    when 'doc' then exists (
      select 1 from public.docs d
      where d.id = p_source_id
        and (public.can_access_folder(d.folder_id) or d.created_by = (select auth.uid()))
    )
    else false
  end;
$$;

revoke execute on function public.rag_can_access_source(text, uuid) from public;
revoke execute on function public.rag_can_access_source(text, uuid) from anon;
grant execute on function public.rag_can_access_source(text, uuid) to authenticated;

create table if not exists public.rag_documents (
  id uuid primary key,
  source_type text not null check (source_type in ('task', 'doc')),
  source_id uuid not null,
  source_version text not null,
  title text,
  canonical_url text not null,
  content_checksum text not null,
  source_updated_at timestamptz,
  indexed_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (source_type, source_id)
);

comment on table public.rag_documents is
  'RAG Fase 1 (.rag/rag.md): um registro por fonte indexavel atual (tarefa ou documento). Escrito só pelo worker de indexação (service_role) — nunca pelo cliente.';

create index if not exists rag_documents_source_idx
  on public.rag_documents (source_type, source_id);

create index if not exists rag_documents_active_idx
  on public.rag_documents (source_type)
  where deleted_at is null;

alter table public.rag_documents enable row level security;

create policy rag_documents_select on public.rag_documents
  for select to authenticated
  using (deleted_at is null and public.rag_can_access_source(source_type, source_id));

revoke all on public.rag_documents from public, anon;
grant select on public.rag_documents to authenticated;

create table if not exists public.rag_chunks (
  id uuid primary key,
  document_id uuid not null references public.rag_documents(id) on delete cascade,
  chunk_index integer not null,
  chunk_kind text not null,
  heading_path text[],
  content text not null,
  token_count integer,
  metadata jsonb not null default '{}'::jsonb,
  embedding_model text not null,
  embedding_dimensions integer not null,
  embedding vector,
  content_checksum text not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index, embedding_model)
);

comment on table public.rag_chunks is
  'RAG Fase 1 (.rag/rag.md): chunks filhos de rag_documents. Leitura só via ACL do documento-pai (Seção 37, item 7) — nunca direto. `embedding` fica sem dimensão fixada até a escolha do modelo (ver comentário no topo da migration); o índice HNSW/ivfflat vem numa migration futura.';

create index if not exists rag_chunks_document_idx
  on public.rag_chunks (document_id);

alter table public.rag_chunks enable row level security;

create policy rag_chunks_select on public.rag_chunks
  for select to authenticated
  using (
    exists (
      select 1 from public.rag_documents doc
      where doc.id = rag_chunks.document_id
        and doc.deleted_at is null
        and public.rag_can_access_source(doc.source_type, doc.source_id)
    )
  );

revoke all on public.rag_chunks from public, anon;
grant select on public.rag_chunks to authenticated;

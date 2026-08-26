-- Índices de apoio para leituras protegidas por RLS e carregamento sob demanda.
-- Não muda regra de permissão: só dá caminhos mais curtos para o Postgres
-- responder às mesmas consultas.

-- A busca sob demanda de campos personalizados filtra por entity_id (id da
-- tarefa). O UNIQUE(field_id, entity_id) existente não cobre bem esse caminho,
-- porque entity_id é a segunda coluna do índice.
create index if not exists idx_custom_field_values_entity_id
  on public.custom_field_values(entity_id);

-- Detalhe de tarefa e policies de sub-entidades consultam tudo por task_id.
-- Esses índices evitam varreduras quando uma tarefa é aberta ou quando a RLS
-- precisa validar linhas relacionadas.
create index if not exists idx_task_comments_task_id
  on public.task_comments(task_id);

create index if not exists idx_task_checklists_task_id
  on public.task_checklists(task_id);

create index if not exists idx_task_attachments_task_id
  on public.task_attachments(task_id);

create index if not exists idx_task_activities_task_id
  on public.task_activities(task_id);

create index if not exists idx_task_extension_logs_task_id
  on public.task_extension_logs(task_id);

-- A PK de task_watchers já cobre (task_id, user_id). Este índice cobre telas ou
-- consultas que partem do usuário para achar tarefas observadas.
create index if not exists idx_task_watchers_user_id_task_id
  on public.task_watchers(user_id, task_id);

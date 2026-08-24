-- A tela "Minhas Tarefas" consulta responsável principal, adicionais e criador.
-- Já existem índices btree para main_assignee_id e created_by; faltava o GIN
-- para o array secondary_assignee_ids, que deixava parte da consulta varrer
-- mais linhas antes de a tela preencher.
create index if not exists idx_tasks_secondary_assignee_ids
  on public.tasks using gin (secondary_assignee_ids);

create index if not exists idx_tasks_due_date
  on public.tasks (due_date);

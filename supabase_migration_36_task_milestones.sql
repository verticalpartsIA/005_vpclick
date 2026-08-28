-- Migration 36 — Marcos (milestones) no Gantt (Codex_Gantt_08)
--
-- Não havia campo nenhum no modelo pra distinguir uma tarefa comum de um
-- marco (entrega/decisão/data-chave sem duração). Em vez de criar uma
-- arquitetura paralela (tabela "milestones" separada), a issue pede
-- explicitamente reaproveitar o modelo de tarefa existente — um marco
-- continua sendo uma linha de `tasks`, só com um booleano a mais. Isso
-- mantém dependências, RLS, realtime e busca funcionando de graça (um
-- marco pode ser predecessor/sucessor de qualquer outra tarefa via
-- `task_dependencies`, sem precisar de nenhuma mudança nessa tabela).
--
-- A data do marco é a `due_date` já existente (um marco não tem intervalo
-- início-fim, só um ponto no tempo) — sem coluna de data nova.
--
-- IMPORTANTE: aplicar esta migration ANTES de publicar o deploy do código
-- que lê `is_milestone` (App.tsx/taskRepo.ts) — o SELECT explícito de
-- colunas (TASK_ROW_SELECT) falha com "column does not exist" se a coluna
-- ainda não existir no banco.

alter table public.tasks
  add column if not exists is_milestone boolean not null default false;

comment on column public.tasks.is_milestone is
  'Marca a tarefa como um marco (Codex_Gantt_08): renderizado como marcador pontual (usa due_date), não como barra com intervalo. Sem efeito em RLS/dependências — continua sendo uma tarefa normal para todo o resto do sistema.';

-- Migration 37 — Movimentação em lote de tarefas (Codex_Gantt_10)
--
-- A issue pede explicitamente uma operação batch/transacional em vez de um
-- loop de N updates sequenciais no cliente. Uma única instrução SQL já é
-- atômica (tudo ou nada por natureza de uma única `UPDATE`), então isso vira
-- uma função simples em vez de precisar de BEGIN/COMMIT explícito.
--
-- SECURITY INVOKER (padrão, não declarado) mantém a RLS de `tasks` valendo
-- linha a linha: uma tarefa que o usuário autenticado não pode editar
-- simplesmente não aparece no `RETURNING` (não gera erro nem exceção) — é
-- assim que o cliente detecta sucesso parcial (compara os ids pedidos com os
-- devolvidos), sem burlar a RLS e sem precisar de uma segunda consulta.
--
-- Só desloca (`+ N dias`), preservando a duração de cada tarefa automatica-
-- mente — não precisa reescrever `due_date - start_date` porque os dois lados
-- recebem o mesmo delta.
--
-- Fallback: se esta função ainda não existir no banco (deploy do código na
-- frente da migration), o cliente cai para updates sequenciais (mesmo padrão
-- de fallback já usado por `get_task_counts_by_list`/`search_tasks`) — mais
-- lento, mas não quebra a funcionalidade.

create or replace function public.shift_task_dates(p_task_ids uuid[], p_delta_days integer)
returns table(id uuid)
language sql
as $$
  update public.tasks
  set
    start_date = start_date + p_delta_days,
    due_date = due_date + p_delta_days
  where tasks.id = any(p_task_ids)
  returning tasks.id;
$$;

grant execute on function public.shift_task_dates(uuid[], integer) to authenticated;

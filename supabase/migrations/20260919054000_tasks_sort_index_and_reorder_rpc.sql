-- Issue #138: a Tabela (GripVertical) e o Kanban não têm nenhum campo de
-- domínio pra "ordem manual" da tarefa — a issue pede reutilizar "o
-- mecanismo já existente", mas não existe nenhum (confirmado: nem tasks nem
-- nenhuma outra tabela têm position/order_index; o que existia era só
-- localStorage por navegador, que não sincroniza entre dispositivos/
-- usuários). Este é o campo canônico — a Tabela passa a escrever nele agora;
-- outras views (Kanban etc.) podem adotar o mesmo campo depois, sem
-- precisar de um segundo mecanismo.
ALTER TABLE public.tasks ADD COLUMN sort_index integer;

CREATE INDEX idx_tasks_sort_index ON public.tasks (list_id, sort_index) WHERE sort_index IS NOT NULL;

-- Mesmo padrão de shift_task_dates (issue do Gantt): RETURNING só os ids
-- realmente atualizados deixa o client detectar sucesso parcial (RLS barrou
-- alguma linha) sem precisar de uma segunda consulta. SECURITY INVOKER
-- (padrão) + search_path fixo: cada linha só é tocada se a RLS de UPDATE de
-- tasks (tasks_upd) permitir pro usuário chamador.
CREATE OR REPLACE FUNCTION public.reorder_tasks_in_list(p_list_id uuid, p_ordered_ids uuid[])
RETURNS TABLE(id uuid)
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.tasks t
  SET sort_index = o.ordinality
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS o(task_id, ordinality)
  WHERE t.id = o.task_id AND t.list_id = p_list_id
  RETURNING t.id;
$$;

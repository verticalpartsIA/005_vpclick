-- Permite excluir uma tarefa que possui subtarefas.
--
-- A FK original de tasks.parent_id usa o comportamento padrão NO ACTION.
-- Por isso o PostgreSQL recusava a exclusão da tarefa-pai com o erro 23503,
-- mesmo quando o usuário tinha permissão de DELETE pela RLS.
--
-- Subtarefas pertencem à tarefa-pai e já são apresentadas dessa forma na UI;
-- ao excluir permanentemente a tarefa-pai, removemos também toda a árvore de
-- subtarefas. As demais entidades ligadas às tarefas já usam ON DELETE CASCADE.

alter table public.tasks
  drop constraint if exists tasks_parent_id_fkey;

alter table public.tasks
  add constraint tasks_parent_id_fkey
  foreign key (parent_id)
  references public.tasks(id)
  on delete cascade;

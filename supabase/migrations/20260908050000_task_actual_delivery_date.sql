-- Campo de sistema "Entrega Real" (actual_delivery_date): carimbado
-- automaticamente quando o status da tarefa transiciona PARA um status "tipo
-- concluído" (mesma lista de palavras-chave do isDoneLikeStatus em
-- src/lib/taskService.ts), continuando editável à mão depois (o trigger só
-- atua na transição, não em updates subsequentes que deixam o status como
-- já estava). Antes disso só existia um Campo Personalizado manual chamado
-- "Data de conclusão" que ninguém lembrava de preencher — ver conversa no
-- app sobre a tarefa VPCLICK em 2026-09-08.
alter table public.tasks
  add column if not exists actual_delivery_date date;

create or replace function public.tasks_set_actual_delivery_date()
returns trigger
language plpgsql
as $$
begin
  if (new.status ~* 'conclu|done|closed|complete|finaliz|pronto|aprovado')
     and not (coalesce(old.status, '') ~* 'conclu|done|closed|complete|finaliz|pronto|aprovado') then
    new.actual_delivery_date := current_date;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_set_actual_delivery_date on public.tasks;
create trigger trg_tasks_set_actual_delivery_date
  before update on public.tasks
  for each row
  execute function public.tasks_set_actual_delivery_date();

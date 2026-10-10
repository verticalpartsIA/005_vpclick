-- Fase 4 da migração do motor de avisos WhatsApp pra evento (fase 1: base;
-- fase 2: observador adicionado; fase 3: menção). Liga o terceiro tipo de
-- evento: conclusão (ou cancelamento) de tarefa.

-- Decisão de desenho: diferente do motor antigo (cron, fora deste repo, que
-- lia task_activities.type='STATUS_CHANGE' e cruzava o rótulo do novo valor
-- com task_status_options pra descobrir se virou "concluído"), aqui o
-- gatilho fica direto em tasks (AFTER UPDATE), comparando o tipo canônico
-- (DONE/CANCELLED/ACTIVE/START, de task_status_options.type) do status ANTES
-- e DEPOIS da mudança — dispara só na transição PRA DONE/CANCELLED (não
-- dispara de novo se a tarefa só troca de um rótulo "concluído" pra outro,
-- ex. "Concluído" -> "Finalizado", nem se already estava concluída).
--
-- Por quê direto em tasks e não em task_activities: o rótulo de "concluído"
-- varia por lista (cada lista tem seu próprio status_group_id em
-- public.lists, com rótulos próprios em task_status_options) — resolvendo
-- old/new pelo group_id da lista da própria tarefa, o cruzamento fica
-- inequívoco mesmo com rótulos repetidos entre listas diferentes (7 rótulos
-- aparecem em mais de um group_id na base atual). Além disso
-- task_activities.type tem duas grafias conflitantes em produção
-- (STATUS_CHANGE e status_changed) — ficar em tasks evita depender de
-- qual das duas o código atual usa.
--
-- Destinatário: quem criou a tarefa (tasks.created_by) — decisão de escopo
-- pra esta fase, não o(s) responsável(is) (main_assignee_id/
-- secondary_assignee_ids). Quem pediu a tarefa é quem mais precisa saber
-- que ela foi concluída/cancelada; quem concluiu (auth.uid() no momento do
-- update) já sabe. Sem aviso se created_by for nulo ou for a própria
-- pessoa que concluiu (ninguém precisa de aviso de si mesmo).
--
-- Limitação assumida (documentada, não silenciosa): dedupe usa tasks.id
-- como chave (via notification_dispatch_log), então reabrir e concluir de
-- novo a MESMA tarefa não gera um segundo aviso. Preferimos essa perda a
-- arriscar duplicar aviso — e o caso comum de "tarefa recorrente concluída
-- de novo" já gera uma linha nova em tasks (recurrence_parent_task_id), não
-- reabre a mesma.
create or replace function public.notify_task_completed_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  list_status_group uuid;
  new_type text;
  old_type text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.deleted_at is not null then
    return new;
  end if;

  select status_group_id into list_status_group from public.lists where id = new.list_id;
  if list_status_group is null then
    return new;
  end if;

  select type into new_type from public.task_status_options
    where group_id = list_status_group and label = new.status
    limit 1;
  select type into old_type from public.task_status_options
    where group_id = list_status_group and label = old.status
    limit 1;

  if new_type not in ('DONE', 'CANCELLED') or coalesce(old_type, '') in ('DONE', 'CANCELLED') then
    return new;
  end if;

  perform net.http_post(
    url := 'https://sfpnjwllcmentoocylow.supabase.co/functions/v1/whatsapp-notify-event',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-whatsapp-notify-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'whatsapp_notify_event_secret')
    ),
    body := jsonb_build_object(
      'event_type', 'task_completed',
      'source_table', 'tasks',
      'source_id', new.id::text,
      'task_id', new.id,
      'actor_id', auth.uid(),
      'status_type', new_type
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_task_completed on public.tasks;
create trigger trg_notify_task_completed
  after update on public.tasks
  for each row execute function public.notify_task_completed_trigger();

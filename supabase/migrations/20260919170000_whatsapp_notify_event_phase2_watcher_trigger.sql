-- Fase 2 da migração do motor de avisos WhatsApp pra evento (fase 1:
-- 20260919160000_whatsapp_notify_event_phase1_schema.sql). Liga o primeiro
-- tipo de evento — observador adicionado — o de menor volume/risco entre
-- os três candidatos (menção, conclusão, observador), escolhido de
-- propósito pra validar o desenho inteiro (trigger -> pg_net -> Edge
-- Function -> dedupe -> log) antes de mexer nos outros dois.

-- Achado ao desenhar esta fase: `source_id uuid` (fase 1) não serve pra
-- task_watchers, que não tem coluna id própria — a chave natural é o par
-- (task_id, user_id). Alarga pra `text`: um id normal (ex.: de
-- notifications/task_activities, usado pelos próximos tipos de evento)
-- continua funcionando igual como texto; task_watchers usa
-- '<task_id>:<user_id>'.
alter table public.notification_dispatch_log
  alter column source_id type text using source_id::text;

-- Fase 2 é DRY-RUN por padrão: a Edge Function grava quem seria
-- notificado, com qual telefone encontrado e qual mensagem, mas NÃO chama
-- a Evolution API ainda. Ligar o envio de verdade é uma decisão separada,
-- feita só depois de revisar as primeiras entradas — errar o número aqui
-- manda WhatsApp pra pessoa errada, é o ponto que mais vale confirmar
-- devagar antes de automatizar de vez.
alter table public.notification_dispatch_log
  add column if not exists dry_run boolean not null default true,
  add column if not exists recipient_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists recipient_phone text,
  add column if not exists message_preview text;

-- Segredo compartilhado entre o trigger (roda dentro do Postgres) e a Edge
-- Function — mesmo padrão de task_recurrence_scheduler_secret (issue #184).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'whatsapp_notify_event_secret') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'whatsapp_notify_event_secret');
  end if;
end $$;

create or replace function public.get_whatsapp_notify_event_secret()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'whatsapp_notify_event_secret';
$$;

revoke all on function public.get_whatsapp_notify_event_secret() from public, anon, authenticated;
grant execute on function public.get_whatsapp_notify_event_secret() to service_role;

-- AFTER INSERT (não BEFORE): a notificação é um efeito colateral, nunca
-- deve arriscar a escrita real do observador. net.http_post é
-- fire-and-forget (fila assíncrona do pg_net) — não trava nem falha a
-- transação de quem adicionou o observador, mesmo se a Edge Function
-- estiver fora do ar.
create or replace function public.notify_watcher_added_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://sfpnjwllcmentoocylow.supabase.co/functions/v1/whatsapp-notify-event',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-whatsapp-notify-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'whatsapp_notify_event_secret')
    ),
    body := jsonb_build_object(
      'event_type', 'watcher_added',
      'source_table', 'task_watchers',
      'source_id', new.task_id::text || ':' || new.user_id::text,
      'task_id', new.task_id,
      'user_id', new.user_id
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_watcher_added on public.task_watchers;
create trigger trg_notify_watcher_added
  after insert on public.task_watchers
  for each row execute function public.notify_watcher_added_trigger();

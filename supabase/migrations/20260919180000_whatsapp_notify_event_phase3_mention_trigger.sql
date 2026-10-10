-- Fase 3 da migração do motor de avisos WhatsApp pra evento (fase 1: base;
-- fase 2: observador adicionado). Liga o segundo tipo de evento: menção.
--
-- Ampliação intencional em relação ao motor antigo: o cron (fora deste
-- repo) só olhava notifications.type = 'team_mention'. Aqui cobre também
-- 'mention' (menção direta a uma pessoa, @fulano) — as duas são
-- semanticamente "alguém foi citado", não faz sentido avisar só quando é
-- @equipe e ficar calado quando é @pessoa direto. Registrado aqui pra não
-- ser uma mudança de comportamento silenciosa.
create or replace function public.notify_mention_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type not in ('mention', 'team_mention') then
    return new;
  end if;

  perform net.http_post(
    url := 'https://sfpnjwllcmentoocylow.supabase.co/functions/v1/whatsapp-notify-event',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-whatsapp-notify-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'whatsapp_notify_event_secret')
    ),
    body := jsonb_build_object(
      'event_type', 'mention',
      'source_table', 'notifications',
      'source_id', new.id::text,
      'notification_id', new.id
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_mention on public.notifications;
create trigger trg_notify_mention
  after insert on public.notifications
  for each row execute function public.notify_mention_trigger();

-- Publica "reunião marcada" na Central de Eventos (vpsistema.com/eventos).
--
-- Gatilho `reuniao.marcada` da origem `vpclick`. Um evento por participante (menos quem marcou a reunião), com os
-- dados que a mensagem precisa. Quem decide se e como avisa (regra, template, janela de horário, canal) é a Central;
-- este arquivo só publica o fato. Enquanto o gatilho estiver em "sombra" na Central, nada é enviado de verdade.
--
-- Como funciona (mesmo desenho do VP Requisições, migração 037):
--   1. Trigger em `meetings` (AFTER INSERT) copia o fato para a caixa de saída `central_eventos_outbox`.
--      Nunca falha a criação da reunião: qualquer erro vira WARNING.
--   2. `private.central_eventos_publicar()` (pg_cron, a cada minuto) assina cada linha pendente (HMAC-SHA256 de
--      "<timestamp>.<corpo>") e envia à API `eventos-ingest` via pg_net, e confere as respostas. Falha temporária
--      tenta de novo com espera crescente (até 8 vezes); rejeição (400/401/403/404/413) é definitiva.
--   3. Sem o segredo no Vault, a publicação não faz nada: pode ser aplicada antes do segredo.
--
-- Configuração (uma vez, no SQL editor; o segredo NUNCA entra neste arquivo nem no git):
--   select vault.create_secret('<mesmo valor de eventos_hmac_vpclick da Central>', 'central_eventos_segredo');
--
-- Privacidade: o evento leva nome e e-mail do participante, título, data/hora e local. Telefone não sai: a Central
-- resolve o WhatsApp pelo e-mail, no próprio cadastro dela.
-- Limite conhecido: só a criação da reunião gera evento; quem é adicionado depois, ou uma mudança de horário, não.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.central_eventos_outbox (
  id                   bigint generated always as identity primary key,
  tipo                 text        not null,
  idempotency_key      text        not null unique,
  ocorrido_em          timestamptz not null,
  entidade_tipo        text,
  entidade_id          text,
  entidade_numero      text,
  payload              jsonb       not null default '{}',
  corpo                text,
  status               text        not null default 'pendente'
                         check (status in ('pendente', 'enviando', 'enviado', 'falha')),
  tentativas           int         not null default 0,
  proxima_tentativa_em timestamptz not null default now(),
  request_id           bigint,
  ultimo_erro          text,
  criado_em            timestamptz not null default now(),
  enviado_em           timestamptz
);

create index if not exists central_eventos_outbox_fila_idx
  on public.central_eventos_outbox (status, proxima_tentativa_em);

-- Só as funções SECURITY DEFINER abaixo (e o service_role) mexem nesta tabela; ninguém logado a lê.
alter table public.central_eventos_outbox enable row level security;
revoke all on public.central_eventos_outbox from anon, authenticated;

-- ─── Trigger: cada participante de uma reunião nova vira um evento na caixa de saída ──────────────
create or replace function private.central_outbox_reuniao()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_organizador text;
  v_sala text;
  p record;
begin
  begin
    if coalesce(array_length(new.participant_ids, 1), 0) = 0 then
      return new;
    end if;

    select name into v_organizador from public.profiles where id = new.created_by;
    select name into v_sala from public.meeting_rooms where id = new.room_id;

    for p in
      select pr.id, pr.name, pr.email
        from public.profiles pr
       where pr.id = any (new.participant_ids)
         and pr.id is distinct from new.created_by
         and coalesce(pr.email, '') <> ''
    loop
      insert into public.central_eventos_outbox
        (tipo, idempotency_key, ocorrido_em, entidade_tipo, entidade_id, payload)
      values (
        'reuniao.marcada',
        'reuniao:' || new.id || ':' || p.id,
        coalesce(new.created_at, now()),
        'reuniao',
        new.id::text,
        jsonb_strip_nulls(jsonb_build_object(
          'titulo', new.title,
          'data_hora', to_char(new.meeting_date at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI'),
          'local', coalesce(v_sala, 'Sem sala reservada'),
          'organizador', v_organizador,
          'participante_nome', p.name,
          'participante_email', p.email
        ))
      )
      on conflict (idempotency_key) do nothing;
    end loop;
  exception when others then
    raise warning 'central_outbox_reuniao: % (%)', sqlerrm, sqlstate;
  end;
  return new;
end;
$$;

revoke all on function private.central_outbox_reuniao() from public;

drop trigger if exists central_outbox_reuniao on public.meetings;
create trigger central_outbox_reuniao
  after insert on public.meetings
  for each row execute function private.central_outbox_reuniao();

-- ─── Conferência das respostas do pg_net ──────────────────────────────────────
create or replace function private.central_eventos_conferir()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  r record;
  resp record;
  espera interval;
begin
  for r in
    select * from public.central_eventos_outbox where status = 'enviando' order by id limit 200
  loop
    select * into resp from net._http_response where id = r.request_id;

    if not found then
      -- resposta ainda não chegou (ou já foi expurgada pelo pg_net): espera até 10 min
      if r.proxima_tentativa_em < now() - interval '10 minutes' then
        if r.tentativas >= 8 then
          update public.central_eventos_outbox
             set status = 'falha',
                 ultimo_erro = 'desistiu após ' || r.tentativas || ' tentativas sem resposta do pg_net'
           where id = r.id;
        else
          update public.central_eventos_outbox
             set status = 'pendente', ultimo_erro = 'sem resposta do pg_net',
                 proxima_tentativa_em = now()
           where id = r.id;
        end if;
      end if;
      continue;
    end if;

    if resp.status_code between 200 and 299 then
      update public.central_eventos_outbox
         set status = 'enviado', enviado_em = now(), ultimo_erro = null
       where id = r.id;
    elsif resp.status_code in (400, 401, 403, 404, 413) then
      update public.central_eventos_outbox
         set status = 'falha',
             ultimo_erro = left('HTTP ' || resp.status_code || ': ' || coalesce(resp.content, ''), 500)
       where id = r.id;
    elsif r.tentativas >= 8 then
      update public.central_eventos_outbox
         set status = 'falha',
             ultimo_erro = left('desistiu após ' || r.tentativas || ' tentativas; último: '
                                || coalesce('HTTP ' || resp.status_code, resp.error_msg, 'sem resposta'), 500)
       where id = r.id;
    else
      espera := (r.tentativas * r.tentativas || ' minutes')::interval;
      update public.central_eventos_outbox
         set status = 'pendente',
             ultimo_erro = left(coalesce('HTTP ' || resp.status_code || ': ' || resp.content, resp.error_msg, 'erro de rede'), 500),
             proxima_tentativa_em = now() + espera
       where id = r.id;
    end if;
  end loop;
end;
$$;

revoke all on function private.central_eventos_conferir() from public;

-- ─── Publicação (pg_cron, a cada minuto) ──────────────────────────────────────
create or replace function private.central_eventos_publicar()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_segredo text;
  v_url text;
  r record;
  v_ts text;
  v_corpo text;
  v_assinatura text;
  v_rid bigint;
begin
  select decrypted_secret into v_segredo
    from vault.decrypted_secrets where name = 'central_eventos_segredo';
  if v_segredo is null then
    return;  -- desligado até o segredo ser cadastrado
  end if;

  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'central_eventos_url';
  v_url := coalesce(v_url, 'https://ubdkoqxfwcraftesgmbw.supabase.co/functions/v1/eventos-ingest');

  perform private.central_eventos_conferir();

  for r in
    select * from public.central_eventos_outbox
     where status = 'pendente' and proxima_tentativa_em <= now()
     order by id
     limit 50
     for update skip locked
  loop
    -- O corpo é fixado na 1ª tentativa e reaproveitado: a mesma chave de idempotência
    -- sempre leva o mesmo conteúdo.
    v_corpo := coalesce(r.corpo, jsonb_build_object(
      'tipo', r.tipo,
      'idempotency_key', r.idempotency_key,
      'ocorrido_em', to_char(r.ocorrido_em at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'entidade', jsonb_strip_nulls(jsonb_build_object(
        'tipo', r.entidade_tipo, 'id', r.entidade_id, 'numero', r.entidade_numero)),
      'payload', r.payload
    )::text);

    v_ts := floor(extract(epoch from now()))::bigint::text;
    v_assinatura := 'sha256=' || encode(extensions.hmac(v_ts || '.' || v_corpo, v_segredo, 'sha256'), 'hex');

    v_rid := net.http_post(
      url := v_url,
      body := v_corpo::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-origem', 'vpclick',
        'x-timestamp', v_ts,
        'x-assinatura', v_assinatura
      ),
      timeout_milliseconds := 15000
    );

    update public.central_eventos_outbox
       set corpo = v_corpo, status = 'enviando', request_id = v_rid,
           tentativas = r.tentativas + 1,
           proxima_tentativa_em = now()
     where id = r.id;
  end loop;

  -- Faxina: eventos já entregues há mais de 30 dias.
  delete from public.central_eventos_outbox
   where status = 'enviado' and enviado_em < now() - interval '30 days';
end;
$$;

revoke all on function private.central_eventos_publicar() from public;
grant execute on function private.central_eventos_publicar() to postgres;

select cron.unschedule(jobid) from cron.job where jobname = 'central-eventos-publicar';
select cron.schedule(
  'central-eventos-publicar',
  '* * * * *',
  $$ select private.central_eventos_publicar(); $$
);

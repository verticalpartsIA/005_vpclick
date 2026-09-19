-- Fase 1 da migração do motor de avisos WhatsApp (fora deste repo, em
-- /root/vpclick-cobranca/ na VPS) de polling por cron a cada 15 min para
-- gatilho por evento (trigger -> pg_net -> Edge Function) nos 3 tipos que
-- nascem como uma linha nova (menção, conclusão, observador adicionado).
-- Resumo de atrasadas e inatividade continuam periódicos — não são evento,
-- dependem de "quanto tempo já passou", então ficam de fora desta fase.
--
-- Esta migration só cria a base (função de horário comercial + tabela de
-- idempotência) — não cria nenhum trigger nem Edge Function ainda, e não
-- muda nenhum comportamento existente. Fases seguintes plugam os triggers
-- por tabela-fonte um de cada vez (rollout faseado).

-- Reaproveita company_holidays (issue #184 fase 4) em vez de duplicar
-- calendário de feriados em Python — mesma fonte que a recorrência já usa,
-- sem duas listas de feriado divergindo com o tempo.
create or replace function public.is_within_business_hours(at timestamptz default now())
returns boolean
language sql
stable
set search_path = public
as $$
  -- coalesce, não só o DEFAULT do parâmetro: DEFAULT só vale quando o
  -- argumento é OMITIDO na chamada — um null explícito (ex.: passado por
  -- engano por quem chama) passaria direto e faria o resto da expressão
  -- colapsar pra null (nem true nem false), silenciosamente.
  select extract(dow from (coalesce(at, now()) at time zone 'America/Sao_Paulo')) between 1 and 5
     and (coalesce(at, now()) at time zone 'America/Sao_Paulo')::time between time '07:00' and time '18:00'
     and not exists (
       select 1 from public.company_holidays h
       where h.date = (coalesce(at, now()) at time zone 'America/Sao_Paulo')::date
     );
$$;

-- Idempotência do disparo por evento: um trigger AFTER INSERT pode, em
-- teoria, ser reprocessado (retry de pg_net, replay) — a chave primária
-- natural (tabela+linha+tipo de evento) garante que o mesmo evento nunca
-- dispara duas mensagens, mesmo processado 2x. Sem RLS liberada pra
-- authenticated/anon: só a Edge Function (service_role, que ignora RLS)
-- escreve e lê aqui — não é dado que o cliente do app precisa ver.
create table public.notification_dispatch_log (
  source_table text not null,
  source_id uuid not null,
  event_type text not null,
  dispatched_at timestamptz not null default now(),
  primary key (source_table, source_id, event_type)
);

alter table public.notification_dispatch_log enable row level security;

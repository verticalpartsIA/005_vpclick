-- Bloqueia dupla-reserva de sala de reunião no banco (não só avisar no
-- client). MeetingsView.tsx já checava conflito antes de criar, mas só
-- mostrava um aviso (⚠️) — dava pra confirmar e reservar a mesma sala no
-- mesmo horário mesmo assim, e nada impedia duas pessoas criando reuniões
-- quase ao mesmo tempo (race condition) de passarem pela checagem do
-- client e colidirem.
--
-- EXCLUDE USING gist trata isso na única camada que não tem race: mesma
-- room_id + intervalos de tempo que se sobrepõem vira erro de constraint
-- (23P01) direto no INSERT/UPDATE, não importa por onde a escrita chegue.
-- Meeting sem sala (room_id null) ou sem end_date nunca entra na checagem
-- (WHERE do índice) — sem sala não tem o que conflitar.

create extension if not exists btree_gist;

alter table public.meetings
  add constraint meetings_no_room_overlap
  exclude using gist (
    room_id with =,
    tstzrange(meeting_date, end_date) with &&
  )
  where (room_id is not null and end_date is not null);

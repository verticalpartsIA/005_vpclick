-- whiteboards_upd e mind_maps_upd usam can_access_whiteboard/can_access_mind_map
-- (qualquer um com acesso ao quadro, não só quem edita) tanto no using()
-- quanto no with check() — de propósito, pro autosave do canvas (coluna
-- `document`) funcionar pra qualquer colaborador. Mas RLS não tem
-- granularidade de coluna: a mesma policy libera UPDATE na linha inteira,
-- então qualquer usuário com acesso a um quadro/mapa "workspace" também
-- consegue reescrever `name`, `description`, `access` (esconder o quadro
-- virando 'private') ou `archived_at` (arquivar) direto pela API REST —
-- não só o dono/criador/gestor que a UI (canEdit()) deixa fazer isso.
--
-- Fix: trigger que barra mudança nas colunas de metadado quando quem está
-- editando não tem can_edit_*() — o autosave do `document` continua livre
-- pra qualquer um com acesso, sem tocar nas policies existentes.

create or replace function public.enforce_whiteboard_metadata_edit_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_edit_whiteboard(old.id) then
    if new.name is distinct from old.name
      or new.description is distinct from old.description
      or new.access is distinct from old.access
      or new.archived_at is distinct from old.archived_at
      or new.created_by is distinct from old.created_by
    then
      raise exception 'Você não tem permissão para editar os dados deste quadro branco.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger whiteboards_metadata_edit_guard
  before update on public.whiteboards
  for each row execute function public.enforce_whiteboard_metadata_edit_policy();

create or replace function public.enforce_mind_map_metadata_edit_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_edit_mind_map(old.id) then
    if new.name is distinct from old.name
      or new.description is distinct from old.description
      or new.access is distinct from old.access
      or new.archived_at is distinct from old.archived_at
      or new.created_by is distinct from old.created_by
    then
      raise exception 'Você não tem permissão para editar os dados deste mapa mental.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger mind_maps_metadata_edit_guard
  before update on public.mind_maps
  for each row execute function public.enforce_mind_map_metadata_edit_policy();

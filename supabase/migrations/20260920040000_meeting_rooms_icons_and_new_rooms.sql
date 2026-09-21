-- Ícone por sala de reunião (emoji, mesmo padrão visual já usado no resto
-- do app — ver ✨/🎉/⚠️/🚫 em MeetingsView.tsx) e as novas salas pedidas.
--
-- "Sala | ADM Impotação" e "Sala | Mazanino Escada Rolante" corrigidos pra
-- "Importação"/"Mezanino" (erros de digitação óbvios no pedido original).

alter table public.meeting_rooms add column if not exists icon text;

update public.meeting_rooms set icon = '👔' where name = '2º Andar | Diretoria' and icon is null;
update public.meeting_rooms set icon = '🍽️' where name = '3º Andar | Espaço Gourmet' and icon is null;
update public.meeting_rooms set icon = '⚙️' where name = 'Mezanino | Engenharia' and icon is null;

insert into public.meeting_rooms (name, icon, is_active)
select v.name, v.icon, true
from (values
  ('Sala | Diego', '🧑‍💼'),
  ('Sala | Comercial', '💼'),
  ('Sala | ADM Financeiro', '💰'),
  ('Sala | ADM RH', '🤝'),
  ('Sala | ADM Importação', '📦'),
  ('Sala | Engenharia', '📐'),
  ('Sala | PCP', '🏭'),
  ('Sala | Mezanino Escada Rolante', '🛗'),
  ('Sala | Quadro de Comandos', '🎛️')
) as v(name, icon)
where not exists (select 1 from public.meeting_rooms r where r.name = v.name);

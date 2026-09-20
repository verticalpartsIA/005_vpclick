-- Corrige RLS de "reminders" (tela "Hoje e atrasadas", RemindersView.tsx):
-- a unica policy da tabela era `auth_reminders` ALL usando/with check `true`
-- pra qualquer authenticated, ou seja, RLS habilitada mas sem filtro nenhum.
-- O app so mostra os lembretes de cada um (`user_id.eq.me,created_by.eq.me`)
-- por filtro no client — qualquer usuario autenticado podia ler, editar ou
-- apagar o lembrete de qualquer outra pessoa direto pela API/REST, sem
-- passar pelo app. Mesma familia de bug do RLS permissivo de "Lista
-- pessoal" (ver migration 20260920010000), mas aqui sem nenhuma trava, nem
-- pra ADMIN vs os demais.
--
-- Fix: dono (user_id) ou criador (created_by) do lembrete pode ler/editar/
-- apagar o proprio; so o criador pode inserir em seu proprio nome
-- (created_by = auth.uid()). with check do UPDATE fica aberto pra permitir
-- delegar (settar user_id pra outra pessoa), que e o comportamento atual
-- do botao "Delegar" — a trava real e o using(), que so deixa mexer em
-- linhas que voce ja e dono ou criador.

drop policy if exists auth_reminders on public.reminders;

create policy reminders_select
  on public.reminders
  for select to authenticated
  using (
    is_admin()
    or user_id = (select auth.uid())
    or created_by = (select auth.uid())
  );

create policy reminders_ins
  on public.reminders
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy reminders_upd
  on public.reminders
  for update to authenticated
  using (
    is_admin()
    or user_id = (select auth.uid())
    or created_by = (select auth.uid())
  )
  with check (true);

create policy reminders_del
  on public.reminders
  for delete to authenticated
  using (
    is_admin()
    or user_id = (select auth.uid())
    or created_by = (select auth.uid())
  );

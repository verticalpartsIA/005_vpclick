-- Migration 14 — Habilita realtime para profiles (autocomplete de menção)
--
-- Diagnóstico: o autocomplete de menção "@fulano" no MentionTextarea filtra
-- apenas sobre a lista `adminUsers`, carregada uma única vez no login
-- (loadAllUsers, App.tsx). Sem realtime na tabela `profiles`, qualquer usuário
-- criado/ativado depois que uma aba já estava aberta ficava invisível nas
-- menções até a página ser recarregada manualmente.
--
-- Esta migration adiciona `profiles` à publicação `supabase_realtime`. É uma
-- mudança ADITIVA e segura: apenas passa a transmitir alterações dessa tabela
-- via realtime. A entrega a cada cliente continua respeitando o RLS da tabela
-- (auth_profiles_select já permite leitura para qualquer autenticado).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;

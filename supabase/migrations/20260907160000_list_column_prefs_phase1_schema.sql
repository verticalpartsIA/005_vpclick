-- Persiste a visibilidade de colunas (campos personalizados e colunas padrão)
-- por Lista, compartilhada entre todos os usuários que acessam a lista.
-- Substitui o "protótipo local" (useState em memória, resetava a cada F5).
create table public.list_column_prefs (
  list_id uuid primary key references public.lists(id) on delete cascade,
  hidden_field_ids jsonb not null default '[]'::jsonb,
  hidden_standard_keys jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.list_column_prefs enable row level security;

-- Mesma regra de acesso de list_id usada em task_recurrence_rules: quem
-- acessa a lista pode ler e gravar suas preferências de coluna.
create policy list_column_prefs_select on public.list_column_prefs
  for select
  using (public.can_access_list(list_id));

create policy list_column_prefs_ins on public.list_column_prefs
  for insert
  with check (public.can_access_list(list_id));

create policy list_column_prefs_upd on public.list_column_prefs
  for update
  using (public.can_access_list(list_id))
  with check (public.can_access_list(list_id));

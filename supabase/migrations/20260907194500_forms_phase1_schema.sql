-- Issue #190 (Forms para Tarefas, inspirado no ClickUp): formulário interno
-- que qualquer usuário com acesso à Lista de destino pode preencher, e cada
-- envio cria UMA tarefa (mapeamento de pergunta -> campo padrão ou campo
-- personalizado). Escopo desta fase: só "interno" (usuário logado, RLS
-- normal). Formulário "público" (anônimo, fora do login) precisa de uma
-- rota sem autenticação que este app ainda não tem — ver nota na migration
-- e no relatório da issue; a coluna access já existe pra suportar isso
-- depois sem migração nova.

create table public.forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  list_id uuid not null references public.lists(id) on delete cascade,
  access text not null default 'internal' check (access in ('internal', 'public')),
  default_assignee_id uuid references auth.users(id),
  default_status text,
  default_priority text,
  submit_label text not null default 'Enviar',
  redirect_url text,
  allow_resubmit boolean not null default true,
  require_consent boolean not null default false,
  consent_text text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.form_questions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  order_index integer not null default 0,
  type text not null check (type in ('short_text', 'long_text', 'number', 'date', 'single_choice', 'multiple_choice', 'custom_field')),
  maps_to text check (maps_to in ('title', 'description', 'assignee', 'priority', 'start_date', 'due_date', 'custom_field')),
  custom_field_id uuid references public.custom_fields(id) on delete set null,
  label text not null,
  help_text text,
  is_required boolean not null default false,
  options jsonb,
  created_at timestamptz not null default now()
);

create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  answers jsonb not null default '{}'::jsonb,
  submitted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_form_questions_form_id on public.form_questions(form_id);
create index idx_form_submissions_form_id on public.form_submissions(form_id);
create index idx_forms_list_id on public.forms(list_id);

-- Quem pode ver/preencher um form: qualquer um que acessa a Lista de
-- destino (herda a permissão da lista, igual ao raciocínio da #189), OU o
-- criador/gestor pra gerenciar mesmo formulários arquivados/inativos.
create or replace function public.can_access_form(p_form uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.forms f
    where f.id = p_form
      and (
        public.can_access_list(f.list_id)
        or f.created_by = auth.uid()
        or public.is_manager()
      )
  );
$$;

create or replace function public.can_edit_form(p_form uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.forms f
    where f.id = p_form
      and (f.created_by = auth.uid() or public.is_manager())
  );
$$;

alter table public.forms enable row level security;
alter table public.form_questions enable row level security;
alter table public.form_submissions enable row level security;

-- SELECT direto nas colunas + can_access_list (NÃO reconsulta forms) —
-- mesma lição da #188 (self-lookup quebra RETURNING de INSERT).
create policy forms_select on public.forms
  for select to authenticated using (
    public.can_access_list(list_id)
    or created_by = auth.uid()
    or public.is_manager()
  );

create policy forms_ins on public.forms
  for insert to authenticated with check (created_by = auth.uid() and public.can_access_list(list_id));

create policy forms_upd on public.forms
  for update to authenticated using (public.can_edit_form(id)) with check (public.can_edit_form(id));

create policy forms_del on public.forms
  for delete to authenticated using (public.can_edit_form(id));

create policy form_questions_select on public.form_questions
  for select to authenticated using (public.can_access_form(form_id));

create policy form_questions_write on public.form_questions
  for all to authenticated using (public.can_edit_form(form_id)) with check (public.can_edit_form(form_id));

-- Respostas: quem preenche só enxerga a própria resposta; quem gerencia o
-- form (criador/gestor) enxerga todas — rastreabilidade sem virar vazamento
-- de dado entre quem respondeu.
create policy form_submissions_select on public.form_submissions
  for select to authenticated using (
    submitted_by = auth.uid() or public.can_edit_form(form_id)
  );

create policy form_submissions_ins on public.form_submissions
  for insert to authenticated with check (
    submitted_by = auth.uid() and public.can_access_form(form_id)
  );

create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_tasks_title_trgm
  on public.tasks using gin (lower(title) gin_trgm_ops);

create index if not exists idx_tasks_description_trgm
  on public.tasks using gin (lower(coalesce(description, '')) gin_trgm_ops);

create or replace function public.search_tasks(p_term text, p_limit integer default 200)
returns table (
  id uuid,
  title text,
  description text,
  status text,
  priority text,
  main_assignee_id uuid,
  secondary_assignee_ids uuid[],
  start_date date,
  due_date date,
  extension_count integer,
  list_id uuid,
  project_id uuid,
  parent_id uuid,
  created_at timestamptz,
  created_by uuid,
  tags text[]
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with search_input as (
    select
      nullif(trim(p_term), '') as raw_term,
      lower(nullif(trim(p_term), '')) as normalized_term,
      replace(
        replace(
          replace(lower(nullif(trim(p_term), '')), '\', '\\'),
          '%',
          '\%'
        ),
        '_',
        '\_'
      ) as like_term,
      greatest(1, least(coalesce(p_limit, 200), 200)) as safe_limit
  )
  select
    t.id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.main_assignee_id,
    t.secondary_assignee_ids,
    t.start_date,
    t.due_date,
    t.extension_count,
    t.list_id,
    t.project_id,
    t.parent_id,
    t.created_at,
    t.created_by,
    t.tags
  from public.tasks t
  cross join search_input s
  where
    s.raw_term is not null
    and public.can_access_task(t.id)
    and (
      lower(t.title) like '%' || s.like_term || '%' escape '\'
      or lower(coalesce(t.description, '')) like '%' || s.like_term || '%' escape '\'
    )
  order by
    case
      when lower(t.title) = s.normalized_term then 0
      when lower(t.title) like s.like_term || '%' escape '\' then 1
      when lower(t.title) like '%' || s.like_term || '%' escape '\' then 2
      else 3
    end,
    t.created_at desc,
    t.id asc
  limit (select safe_limit from search_input);
$$;

revoke execute on function public.search_tasks(text, integer) from public;
revoke execute on function public.search_tasks(text, integer) from anon;
grant execute on function public.search_tasks(text, integer) to authenticated;

# Remediação de Segurança — VP Click

> Documento gerado a partir de uma auditoria E2E em 2026-07-05. Descreve duas
> vulnerabilidades **críticas** e o plano de correção. As correções de segurança
> **não foram aplicadas automaticamente** porque exigem rotação de chave (ação no
> painel Supabase) e um refactor que precisa ser validado em staging antes de ir a
> produção. Trate este documento como o roteiro de correção.

---

## CRIT-01 — Chave `service_role` do Supabase embarcada no bundle JS público

### O problema
A chave `service_role` (que **ignora todo o RLS** e dá acesso irrestrito ao banco)
está no frontend em três lugares:
- `.env` → `VITE_SUPABASE_SERVICE_ROLE_KEY` (variáveis `VITE_*` são embutidas no
  bundle e servidas ao navegador)
- `src/lib/admin.ts` → constante hardcoded `supabaseServiceRoleKey`
- `src/App.tsx` → uso de `supabaseAdmin` (cliente com service role) em leituras/escritas

Confirmado: a string `"role":"service_role"` (JWT completo) aparece em texto claro em
`https://vpclick.vpsistema.com/assets/index-*.js`. Qualquer visitante consegue extrair a
chave e ler/escrever/apagar **qualquer dado** do banco de produção. O mesmo vale para o
portal `vpsistema.com` (expõe a service_role do projeto Supabase "Propostas").

### Correção (ordem recomendada)
1. **Rotacionar imediatamente** a service_role key no painel Supabase
   (Project Settings → API → "Reset service_role key") — a chave atual já está
   comprometida de forma permanente. Fazer o mesmo no projeto "Propostas".
2. **Remover** a service key do frontend:
   - apagar `VITE_SUPABASE_SERVICE_ROLE_KEY` do `.env`/hosting
   - remover `supabaseServiceRoleKey` e `supabaseAdmin` de `src/lib/admin.ts` e `src/lib/supabase.ts`
3. **Mover as operações privilegiadas para o backend** (Supabase Edge Functions):
   - criação/edição de usuários (`auth.admin.createUser`, `generateLink`, `listUsers`)
   - o fluxo de SSO (`handleSSOToken` em `src/App.tsx`) que hoje usa a service role no cliente
   - qualquer escrita que hoje depende de `supabaseAdmin` para furar o RLS
   O cliente chama a Edge Function (autenticada com o JWT do usuário); a função valida a
   permissão e usa a service role **no servidor**, onde ela nunca é exposta.
4. Trocar todo `supabaseAdmin.from(...)` remanescente por `supabase.from(...)`
   (cliente autenticado) e deixar o RLS (CRIT-02) fazer o controle.

---

## CRIT-02 — RLS permissivo: qualquer usuário logado lê/escreve todos os dados

### O problema
O controle de acesso por espaço/pasta é feito **apenas no cliente**
(`filteredSpaces`/`filteredFolders` em `src/App.tsx`). No banco, o papel `authenticated`
tem acesso amplo: com o token de um COLABORADOR restrito a 1 espaço foi possível ler
**21 espaços, 80 pastas, 180 listas, 6.719 tarefas e 39 perfis (nomes + e-mails reais)** e
até **alterar** o título de uma tarefa de outro usuário via API. O `anon` (sem login) já é
bloqueado corretamente (retorna 0 linhas) — o problema é a política de `authenticated`.

### Correção
Depende de CRIT-01 estar resolvido (enquanto a service_role vazar, RLS é inútil).
Habilitar RLS e criar políticas derivadas de `user_access`. Esboço (revisar e testar em
staging — **não aplicar direto em produção**):

```sql
-- Habilitar RLS em todas as tabelas de dados
alter table public.spaces        enable row level security;
alter table public.folders       enable row level security;
alter table public.lists         enable row level security;
alter table public.tasks         enable row level security;
alter table public.task_comments enable row level security;
-- ... idem task_checklists, task_attachments, task_watchers,
--     task_activities, task_extension_logs, custom_field_values, documents, etc.

-- Helper: papel do usuário atual
create or replace function public.current_role() returns text
language sql stable security definer as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Helper: o usuário tem acesso a esta pasta? (via user_access.folder_ids
-- OU via user_access.space_ids quando a pasta pertence a um espaço liberado)
create or replace function public.can_access_folder(fid uuid) returns boolean
language sql stable security definer as $$
  select public.current_role() = 'ADMIN'
      or exists (
        select 1 from public.user_access ua
        join public.folders f on f.id = fid
        where ua.user_id = auth.uid()
          and (f.id = any(ua.folder_ids) or f.space_id = any(ua.space_ids))
      )
$$;

-- Exemplo de política para TASKS (SELECT/UPDATE/DELETE conforme acesso à lista→pasta)
create policy tasks_select on public.tasks for select using (
  public.can_access_folder((select folder_id from public.lists where id = tasks.list_id))
);
create policy tasks_write on public.tasks for all using (
  public.can_access_folder((select folder_id from public.lists where id = tasks.list_id))
) with check (
  public.can_access_folder((select folder_id from public.lists where id = tasks.list_id))
);

-- profiles: cada um vê o próprio; ADMIN vê todos. Para exibir nomes de responsáveis
-- sem vazar e-mails, criar uma VIEW pública só com (id, name, avatar) e ler dela.
create policy profiles_self on public.profiles for select using (
  id = auth.uid() or public.current_role() = 'ADMIN'
);
```

> Observação de UX que a correção também resolve (ALTO-01): hoje o acesso ao *espaço* e às
> *pastas* são arrays independentes que dessincronizam — um colaborador com acesso ao
> espaço vê o espaço vazio se `folder_ids` não incluir as pastas. O helper
> `can_access_folder` acima trata "acesso ao espaço ⇒ acesso às pastas do espaço",
> eliminando esse problema. Alternativamente, corrigir no app re-sincronizando
> `folder_ids` ao criar/mover pastas.

---

## Correções já aplicadas nesta branch (seguras, sem dependência de infra)
- **ALTO-02** (`src/App.tsx`, `loadTasks`): busca de sub-entidades por task_id agora em
  **lotes de 150 IDs**, evitando a URL de ~39k caracteres que causava HTTP 400 e fazia
  comentários/checklists/anexos/watchers/atividades/logs sumirem no escopo global.
  Erros por lote passam a ser logados em vez de ignorados. Verificado: 0 erros 400.
- **MED-01** (`src/App.tsx`, `CreateTaskModal`): removida a auto-seleção do primeiro
  espaço (que apontava para um espaço REAL de produção). No escopo global o usuário agora
  precisa escolher Espaço → Pasta → Lista conscientemente; ao abrir dentro de uma
  lista/pasta/espaço a pré-seleção por contexto foi preservada.

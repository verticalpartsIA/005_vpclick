-- Issue #140: a Tabela só persistia colunas visíveis/largura/ordem/densidade
-- em localStorage (perdido ao trocar de navegador/dispositivo, ou ao limpar
-- dados do site). A tabela existente pra preferência de coluna
-- (list_column_prefs) é compartilhada por TODA a lista, não por usuário —
-- o oposto do que essa issue pede ("preferências pessoais não devem alterar
-- configuração estrutural do Workspace"). Cria uma tabela própria, por
-- usuário + escopo (scope_id vem do próprio front: "list:<id>", "current",
-- etc.), guardando o objeto TablePrefs inteiro como jsonb.
CREATE TABLE public.table_view_prefs (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_id text NOT NULL,
  prefs jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope_id)
);

ALTER TABLE public.table_view_prefs ENABLE ROW LEVEL SECURITY;

-- Cada usuário só lê/escreve a própria preferência — não é dado de
-- workspace, é 100% pessoal.
CREATE POLICY table_view_prefs_select ON public.table_view_prefs
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY table_view_prefs_insert ON public.table_view_prefs
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY table_view_prefs_update ON public.table_view_prefs
  FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY table_view_prefs_delete ON public.table_view_prefs
  FOR DELETE USING (user_id = (select auth.uid()));

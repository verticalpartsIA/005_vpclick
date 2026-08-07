-- ============================================
-- VP CLICK - MIGRATION 22: RESTRINGE EXCLUSÃO DE REUNIÃO AO ORGANIZADOR
-- Já aplicada no projeto Supabase VP CLICK via MCP. Este arquivo documenta a
-- alteração; execute no SQL Editor apenas se precisar reaplicar em outro ambiente:
-- https://supabase.com/dashboard/project/sfpnjwllcmentoocylow/sql/new
-- ============================================

-- A policy "auth_meetings" (migration 17) era FOR ALL USING (true): qualquer
-- usuário autenticado podia excluir a reunião de outra pessoa pelo botão
-- "Desmarcar reunião" (cascata: participantes, itens de ação, notificações).
-- Troca por 4 policies separadas — só a exclusão fica restrita ao
-- organizador (created_by) ou a quem tem papel ADMIN/GESTOR; leitura,
-- criação e atualização (ex: resumo da IA, itens de ação) seguem abertas a
-- qualquer autenticado, como antes.
DROP POLICY IF EXISTS auth_meetings ON meetings;

CREATE POLICY meetings_select ON meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY meetings_insert ON meetings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY meetings_update ON meetings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY meetings_delete ON meetings FOR DELETE TO authenticated USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['ADMIN', 'GESTOR']))
);

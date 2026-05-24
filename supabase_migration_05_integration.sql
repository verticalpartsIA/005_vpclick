-- ============================================================
-- MIGRATION 05: VP Click Hub Central de Integrações
-- Executar no Supabase SQL Editor — projeto VP Click
-- https://supabase.com/dashboard/project/sfpnjwllcmentoocylow/sql
-- ============================================================

-- ── 1) Proteger spaces nativos ────────────────────────────────
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

-- Marcar VP REQUISICOES como space nativo (não deletável)
UPDATE spaces SET is_system = true WHERE id = 'd59304a5-3a39-46f9-8460-e07a4b14b39c';

-- ── 2) Status Groups para os novos spaces ────────────────────

INSERT INTO task_status_groups (id, name) VALUES
  ('11100000-0000-4000-8000-000000000001', 'Propostas'),
  ('11100000-0000-4000-8000-000000000002', 'Visitas'),
  ('11100000-0000-4000-8000-000000000003', 'Solicitações'),
  ('11100000-0000-4000-8000-000000000004', 'Pós-Venda')
ON CONFLICT (id) DO NOTHING;

-- Propostas
INSERT INTO task_status_options (id, group_id, label, color, type, order_index) VALUES
  ('11200000-0000-4000-8000-000000000001', '11100000-0000-4000-8000-000000000001', 'Rascunho',            '#6b7280', 'START',     0),
  ('11200000-0000-4000-8000-000000000002', '11100000-0000-4000-8000-000000000001', 'Enviada',             '#2563eb', 'ACTIVE',    1),
  ('11200000-0000-4000-8000-000000000003', '11100000-0000-4000-8000-000000000001', 'Aguardando Resposta', '#d97706', 'ACTIVE',    2),
  ('11200000-0000-4000-8000-000000000004', '11100000-0000-4000-8000-000000000001', 'Aprovada',            '#16a34a', 'DONE',      3),
  ('11200000-0000-4000-8000-000000000005', '11100000-0000-4000-8000-000000000001', 'Recusada',            '#dc2626', 'CANCELLED', 4)
ON CONFLICT (id) DO NOTHING;

-- Visitas
INSERT INTO task_status_options (id, group_id, label, color, type, order_index) VALUES
  ('11200000-0000-4000-8000-000000000011', '11100000-0000-4000-8000-000000000002', 'Planejada',  '#6b7280', 'START',     0),
  ('11200000-0000-4000-8000-000000000012', '11100000-0000-4000-8000-000000000002', 'Realizada',  '#16a34a', 'DONE',      1),
  ('11200000-0000-4000-8000-000000000013', '11100000-0000-4000-8000-000000000002', 'Cancelada',  '#dc2626', 'CANCELLED', 2)
ON CONFLICT (id) DO NOTHING;

-- Solicitações (Brindes)
INSERT INTO task_status_options (id, group_id, label, color, type, order_index) VALUES
  ('11200000-0000-4000-8000-000000000021', '11100000-0000-4000-8000-000000000003', 'Pendente',   '#d97706', 'START',     0),
  ('11200000-0000-4000-8000-000000000022', '11100000-0000-4000-8000-000000000003', 'Aprovada',   '#16a34a', 'DONE',      1),
  ('11200000-0000-4000-8000-000000000023', '11100000-0000-4000-8000-000000000003', 'Recusada',   '#dc2626', 'CANCELLED', 2)
ON CONFLICT (id) DO NOTHING;

-- Pós-Venda 360
INSERT INTO task_status_options (id, group_id, label, color, type, order_index) VALUES
  ('11200000-0000-4000-8000-000000000031', '11100000-0000-4000-8000-000000000004', 'Aberto',          '#6b7280', 'START',     0),
  ('11200000-0000-4000-8000-000000000032', '11100000-0000-4000-8000-000000000004', 'Em Atendimento',  '#2563eb', 'ACTIVE',    1),
  ('11200000-0000-4000-8000-000000000033', '11100000-0000-4000-8000-000000000004', 'Aguardando',      '#d97706', 'ACTIVE',    2),
  ('11200000-0000-4000-8000-000000000034', '11100000-0000-4000-8000-000000000004', 'Concluído',       '#16a34a', 'DONE',      3),
  ('11200000-0000-4000-8000-000000000035', '11100000-0000-4000-8000-000000000004', 'Cancelado',       '#dc2626', 'CANCELLED', 4)
ON CONFLICT (id) DO NOTHING;

-- ── 3) Novos Spaces nativos ───────────────────────────────────
INSERT INTO spaces (id, name, workspace_id, color, icon, is_system) VALUES
  ('22200000-0000-4000-8000-000000000001', 'VP PROPOSTAS',  '00000000-0000-0000-0000-000000000001', '#10b981', 'TrendingUp',     true),
  ('22200000-0000-4000-8000-000000000002', 'VP VISITAS',    '00000000-0000-0000-0000-000000000001', '#8b5cf6', 'MapPin',         true),
  ('22200000-0000-4000-8000-000000000003', 'VP PÓS-VENDA',  '00000000-0000-0000-0000-000000000001', '#f59e0b', 'HeartHandshake', true)
ON CONFLICT (id) DO NOTHING;

-- ── 4) Folders ────────────────────────────────────────────────
INSERT INTO folders (id, name, space_id) VALUES
  ('33300000-0000-4000-8000-000000000001', 'Propostas Comerciais', '22200000-0000-4000-8000-000000000001'),
  ('33300000-0000-4000-8000-000000000002', 'Visitas',              '22200000-0000-4000-8000-000000000002'),
  ('33300000-0000-4000-8000-000000000003', 'Solicitações',         '22200000-0000-4000-8000-000000000002'),
  ('33300000-0000-4000-8000-000000000004', 'Atendimento',          '22200000-0000-4000-8000-000000000003')
ON CONFLICT (id) DO NOTHING;

-- ── 5) Lists ──────────────────────────────────────────────────
INSERT INTO lists (id, name, folder_id, status_group_id) VALUES
  ('44400000-0000-4000-8000-000000000001', 'Propostas',    '33300000-0000-4000-8000-000000000001', '11100000-0000-4000-8000-000000000001'),
  ('44400000-0000-4000-8000-000000000002', 'Visitas',      '33300000-0000-4000-8000-000000000002', '11100000-0000-4000-8000-000000000002'),
  ('44400000-0000-4000-8000-000000000003', 'Solicitações', '33300000-0000-4000-8000-000000000003', '11100000-0000-4000-8000-000000000003'),
  ('44400000-0000-4000-8000-000000000004', 'Tickets',      '33300000-0000-4000-8000-000000000004', '11100000-0000-4000-8000-000000000004')
ON CONFLICT (id) DO NOTHING;

-- ── 6) Tabela de links de integração ─────────────────────────
CREATE TABLE IF NOT EXISTS vpclick_integration_links (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_project   TEXT        NOT NULL,  -- 'propostas' | 'visitas' | 'brindes' | 'posvenda'
  source_table     TEXT        NOT NULL,  -- tabela de origem
  source_record_id TEXT        NOT NULL,  -- ID do registro (pode ser UUID ou int convertido p/ text)
  vpclick_task_id  UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  vpclick_list_id  TEXT        NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_project, source_table, source_record_id)
);

ALTER TABLE vpclick_integration_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vpclick_integration_links' AND policyname = 'integration_links_auth'
  ) THEN
    CREATE POLICY "integration_links_auth"
      ON vpclick_integration_links FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Política para service role (Edge Function usa service role)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vpclick_integration_links' AND policyname = 'integration_links_service'
  ) THEN
    CREATE POLICY "integration_links_service"
      ON vpclick_integration_links FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_integration_links_source
  ON vpclick_integration_links(source_project, source_table, source_record_id);
CREATE INDEX IF NOT EXISTS idx_integration_links_task
  ON vpclick_integration_links(vpclick_task_id);

-- Trigger updated_at
CREATE OR REPLACE TRIGGER integration_links_updated_at
  BEFORE UPDATE ON vpclick_integration_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 7) Automações para VP REQUISICOES ────────────────────────
-- Lista: f20b0470-efe0-450d-ae2e-1d941564a006  (Requisicoes)
-- Usuários: Andréia=74fbada6, Almoxarifado=aae0ca2e, Expedição=ad261c2a

-- Automação 1: Requisição criada → Atribuir Andréia + Notificar
INSERT INTO automations (
  name, workspace_id, list_id, enabled, trigger_type, trigger_config,
  conditions, actions, run_count, created_by, created_at, updated_at
) VALUES (
  'Nova requisição → Atribuir Compras e Notificar',
  '00000000-0000-0000-0000-000000000001',
  'f20b0470-efe0-450d-ae2e-1d941564a006',
  true,
  'task_created',
  '{}',
  '[]',
  '[
    {"type":"add_assignee","config":{"userId":"74fbada6-88c1-4946-91d7-27faeccde9ec"}},
    {"type":"send_notification","config":{"message":"📋 Nova requisição de compra! Acesse VP Requisições para iniciar a cotação."}}
  ]'::jsonb,
  0,
  '73388463-f6b7-4cdf-ab02-30da6403cb4b',
  now(), now()
);

-- Automação 2: AGUARDANDO APROVAÇÃO → Notificar Gestores
INSERT INTO automations (
  name, workspace_id, list_id, enabled, trigger_type, trigger_config,
  conditions, actions, run_count, created_by, created_at, updated_at
) VALUES (
  'Aguardando aprovação → Notificar Gestores',
  '00000000-0000-0000-0000-000000000001',
  'f20b0470-efe0-450d-ae2e-1d941564a006',
  true,
  'status_changed',
  '{"to":"AGUARDANDO APROVAÇÃO"}',
  '[]',
  '[{"type":"send_notification","config":{"message":"⚠️ Uma requisição aguarda sua aprovação — verifique no VP Requisições!"}}]'::jsonb,
  0,
  '73388463-f6b7-4cdf-ab02-30da6403cb4b',
  now(), now()
);

-- Automação 3: APROVADO → Notificar Compras para prosseguir
INSERT INTO automations (
  name, workspace_id, list_id, enabled, trigger_type, trigger_config,
  conditions, actions, run_count, created_by, created_at, updated_at
) VALUES (
  'Aprovado → Notificar Compras para prosseguir',
  '00000000-0000-0000-0000-000000000001',
  'f20b0470-efe0-450d-ae2e-1d941564a006',
  true,
  'status_changed',
  '{"to":"APROVADO"}',
  '[]',
  '[{"type":"send_notification","config":{"message":"✅ Requisição aprovada! Prossiga com a compra no VP Requisições."}}]'::jsonb,
  0,
  '73388463-f6b7-4cdf-ab02-30da6403cb4b',
  now(), now()
);

-- Automação 4: CONCLUÍDO → Notificar Almoxarifado e Expedição
INSERT INTO automations (
  name, workspace_id, list_id, enabled, trigger_type, trigger_config,
  conditions, actions, run_count, created_by, created_at, updated_at
) VALUES (
  'Concluído → Notificar Almoxarifado e Expedição',
  '00000000-0000-0000-0000-000000000001',
  'f20b0470-efe0-450d-ae2e-1d941564a006',
  true,
  'status_changed',
  '{"to":"CONCLUÍDO"}',
  '[]',
  '[
    {"type":"send_notification","config":{"message":"📦 Compra realizada! Material a caminho — verifique no VP Requisições."}},
    {"type":"add_assignee","config":{"userId":"aae0ca2e-e8e9-40de-b59f-4a0765d97fef"}},
    {"type":"add_assignee","config":{"userId":"ad261c2a-4900-4767-9bb8-5d93c095e169"}}
  ]'::jsonb,
  0,
  '73388463-f6b7-4cdf-ab02-30da6403cb4b',
  now(), now()
);

-- ── Verificação final ─────────────────────────────────────────
-- SELECT name, is_system FROM spaces WHERE is_system = true;
-- SELECT name FROM task_status_groups WHERE id LIKE '111%';
-- SELECT name FROM lists WHERE id LIKE '444%';
-- SELECT COUNT(*) FROM automations WHERE list_id = 'f20b0470-efe0-450d-ae2e-1d941564a006';

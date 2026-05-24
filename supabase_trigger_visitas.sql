-- ============================================================
-- TRIGGER: Visitas e Brindes → VP Click Hub
-- Executar no projeto: bvvnoapdclxhuygptbza (VISITAS E BRINDES)
-- ============================================================

-- 1) Habilitar pg_net
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ──────────────────────────────────────────────────────────────
-- PARTE A: Tabela VISITS (visitas agendadas)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_vpclick_visit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seller_nome  TEXT := '';
  v_seller_email TEXT := '';
  v_payload      JSONB;
BEGIN
  -- Buscar vendedor
  SELECT name, email INTO v_seller_nome, v_seller_email
  FROM profiles WHERE id = NEW.seller_id;

  v_payload := jsonb_build_object(
    'source',       'visitas',
    'event',        TG_OP,
    'record',       row_to_json(NEW)::jsonb || jsonb_build_object('_table', 'visits'),
    'seller_nome',  COALESCE(v_seller_nome, ''),
    'seller_email', COALESCE(v_seller_email, '')
  );

  PERFORM net.http_post(
    url     := 'https://sfpnjwllcmentoocylow.supabase.co/functions/v1/handle-integration-event',
    body    := v_payload::TEXT,
    headers := jsonb_build_object(
      'Content-Type',          'application/json',
      'x-integration-secret',  'vp-hub-integration-2026-secret'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[VP Click Hub] Erro ao notificar visita %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vpclick_visit_insert ON visits;
CREATE TRIGGER trg_vpclick_visit_insert
  AFTER INSERT ON visits
  FOR EACH ROW EXECUTE FUNCTION notify_vpclick_visit();

DROP TRIGGER IF EXISTS trg_vpclick_visit_update ON visits;
CREATE TRIGGER trg_vpclick_visit_update
  AFTER UPDATE OF status ON visits
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_vpclick_visit();

-- ──────────────────────────────────────────────────────────────
-- PARTE B: Tabela REQUESTS (solicitações de brindes)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_vpclick_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seller_nome  TEXT := '';
  v_seller_email TEXT := '';
  v_payload      JSONB;
BEGIN
  -- Buscar vendedor
  SELECT name, email INTO v_seller_nome, v_seller_email
  FROM profiles WHERE id = NEW.seller_id;

  v_payload := jsonb_build_object(
    'source',       'brindes',
    'event',        TG_OP,
    'record',       row_to_json(NEW)::jsonb || jsonb_build_object('_table', 'requests'),
    'seller_nome',  COALESCE(v_seller_nome, ''),
    'seller_email', COALESCE(v_seller_email, '')
  );

  PERFORM net.http_post(
    url     := 'https://sfpnjwllcmentoocylow.supabase.co/functions/v1/handle-integration-event',
    body    := v_payload::TEXT,
    headers := jsonb_build_object(
      'Content-Type',          'application/json',
      'x-integration-secret',  'vp-hub-integration-2026-secret'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[VP Click Hub] Erro ao notificar brinde %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vpclick_request_insert ON requests;
CREATE TRIGGER trg_vpclick_request_insert
  AFTER INSERT ON requests
  FOR EACH ROW EXECUTE FUNCTION notify_vpclick_request();

DROP TRIGGER IF EXISTS trg_vpclick_request_update ON requests;
CREATE TRIGGER trg_vpclick_request_update
  AFTER UPDATE OF status ON requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_vpclick_request();

-- Verificar:
-- SELECT trigger_name, event_object_table FROM information_schema.triggers
-- WHERE trigger_name LIKE 'trg_vpclick%';

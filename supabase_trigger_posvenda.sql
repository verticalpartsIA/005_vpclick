-- ============================================================
-- TRIGGER: VP Pós-Venda 360 → VP Click Hub
-- Executar no projeto: jkbklzlbhhfnamaeislb (vpposvenda360)
-- pg_net já está instalado neste projeto ✅
-- ============================================================

CREATE OR REPLACE FUNCTION notify_vpclick_ticket()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_payload JSONB;
BEGIN
  v_payload := jsonb_build_object(
    'source', 'posvenda',
    'event',  TG_OP,
    'record', row_to_json(NEW)::jsonb || jsonb_build_object('_table', 'tickets')
    -- vendedor já está dentro do record como campo texto (NEW.vendedor)
  );

  PERFORM net.http_post(
    url     := 'https://sfpnjwllcmentoocylow.supabase.co/functions/v1/handle-integration-event',
    headers := jsonb_build_object(
      'Content-Type',          'application/json',
      'x-integration-secret',  'vp-hub-integration-2026-secret'
    )::jsonb,
    body    := v_payload::TEXT
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[VP Click Hub] Erro ao notificar ticket %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vpclick_ticket_insert ON tickets;
CREATE TRIGGER trg_vpclick_ticket_insert
  AFTER INSERT ON tickets
  FOR EACH ROW EXECUTE FUNCTION notify_vpclick_ticket();

DROP TRIGGER IF EXISTS trg_vpclick_ticket_update ON tickets;
CREATE TRIGGER trg_vpclick_ticket_update
  AFTER UPDATE OF status, customer, part ON tickets
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status
     OR OLD.customer IS DISTINCT FROM NEW.customer)
  EXECUTE FUNCTION notify_vpclick_ticket();

-- Verificar:
-- SELECT trigger_name FROM information_schema.triggers WHERE trigger_name LIKE 'trg_vpclick%';

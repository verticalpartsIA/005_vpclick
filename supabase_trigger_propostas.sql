-- ============================================================
-- TRIGGER: Propostas → VP Click Hub
-- Executar no projeto: wfwraicrwazjblyvtzfu (Propostas)
-- ============================================================

-- 1) Habilitar pg_net
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2) Função do trigger
CREATE OR REPLACE FUNCTION notify_vpclick_proposta()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cliente_nome  TEXT := '';
  v_vendedor_nome TEXT := '';
  v_vendedor_email TEXT := '';
  v_payload       JSONB;
  v_source_table  TEXT := TG_TABLE_NAME;
BEGIN
  -- Buscar nome do cliente
  SELECT razao_social INTO v_cliente_nome
  FROM clientes WHERE id = NEW.cliente_id;

  -- Buscar nome e email do vendedor
  SELECT nome, email INTO v_vendedor_nome, v_vendedor_email
  FROM perfis WHERE id = NEW.vendedor_id;

  -- Montar payload
  v_payload := jsonb_build_object(
    'source',         'propostas',
    'event',          TG_OP,
    'record',         row_to_json(NEW)::jsonb || jsonb_build_object('_table', v_source_table),
    'cliente_nome',   COALESCE(v_cliente_nome, ''),
    'vendedor_nome',  COALESCE(v_vendedor_nome, ''),
    'vendedor_email', COALESCE(v_vendedor_email, '')
  );

  -- Chamar Edge Function (fire-and-forget)
  -- IMPORTANTE: body deve ser JSONB (não TEXT). net.http_post(body jsonb).
  -- Passar ::TEXT fazia a assinatura não bater e o erro era engolido pelo
  -- EXCEPTION WHEN OTHERS — nenhuma tarefa era criada. (corrigido 29/05/2026)
  PERFORM net.http_post(
    url     := 'https://sfpnjwllcmentoocylow.supabase.co/functions/v1/handle-integration-event',
    body    := v_payload,
    headers := jsonb_build_object(
      'Content-Type',          'application/json',
      'x-integration-secret',  'vp-hub-integration-2026-secret'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear a operação original por falha de webhook
  RAISE WARNING '[VP Click Hub] Erro ao notificar proposta %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 3) Triggers
DROP TRIGGER IF EXISTS trg_vpclick_proposta_insert ON propostas;
CREATE TRIGGER trg_vpclick_proposta_insert
  AFTER INSERT ON propostas
  FOR EACH ROW EXECUTE FUNCTION notify_vpclick_proposta();

DROP TRIGGER IF EXISTS trg_vpclick_proposta_update ON propostas;
CREATE TRIGGER trg_vpclick_proposta_update
  AFTER UPDATE OF status, titulo, valor_total, cliente_id ON propostas
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status
     OR OLD.titulo IS DISTINCT FROM NEW.titulo
     OR OLD.valor_total IS DISTINCT FROM NEW.valor_total)
  EXECUTE FUNCTION notify_vpclick_proposta();

-- Verificar:
-- SELECT trigger_name, event_manipulation FROM information_schema.triggers
-- WHERE event_object_table = 'propostas';

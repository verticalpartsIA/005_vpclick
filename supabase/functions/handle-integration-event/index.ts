/**
 * VP Click — Edge Function: handle-integration-event
 * SESSION 05 — Hub Central de Integrações
 *
 * Recebe webhooks dos projetos externos (Propostas, Visitas, Pós-Venda)
 * e cria/atualiza tarefas no VP Click automaticamente.
 *
 * Deploy:
 *   supabase functions deploy handle-integration-event --project-ref sfpnjwllcmentoocylow
 *
 * Secrets necessários (supabase secrets set):
 *   INTEGRATION_SECRET=vp-hub-integration-2026-secret
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Constantes ────────────────────────────────────────────────
const AUTOMACAO_USER_ID = 'fe56a4d8-e31d-4fbd-9d96-3b32cbd2a5d7'; // usuário "Automação"

const LIST_IDS: Record<string, string> = {
  propostas: '44400000-0000-4000-8000-000000000001',
  visitas:   '44400000-0000-4000-8000-000000000002',
  brindes:   '44400000-0000-4000-8000-000000000003',
  posvenda:  '44400000-0000-4000-8000-000000000004',
};

// Acompanhantes fixos por origem (responsáveis secundários).
// Propostas: Jurídico (Bianca) + Gestores Comerciais (Marcus e Guilherme).
const FOLLOWERS: Record<string, string[]> = {
  propostas: [
    '55ce8f2d-cd8c-46f6-9703-fc5508638128', // Bianca (Jurídico)
    'ed709c0c-f997-4e68-abbb-c25f9886a891', // Marcus Braz
    'f97faace-1e76-42ef-856d-582abd34a6b7', // Guilherme Garcia
  ],
};

// Mapeamento status origem → label do VP Click
const STATUS_MAP: Record<string, Record<string, string>> = {
  propostas: {
    rascunho:  'Rascunho',
    enviada:   'Enviada',
    aprovada:  'Aprovada',
    recusada:  'Recusada',
    cancelada: 'Recusada',
  },
  visitas: {
    PLANEJADA: 'Planejada',
    PENDENTE:  'Planejada',
    REALIZADA: 'Realizada',
  },
  brindes: {
    PENDENTE: 'Pendente',
    APROVADO: 'Aprovada',
    RECUSADO: 'Recusada',
  },
  posvenda: {
    aberto:             'Aberto',
    em_atendimento:     'Em Atendimento',
    aguardando_cliente: 'Aguardando',
    aguardando_interno: 'Aguardando',
    concluido:          'Concluído',
    cancelado:          'Cancelado',
  },
};

// ── Helpers ───────────────────────────────────────────────────
function mapStatus(source: string, rawStatus: string): string {
  return STATUS_MAP[source]?.[rawStatus] ?? 'Aberto';
}

function formatBRL(value: number | null | undefined): string {
  if (!value) return '';
  return ` | R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '?';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

function buildTitle(source: string, record: Record<string, any>, extra: Record<string, string>): string {
  switch (source) {
    case 'propostas':
      return `[PROPOSTA #${record.numero ?? '?'}] ${record.titulo ?? 'S/ título'} | ${extra.cliente_nome ?? '?'} → ${extra.vendedor_nome ?? '?'}${formatBRL(record.valor_total)}`;

    case 'visitas':
      return `[VISITA] ${formatDate(record.planned_date)} — ${record.client_name ?? '?'} | ${extra.seller_nome ?? '?'}`;

    case 'brindes':
      return `[BRINDE] ${record.client_name ?? '?'} | ${formatDate(record.visit_date)} | ${extra.seller_nome ?? '?'}`;

    case 'posvenda':
      return `[${record.code ?? 'RO'}] ${record.customer ?? '?'} — ${record.part ?? '?'} | ${record.vendedor ?? '?'}`;

    default:
      return `[${source.toUpperCase()}] Registro ${record.id ?? '?'}`;
  }
}

// ── Handler principal ─────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-integration-secret',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // ── Autenticação via shared secret ──
  const secret = req.headers.get('x-integration-secret');
  const expectedSecret = Deno.env.get('INTEGRATION_SECRET') ?? 'vp-hub-integration-2026-secret';
  if (secret !== expectedSecret) {
    console.warn('[Hub] Acesso negado — secret inválido');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: {
    source: string;        // 'propostas' | 'visitas' | 'brindes' | 'posvenda'
    event: string;         // 'INSERT' | 'UPDATE'
    record: Record<string, any>;
    vendedor_nome?: string;
    vendedor_email?: string;
    cliente_nome?: string;
    seller_nome?: string;
    seller_email?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { source, event, record } = body;

  if (!source || !event || !record) {
    return new Response(JSON.stringify({ error: 'Missing source, event or record' }), { status: 400 });
  }

  const listId = LIST_IDS[source];
  if (!listId) {
    return new Response(JSON.stringify({ error: `Unknown source: ${source}` }), { status: 400 });
  }

  // ── Supabase VP Click (service role) ──
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  // ── Resolver assignee pelo e-mail ──
  let assigneeId = AUTOMACAO_USER_ID;
  const email = body.vendedor_email ?? body.seller_email;
  if (email) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (profile?.id) assigneeId = profile.id;
  }

  const extra = {
    cliente_nome:  body.cliente_nome  ?? '',
    vendedor_nome: body.vendedor_nome ?? '',
    seller_nome:   body.seller_nome   ?? '',
  };

  const title      = buildTitle(source, record, extra);
  const status     = mapStatus(source, record.status ?? '');
  const recordIdStr = String(record.id ?? record.numero ?? '');

  // Acompanhantes (responsáveis secundários), sem duplicar o principal
  const followers = (FOLLOWERS[source] ?? []).filter((id) => id !== assigneeId);

  // Descrição amigável (usada na criação)
  const descLines = [
    `Registro de ${source} integrado automaticamente ao VP Click.`,
    extra.cliente_nome ? `• Cliente: ${extra.cliente_nome}` : '',
    extra.vendedor_nome ? `• Vendedor: ${extra.vendedor_nome}` : '',
    record.valor_total ? `• Valor: R$ ${Number(record.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '',
  ].filter(Boolean);
  const description = descLines.join('\n');

  try {
    // ── Verificar se já existe link ──
    const { data: existingLink } = await supabase
      .from('vpclick_integration_links')
      .select('vpclick_task_id')
      .eq('source_project', source)
      .eq('source_table', record._table ?? source)
      .eq('source_record_id', recordIdStr)
      .maybeSingle();

    if (existingLink?.vpclick_task_id) {
      // ── UPDATE: tarefa já existe → atualizar título e status ──
      const { error: updateErr } = await supabase
        .from('tasks')
        .update({ title, status })
        .eq('id', existingLink.vpclick_task_id);

      if (updateErr) throw updateErr;

      // Atualizar updated_at do link
      await supabase
        .from('vpclick_integration_links')
        .update({ updated_at: new Date().toISOString() })
        .eq('vpclick_task_id', existingLink.vpclick_task_id);

      console.log(`[Hub] Tarefa atualizada: ${existingLink.vpclick_task_id} (${source} #${recordIdStr})`);
      return new Response(JSON.stringify({ action: 'updated', task_id: existingLink.vpclick_task_id }), { status: 200 });

    } else {
      // ── INSERT: criar nova tarefa ──
      const { data: newTask, error: insertErr } = await supabase
        .from('tasks')
        .insert({
          title,
          description,
          status,
          priority:              source === 'propostas' ? 'Alta' : 'Média',
          main_assignee_id:      assigneeId,
          secondary_assignee_ids: followers,
          list_id:               listId,
          extension_count:       0,
          tags:                  [],
          created_by:            AUTOMACAO_USER_ID,
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      // Registrar link
      const { error: linkErr } = await supabase
        .from('vpclick_integration_links')
        .insert({
          source_project:   source,
          source_table:     record._table ?? source,
          source_record_id: recordIdStr,
          vpclick_task_id:  newTask.id,
          vpclick_list_id:  listId,
        });

      if (linkErr) console.warn('[Hub] Erro ao salvar link:', linkErr.message);

      console.log(`[Hub] Tarefa criada: ${newTask.id} (${source} #${recordIdStr})`);
      return new Response(JSON.stringify({ action: 'created', task_id: newTask.id }), { status: 201 });
    }

  } catch (err: unknown) {
    const msg = err instanceof Error
      ? err.message
      : (err && typeof err === 'object' ? JSON.stringify(err) : String(err));
    console.error('[Hub] Erro:', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});

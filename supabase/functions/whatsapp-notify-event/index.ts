// whatsapp-notify-event — fases 2, 3 e 4 da migração do motor de avisos
// WhatsApp pra evento (fase 1: migration whatsapp_notify_event_phase1_schema).
//
// Disparada por trigger AFTER INSERT/UPDATE (pg_net, fire-and-forget) em vez
// do polling a cada 15 min do motor antigo (fora deste repo, em
// /root/vpclick-cobranca/ na VPS). Autenticada por segredo compartilhado
// (Vault: whatsapp_notify_event_secret), mesmo padrão do
// task-recurrence-scheduler — verify_jwt=false no deploy, a própria função
// valida o header x-whatsapp-notify-secret.
//
// Tipos de evento implementados: 'watcher_added' (fase 2), 'mention' (fase
// 3, cobre notifications.type IN ('mention','team_mention') — ver
// comentário na migration da fase 3 sobre por que os dois, não só
// team_mention como o motor antigo fazia) e 'task_completed' (fase 4, tarefa
// concluída ou cancelada — ver comentário na migration da fase 4 sobre por
// que o gatilho fica em tasks, não em task_activities, e por que o
// destinatário é quem criou a tarefa).
//
// DRY-RUN por padrão: grava em notification_dispatch_log quem seria
// notificado, com qual telefone e qual mensagem, mas NÃO chama a Evolution
// API — ligar o envio de verdade é uma decisão separada, feita só depois
// de revisar as primeiras entradas (errar o número manda WhatsApp pra
// pessoa errada).
//
// Envio real (2026-09-20): quando WHATSAPP_REAL_SEND=true (secret desta
// function), além do log de auditoria, chama o gateway de eventos do
// verticalparts-whatsapp-mcp (POST /events, secrets EVENTS_GATEWAY_URL/
// EVENTS_GATEWAY_TOKEN) com um template registrado + dados — nunca texto
// livre. Continua dry-run enquanto o secret não existir/for false; isso
// não muda nada do comportamento atual até alguém ligar o flag de
// propósito.
import { createClient } from 'npm:@supabase/supabase-js@2';

interface EventPayload {
  event_type: string;
  source_table: string;
  source_id: string;
  task_id?: string;
  user_id?: string;
  notification_id?: string;
  actor_id?: string | null;
  status_type?: string;
}

// internal_contacts vive num projeto Supabase DIFERENTE (vpposvenda360),
// não no vpclick — precisa de credenciais próprias, configuradas como
// secrets desta Edge Function (Project Settings > Edge Functions > Secrets
// do projeto vpclick). Sem elas, a função ainda roda e registra o dry-run,
// só que sem telefone resolvido (nunca inventa/adivinha um número).
const CONTACTS_PROJECT_URL = Deno.env.get('CONTACTS_PROJECT_URL');
const CONTACTS_SERVICE_ROLE_KEY = Deno.env.get('CONTACTS_SERVICE_ROLE_KEY');

// Gateway de eventos do verticalparts-whatsapp-mcp (POST /events) -- unico
// caminho autorizado pra este projeto chegar na Evolution API de verdade
// (ver RAG-004 daquele repo: nenhum sistema novo fala direto com
// /message/* da Evolution API). EVENTS_GATEWAY_TOKEN e o token proprio do
// vpclick em config/systems.yaml do gateway -- nunca compartilhado com
// outro `source`.
const EVENTS_GATEWAY_URL = Deno.env.get('EVENTS_GATEWAY_URL');
const EVENTS_GATEWAY_TOKEN = Deno.env.get('EVENTS_GATEWAY_TOKEN');

// Kill switch proprio deste projeto, independente do WHATSAPP_MCP_ALLOW_WRITES
// do lado do gateway (que tambem se aplica). Ausente/false = continua so
// dry-run, exatamente o comportamento de hoje -- ligar o envio real e uma
// decisao separada, feita depois de revisar as primeiras entradas reais
// (RAG-005 do verticalparts-whatsapp-mcp tem o runbook dessa decisao).
const REAL_SEND = (Deno.env.get('WHATSAPP_REAL_SEND') ?? '').trim().toLowerCase() === 'true';

// Abaixo deste limiar de similaridade (0 a 1), a diferença entre nomes é
// grande o bastante pra não confiar — melhor não resolver telefone nenhum
// do que arriscar mandar pra pessoa errada por um match fraco.
const MIN_NAME_SIMILARITY = 0.4;

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

async function findContactPhone(profileName: string): Promise<{ phone: string | null; matchedName: string | null; similarity: number | null }> {
  if (!CONTACTS_PROJECT_URL || !CONTACTS_SERVICE_ROLE_KEY) {
    console.log('[whatsapp-notify-event] DEBUG: CONTACTS_PROJECT_URL ou CONTACTS_SERVICE_ROLE_KEY ausente nas secrets');
    return { phone: null, matchedName: null, similarity: null };
  }
  const contactsClient = createClient(CONTACTS_PROJECT_URL, CONTACTS_SERVICE_ROLE_KEY);
  const { data, error } = await contactsClient
    .from('internal_contacts')
    .select('nome, phone')
    .eq('ativo', true);
  if (error || !data) {
    console.log(`[whatsapp-notify-event] DEBUG: erro ao consultar internal_contacts: ${error?.message ?? 'data nula'} (code=${(error as { code?: string })?.code ?? 'n/a'})`);
    return { phone: null, matchedName: null, similarity: null };
  }
  console.log(`[whatsapp-notify-event] DEBUG: internal_contacts retornou ${data.length} contatos ativos`);

  const target = normalize(profileName);
  // Similaridade simples por sobreposição de palavras do nome (sem depender
  // de pg_trgm num projeto diferente do banco atual) — cada nome em comum
  // (ex.: primeiro nome + um sobrenome) conta a favor do match.
  const targetWords = new Set(target.split(/\s+/).filter(Boolean));
  let best: { phone: string; nome: string; score: number } | null = null;
  for (const contact of data as { nome: string; phone: string }[]) {
    const contactWords = new Set(normalize(contact.nome).split(/\s+/).filter(Boolean));
    const shared = [...targetWords].filter((w) => contactWords.has(w)).length;
    const union = new Set([...targetWords, ...contactWords]).size;
    const score = union === 0 ? 0 : shared / union;
    if (!best || score > best.score) best = { phone: contact.phone, nome: contact.nome, score };
  }
  if (!best || best.score < MIN_NAME_SIMILARITY) return { phone: null, matchedName: best?.nome ?? null, similarity: best?.score ?? null };
  return { phone: best.phone, matchedName: best.nome, similarity: best.score };
}

// Chama o gateway de eventos do verticalparts-whatsapp-mcp. O gateway é
// quem renderiza o texto final a partir do template registrado — esta
// function nunca manda texto livre, só nome do template + dados.
async function sendViaGateway(
  template: string,
  phone: string,
  data: Record<string, unknown>,
  idempotencyKey: string,
  eventType: string,
  recordId: string,
): Promise<{ sent: boolean; message_id?: string | null; replay?: boolean; error?: string }> {
  if (!EVENTS_GATEWAY_URL || !EVENTS_GATEWAY_TOKEN) {
    return { sent: false, error: 'EVENTS_GATEWAY_URL/EVENTS_GATEWAY_TOKEN não configurados nesta Edge Function' };
  }
  let resp: Response;
  try {
    resp = await fetch(EVENTS_GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${EVENTS_GATEWAY_TOKEN}` },
      body: JSON.stringify({
        source: 'vpclick',
        event: eventType,
        record_id: recordId,
        recipient: { phone },
        template,
        data,
        idempotency_key: idempotencyKey,
      }),
    });
  } catch (exc) {
    return { sent: false, error: `falha de rede chamando o gateway: ${exc}` };
  }
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) return { sent: false, error: `gateway respondeu ${resp.status}: ${JSON.stringify(body)}` };
  return { sent: true, message_id: body.message_id ?? null, replay: body.replay === true };
}

// Grava sempre em notification_dispatch_log (dry-run ou não — é o registro
// de auditoria de quem seria/foi notificado, com qual telefone e mensagem)
// e, só quando REAL_SEND estiver ligado e o telefone tiver sido resolvido,
// também chama o gateway de eventos de verdade. Parte comum a todos os
// tipos de evento, pra não duplicar checagem de horário comercial/telefone/
// idempotência a cada novo tipo adicionado.
async function dispatchNotification(
  admin: any,
  payload: EventPayload,
  recipientUserId: string,
  recipientName: string,
  bodyLines: string[],
  template: string,
  templateData: Record<string, unknown>,
) {
  const withinBusinessHours = (await admin.rpc('is_within_business_hours')).data === true;
  const { phone, matchedName, similarity } = await findContactPhone(recipientName);

  const messageLines = [...bodyLines];
  if (!withinBusinessHours) messageLines.push('[fora do horário comercial — em produção, ficaria represado até reabrir o expediente]');
  if (!phone) messageLines.push(`[telefone não resolvido em internal_contacts — nome buscado: "${recipientName}"${matchedName ? `, melhor candidato encontrado: "${matchedName}" (similaridade ${similarity?.toFixed(2)}, abaixo do limiar de confiança)` : ' (nenhum candidato)'}]`);
  const messagePreview = messageLines.join(' ');

  const { data: inserted, error: insertErr } = await admin
    .from('notification_dispatch_log')
    .insert({
      source_table: payload.source_table,
      source_id: payload.source_id,
      event_type: payload.event_type,
      dry_run: !REAL_SEND,
      recipient_user_id: recipientUserId,
      recipient_phone: phone,
      message_preview: messagePreview,
    })
    .select()
    .maybeSingle();

  if (insertErr) {
    // 23505 = já processado (idempotência via chave primária natural).
    if ((insertErr as { code?: string }).code === '23505') return { skipped: 'evento já processado' };
    return { error: insertErr.message };
  }

  console.log(`[whatsapp-notify-event] ${REAL_SEND ? 'envio real' : 'dry-run'}: ${messagePreview}`);

  if (!REAL_SEND) return { dry_run: true, logged: inserted };
  if (!phone) return { dry_run: false, sent: false, skipped: 'telefone não resolvido — envio real abortado', logged: inserted };
  if (!withinBusinessHours) return { dry_run: false, sent: false, skipped: 'fora do horário comercial', logged: inserted };

  const idempotencyKey = `vpclick:${payload.event_type}:${payload.source_id}`;
  const result = await sendViaGateway(template, phone, templateData, idempotencyKey, payload.event_type, payload.source_id);
  return { dry_run: false, ...result, logged: inserted };
}

async function handleWatcherAdded(admin: any, payload: EventPayload) {
  const { data: existing } = await admin
    .from('task_watchers')
    .select('task_id, user_id')
    .eq('task_id', payload.task_id!)
    .eq('user_id', payload.user_id!)
    .maybeSingle();
  if (!existing) {
    // O observador já pode ter sido removido entre o INSERT e esta chamada
    // (fire-and-forget não garante ordem) — nada a notificar.
    return { skipped: 'observador não existe mais' };
  }

  const [{ data: task }, { data: watcherProfile }] = await Promise.all([
    admin.from('tasks').select('id, title, created_by').eq('id', payload.task_id!).maybeSingle(),
    admin.from('profiles').select('id, name').eq('id', payload.user_id!).maybeSingle(),
  ]);
  if (!task || !watcherProfile) return { skipped: 'tarefa ou perfil do observador não encontrado' };

  // "Quem causou" é uma aproximação (o schema não guarda quem adicionou o
  // observador) — mesma limitação já documentada no motor antigo.
  const actorName = task.created_by
    ? (await admin.from('profiles').select('name').eq('id', task.created_by).maybeSingle()).data?.name ?? null
    : null;

  const bodyLines = [
    `📋 VP Click aqui! Oi ${watcherProfile.name.split(' ')[0]}, você foi adicionado(a) como observador(a) da tarefa "${task.title}"${actorName ? ` (provável responsável pela ação: ${actorName})` : ''}.`,
  ];
  return dispatchNotification(admin, payload, watcherProfile.id, watcherProfile.name, bodyLines, 'vpclick_watcher_added', {
    recipient_first_name: watcherProfile.name.split(' ')[0],
    title: task.title,
    actor_name: actorName ?? 'alguém',
  });
}

async function handleMention(admin: any, payload: EventPayload) {
  const { data: notification } = await admin
    .from('notifications')
    .select('id, user_id, actor_id, type, title, body, task_id')
    .eq('id', payload.notification_id!)
    .maybeSingle();
  if (!notification) return { skipped: 'notificação não encontrada (pode ter sido removida)' };

  const [{ data: recipientProfile }, { data: actorProfile }] = await Promise.all([
    admin.from('profiles').select('id, name').eq('id', notification.user_id).maybeSingle(),
    notification.actor_id
      ? admin.from('profiles').select('name').eq('id', notification.actor_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!recipientProfile) return { skipped: 'perfil do destinatário não encontrado' };

  const kind = notification.type === 'team_mention' ? 'mencionou sua equipe' : 'mencionou você';
  const bodyLines = [
    `📋 VP Click aqui! Oi ${recipientProfile.name.split(' ')[0]}, ${actorProfile?.name ?? 'alguém'} ${kind}${notification.title ? ` em "${notification.title}"` : ''}.`,
  ];
  return dispatchNotification(admin, payload, recipientProfile.id, recipientProfile.name, bodyLines, 'vpclick_mention', {
    recipient_first_name: recipientProfile.name.split(' ')[0],
    actor_name: actorProfile?.name ?? 'alguém',
    mention_verb: kind,
    title: notification.title ?? 'uma tarefa',
  });
}

async function handleTaskCompleted(admin: any, payload: EventPayload) {
  const { data: task } = await admin
    .from('tasks')
    .select('id, title, created_by')
    .eq('id', payload.task_id!)
    .maybeSingle();
  if (!task || !task.created_by) return { skipped: 'tarefa não encontrada ou sem criador registrado' };
  if (task.created_by === payload.actor_id) return { skipped: 'quem concluiu é quem criou — sem aviso' };

  const [{ data: recipientProfile }, { data: actorProfile }] = await Promise.all([
    admin.from('profiles').select('id, name').eq('id', task.created_by).maybeSingle(),
    payload.actor_id
      ? admin.from('profiles').select('name').eq('id', payload.actor_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!recipientProfile) return { skipped: 'perfil de quem criou a tarefa não encontrado' };

  const verb = payload.status_type === 'CANCELLED' ? 'cancelou' : 'concluiu';
  const bodyLines = [
    `📋 VP Click aqui! Oi ${recipientProfile.name.split(' ')[0]}, ${actorProfile?.name ?? 'alguém'} ${verb} a tarefa "${task.title}".`,
  ];
  return dispatchNotification(admin, payload, recipientProfile.id, recipientProfile.name, bodyLines, 'vpclick_task_completed', {
    recipient_first_name: recipientProfile.name.split(' ')[0],
    actor_name: actorProfile?.name ?? 'alguém',
    verb,
    title: task.title,
  });
}

Deno.serve(async (req: Request) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const providedSecret = req.headers.get('x-whatsapp-notify-secret');
  if (!providedSecret) return json({ error: 'x-whatsapp-notify-secret ausente' }, 401);

  const { data: expectedSecret, error: secretErr } = await admin.rpc('get_whatsapp_notify_event_secret');
  if (secretErr || !expectedSecret || providedSecret !== expectedSecret) {
    return json({ error: 'segredo inválido' }, 401);
  }

  let payload: EventPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'corpo inválido' }, 400);
  }

  let result: Record<string, unknown>;
  if (payload.event_type === 'watcher_added') {
    result = await handleWatcherAdded(admin, payload);
  } else if (payload.event_type === 'mention') {
    result = await handleMention(admin, payload);
  } else if (payload.event_type === 'task_completed') {
    result = await handleTaskCompleted(admin, payload);
  } else {
    // Qualquer outro tipo é um 400 explícito — não um "sucesso" silencioso
    // enganoso.
    return json({ error: `event_type '${payload.event_type}' ainda não implementado nesta função` }, 400);
  }

  if ('error' in result) return json(result, 500);
  return json(result);
});

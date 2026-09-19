// whatsapp-notify-event — fases 2 e 3 da migração do motor de avisos
// WhatsApp pra evento (fase 1: migration whatsapp_notify_event_phase1_schema).
//
// Disparada por trigger AFTER INSERT (pg_net, fire-and-forget) em vez do
// polling a cada 15 min do motor antigo (fora deste repo, em
// /root/vpclick-cobranca/ na VPS). Autenticada por segredo compartilhado
// (Vault: whatsapp_notify_event_secret), mesmo padrão do
// task-recurrence-scheduler — verify_jwt=false no deploy, a própria função
// valida o header x-whatsapp-notify-secret.
//
// Tipos de evento implementados: 'watcher_added' (fase 2) e 'mention'
// (fase 3, cobre notifications.type IN ('mention','team_mention') — ver
// comentário na migration da fase 3 sobre por que os dois, não só
// team_mention como o motor antigo fazia). Conclusão fica pra uma fase
// seguinte.
//
// DRY-RUN por padrão: grava em notification_dispatch_log quem seria
// notificado, com qual telefone e qual mensagem, mas NÃO chama a Evolution
// API — ligar o envio de verdade é uma decisão separada, feita só depois
// de revisar as primeiras entradas (errar o número manda WhatsApp pra
// pessoa errada).
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface EventPayload {
  event_type: string;
  source_table: string;
  source_id: string;
  task_id?: string;
  user_id?: string;
  notification_id?: string;
}

// internal_contacts vive num projeto Supabase DIFERENTE (vpposvenda360),
// não no vpclick — precisa de credenciais próprias, configuradas como
// secrets desta Edge Function (Project Settings > Edge Functions > Secrets
// do projeto vpclick). Sem elas, a função ainda roda e registra o dry-run,
// só que sem telefone resolvido (nunca inventa/adivinha um número).
const CONTACTS_PROJECT_URL = Deno.env.get('CONTACTS_PROJECT_URL');
const CONTACTS_SERVICE_ROLE_KEY = Deno.env.get('CONTACTS_SERVICE_ROLE_KEY');

// Abaixo deste limiar de similaridade (0 a 1), a diferença entre nomes é
// grande o bastante pra não confiar — melhor não resolver telefone nenhum
// do que arriscar mandar pra pessoa errada por um match fraco.
const MIN_NAME_SIMILARITY = 0.4;

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

async function findContactPhone(profileName: string): Promise<{ phone: string | null; matchedName: string | null; similarity: number | null }> {
  if (!CONTACTS_PROJECT_URL || !CONTACTS_SERVICE_ROLE_KEY) {
    return { phone: null, matchedName: null, similarity: null };
  }
  const contactsClient = createClient(CONTACTS_PROJECT_URL, CONTACTS_SERVICE_ROLE_KEY);
  const { data, error } = await contactsClient
    .from('internal_contacts')
    .select('nome, phone')
    .eq('ativo', true);
  if (error || !data) return { phone: null, matchedName: null, similarity: null };

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

// Monta o texto final e grava (dry-run) em notification_dispatch_log — parte
// comum a todos os tipos de evento, pra não duplicar a checagem de horário
// comercial/resolução de telefone/idempotência a cada novo tipo adicionado.
async function logDryRun(
  admin: ReturnType<typeof createClient>,
  payload: EventPayload,
  recipientUserId: string,
  recipientName: string,
  bodyLines: string[],
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
      dry_run: true,
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

  console.log(`[whatsapp-notify-event] dry-run: ${messagePreview}`);
  return { dry_run: true, logged: inserted };
}

async function handleWatcherAdded(admin: ReturnType<typeof createClient>, payload: EventPayload) {
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
  return logDryRun(admin, payload, watcherProfile.id, watcherProfile.name, bodyLines);
}

async function handleMention(admin: ReturnType<typeof createClient>, payload: EventPayload) {
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
  return logDryRun(admin, payload, recipientProfile.id, recipientProfile.name, bodyLines);
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
  } else {
    // Próximas fases plugam conclusão aqui. Por ora, qualquer outro tipo é
    // um 400 explícito — não um "sucesso" silencioso enganoso.
    return json({ error: `event_type '${payload.event_type}' ainda não implementado nesta função` }, 400);
  }

  if ('error' in result) return json(result, 500);
  return json(result);
});

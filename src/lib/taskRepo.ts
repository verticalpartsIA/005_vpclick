// taskRepo — porta de LEITURA de tarefas (Ports & Adapters).
//
// Concentra todo o acesso ao Supabase para *ler* tarefas: paginação (teto de
// ~1000 linhas do PostgREST), hidratação de sub-entidades em lotes, busca
// server-side, índice de contagem e carga sob demanda do detalhe. O App
// consome uma interface pequena e não conhece nomes de coluna nem o formato
// das linhas — esse conhecimento vive aqui. RLS continua sendo o portão de
// visibilidade no servidor.
//
// Sem React: são funções puras de acesso a dados, testáveis por si só (troque
// `supabase` por um fake no teste). As mutações (create/update/duplicate)
// continuam no App por enquanto e migram num passo seguinte.
import { supabase } from './supabase';
import { Task, TaskPriority } from '../types';

const PAGE_SIZE = 1000;
// Um único .in('task_id', [milhares de UUIDs]) gera uma URL de dezenas de
// milhares de caracteres e o servidor responde 400. Quebramos em lotes de 150
// IDs (URL segura) e concatenamos os resultados.
const SUBENTITY_CHUNK = 150;

// ── Mapeadores DB (snake_case) → domínio (camelCase) ────────────────────────
const mapAttachment = (a: any) => ({
  id: a.id, name: a.name, url: a.url, type: a.type, size: a.size, uploadedAt: a.uploaded_at,
});
const mapComment = (c: any) => ({
  id: c.id, userId: c.user_id, text: c.text, timestamp: c.created_at, updatedAt: c.updated_at || undefined,
  parentCommentId: c.parent_comment_id || undefined,
  assignedTo: c.assigned_to || undefined,
  assignedBy: c.assigned_by || undefined,
  resolvedAt: c.resolved_at || undefined,
  resolvedBy: c.resolved_by || undefined,
});
const mapLog = (l: any) => ({
  id: l.id, oldDate: l.old_date, newDate: l.new_date, reason: l.reason, updatedBy: l.updated_by, timestamp: l.created_at,
});
const mapChecklist = (ck: any) => ({ id: ck.id, text: ck.text, completed: ck.completed });
const mapActivity = (act: any) => ({
  id: act.id, taskId: act.task_id, userId: act.user_id, type: act.type,
  oldValue: act.old_value, newValue: act.new_value, createdAt: act.created_at,
});

// Campos de nível-tarefa (sem sub-entidades).
const mapTaskCore = (d: any) => ({
  id: d.id,
  title: d.title,
  description: d.description || '',
  status: d.status as string,
  priority: d.priority as TaskPriority,
  mainAssigneeId: d.main_assignee_id,
  secondaryAssigneeIds: d.secondary_assignee_ids || [],
  startDate: d.start_date,
  dueDate: d.due_date,
  extensionCount: d.extension_count || 0,
  listId: d.list_id,
  projectId: d.project_id,
  parentId: d.parent_id,
  createdAt: d.created_at,
  createdBy: d.created_by || undefined,
  tags: d.tags || [],
});

// Task "shell": campos preenchidos, sub-entidades vazias. Usado nas listagens,
// que escalam a milhares de tarefas justamente por não hidratar tudo — o
// detalhe é carregado sob demanda ao abrir a tarefa (ver fetchTaskDetails).
export function mapRowToTaskShell(d: any): Task {
  return {
    ...mapTaskCore(d),
    extensionHistory: [],
    checklists: [],
    comments: [],
    attachments: [],
    activities: [],
    watcherIds: [],
  } as Task;
}

// Paginação genérica: busca todas as páginas de `build` até esgotar.
async function fetchAllPages(
  build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>,
  label: string,
): Promise<any[]> {
  let all: any[] = [];
  let from = 0;
  while (true) {
    const { data: page, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) { console.error(`taskRepo.${label}: erro ao paginar:`, error); break; }
    if (!page || page.length === 0) break;
    all = all.concat(page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

// Linhas cruas de `tasks` no escopo. `listIds === null` = todas as visíveis
// (RLS restringe); caso contrário, filtra por esse conjunto de listas.
export function fetchTaskRowsByListIds(listIds: string[] | null): Promise<any[]> {
  return fetchAllPages(
    (from, to) => {
      const q = supabase.from('tasks').select('*');
      return (listIds ? q.in('list_id', listIds) : q).range(from, to);
    },
    'fetchTaskRowsByListIds',
  );
}

// Índice leve (list_id + status) de TODAS as tarefas visíveis — alimenta os
// contadores exatos por lista, independentes do escopo carregado.
export async function fetchTaskCountIndex(): Promise<{ listId: string | null; status: string }[]> {
  const rows = await fetchAllPages(
    (from, to) => supabase.from('tasks').select('list_id, status').range(from, to),
    'fetchTaskCountIndex',
  );
  return rows.map((r: any) => ({ listId: r.list_id, status: r.status }));
}

// Busca server-side por título. Escapa curingas do LIKE (% _ \) para tratar o
// termo como texto literal.
export async function searchTaskRowsByTitle(term: string, limit = 200): Promise<any[]> {
  const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .ilike('title', pattern)
    .limit(limit);
  if (error) { console.error('taskRepo.searchTaskRowsByTitle: erro na busca:', error); return []; }
  return data || [];
}

// Hidrata linhas de `tasks` em objetos Task completos, buscando as
// sub-entidades em lotes seguros de IDs (ver SUBENTITY_CHUNK).
export async function hydrateTaskRows(rows: any[]): Promise<Task[]> {
  if (!rows || rows.length === 0) return [];
  const taskIds = rows.map((d: any) => d.id);

  const fetchInChunks = async (
    build: (ids: string[]) => PromiseLike<{ data: any[] | null; error: any }>,
    label: string,
  ): Promise<any[]> => {
    const out: any[] = [];
    for (let i = 0; i < taskIds.length; i += SUBENTITY_CHUNK) {
      const slice = taskIds.slice(i, i + SUBENTITY_CHUNK);
      if (slice.length === 0) continue;
      const { data: part, error: partErr } = await build(slice);
      if (partErr) {
        console.error(`taskRepo.hydrateTaskRows: erro ao carregar ${label} (lote ${i / SUBENTITY_CHUNK}):`, partErr);
        continue;
      }
      if (part) out.push(...part);
    }
    return out;
  };

  const [attData, commData, logData, checkData, actData, watchData] = await Promise.all([
    fetchInChunks((ids) => supabase.from('task_attachments').select('*').in('task_id', ids), 'task_attachments'),
    fetchInChunks((ids) => supabase.from('task_comments').select('*').in('task_id', ids).is('deleted_at', null), 'task_comments'),
    fetchInChunks((ids) => supabase.from('task_extension_logs').select('*').in('task_id', ids), 'task_extension_logs'),
    fetchInChunks((ids) => supabase.from('task_checklists').select('*').in('task_id', ids), 'task_checklists'),
    fetchInChunks((ids) => supabase.from('task_activities').select('*').in('task_id', ids), 'task_activities'),
    fetchInChunks((ids) => supabase.from('task_watchers').select('task_id, user_id').in('task_id', ids), 'task_watchers'),
  ]);

  return rows.map((d: any) => ({
    ...mapTaskCore(d),
    extensionHistory: (logData || []).filter((l: any) => l.task_id === d.id).map(mapLog),
    checklists: (checkData || []).filter((ck: any) => ck.task_id === d.id).map(mapChecklist),
    comments: (commData || []).filter((c: any) => c.task_id === d.id).map(mapComment),
    attachments: (attData || []).filter((a: any) => a.task_id === d.id).map(mapAttachment),
    activities: (actData || []).filter((act: any) => act.task_id === d.id).map(mapActivity),
    watcherIds: (watchData || []).filter((w: any) => w.task_id === d.id).map((w: any) => w.user_id),
  } as Task));
}

// Sub-entidades de UMA tarefa (lazy-load ao abrir o detalhe).
export async function fetchTaskDetails(taskId: string): Promise<Partial<Task>> {
  const [attRes, commRes, logRes, checkRes, actRes, watchRes] = await Promise.all([
    supabase.from('task_attachments').select('*').eq('task_id', taskId),
    supabase.from('task_comments').select('*').eq('task_id', taskId).is('deleted_at', null),
    supabase.from('task_extension_logs').select('*').eq('task_id', taskId),
    supabase.from('task_checklists').select('*').eq('task_id', taskId),
    supabase.from('task_activities').select('*').eq('task_id', taskId),
    supabase.from('task_watchers').select('task_id, user_id').eq('task_id', taskId),
  ]);
  return {
    attachments: (attRes.data || []).map(mapAttachment),
    comments: (commRes.data || []).map(mapComment),
    extensionHistory: (logRes.data || []).map(mapLog),
    checklists: (checkRes.data || []).map(mapChecklist),
    activities: (actRes.data || []).map(mapActivity),
    watcherIds: (watchRes.data || []).map((w: any) => w.user_id),
  } as Partial<Task>;
}

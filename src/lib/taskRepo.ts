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

// ── Formato cru das linhas do banco (snake_case) ────────────────────────────
export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  main_assignee_id: string;
  secondary_assignee_ids: string[] | null;
  start_date: string | null;
  due_date: string | null;
  extension_count: number | null;
  list_id: string | null;
  project_id: string | null;
  parent_id: string | null;
  created_at: string;
  created_by: string | null;
  tags: string[] | null;
}
interface AttachmentRow { id: string; task_id: string; name: string; url: string; type: string; size: number; uploaded_at: string; }
interface CommentRow {
  id: string; task_id: string; user_id: string; text: string; created_at: string; updated_at: string | null;
  parent_comment_id: string | null; assigned_to: string | null; assigned_by: string | null;
  resolved_at: string | null; resolved_by: string | null;
}
interface ExtensionLogRow { id: string; task_id: string; old_date: string | null; new_date: string | null; reason: string | null; updated_by: string | null; created_at: string; }
interface ChecklistRow { id: string; task_id: string; text: string; completed: boolean; }
interface ActivityRow { id: string; task_id: string; user_id: string; type: string; old_value: string | null; new_value: string | null; created_at: string; }
interface WatcherRow { task_id: string; user_id: string; }
interface CountRow { list_id: string | null; status: string }

// Resposta genérica do PostgREST usada nas assinaturas dos builders paginados.
type PostgrestResult<T> = { data: T[] | null; error: unknown };

// ── Mapeadores DB (snake_case) → domínio (camelCase) ────────────────────────
const mapAttachment = (a: AttachmentRow) => ({
  id: a.id, name: a.name, url: a.url, type: a.type, size: a.size, uploadedAt: a.uploaded_at,
});
const mapComment = (c: CommentRow) => ({
  id: c.id, userId: c.user_id, text: c.text, timestamp: c.created_at, updatedAt: c.updated_at || undefined,
  parentCommentId: c.parent_comment_id || undefined,
  assignedTo: c.assigned_to || undefined,
  assignedBy: c.assigned_by || undefined,
  resolvedAt: c.resolved_at || undefined,
  resolvedBy: c.resolved_by || undefined,
});
const mapLog = (l: ExtensionLogRow) => ({
  id: l.id, oldDate: l.old_date, newDate: l.new_date, reason: l.reason, updatedBy: l.updated_by, timestamp: l.created_at,
});
const mapChecklist = (ck: ChecklistRow) => ({ id: ck.id, text: ck.text, completed: ck.completed });
const mapActivity = (act: ActivityRow) => ({
  id: act.id, taskId: act.task_id, userId: act.user_id, type: act.type,
  oldValue: act.old_value, newValue: act.new_value, createdAt: act.created_at,
});

// Campos de nível-tarefa (sem sub-entidades).
const mapTaskCore = (d: TaskRow) => ({
  id: d.id,
  title: d.title,
  description: d.description || '',
  status: d.status,
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
export function mapRowToTaskShell(d: TaskRow): Task {
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
async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<PostgrestResult<T>>,
  label: string,
): Promise<T[]> {
  let all: T[] = [];
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
export function fetchTaskRowsByListIds(listIds: string[] | null): Promise<TaskRow[]> {
  return fetchAllPages<TaskRow>(
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
  const rows = await fetchAllPages<CountRow>(
    (from, to) => supabase.from('tasks').select('list_id, status').range(from, to),
    'fetchTaskCountIndex',
  );
  return rows.map((r) => ({ listId: r.list_id, status: r.status }));
}

// Busca server-side por título. Escapa curingas do LIKE (% _ \) para tratar o
// termo como texto literal.
export async function searchTaskRowsByTitle(term: string, limit = 200): Promise<TaskRow[]> {
  const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .ilike('title', pattern)
    .limit(limit);
  if (error) { console.error('taskRepo.searchTaskRowsByTitle: erro na busca:', error); return []; }
  return (data || []) as TaskRow[];
}

// Busca uma sub-entidade filtrando por task_id em lotes seguros de IDs.
async function fetchSubEntityInChunks<T>(
  taskIds: string[],
  build: (ids: string[]) => PromiseLike<PostgrestResult<T>>,
  label: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < taskIds.length; i += SUBENTITY_CHUNK) {
    const slice = taskIds.slice(i, i + SUBENTITY_CHUNK);
    if (slice.length === 0) continue;
    const { data: part, error } = await build(slice);
    if (error) {
      console.error(`taskRepo.hydrateTaskRows: erro ao carregar ${label} (lote ${i / SUBENTITY_CHUNK}):`, error);
      continue;
    }
    if (part) out.push(...part);
  }
  return out;
}

// Hidrata linhas de `tasks` em objetos Task completos, buscando as
// sub-entidades em lotes seguros de IDs (ver SUBENTITY_CHUNK).
export async function hydrateTaskRows(rows: TaskRow[]): Promise<Task[]> {
  if (!rows || rows.length === 0) return [];
  const taskIds = rows.map((d) => d.id);

  const [attData, commData, logData, checkData, actData, watchData] = await Promise.all([
    fetchSubEntityInChunks<AttachmentRow>(taskIds, (ids) => supabase.from('task_attachments').select('*').in('task_id', ids), 'task_attachments'),
    fetchSubEntityInChunks<CommentRow>(taskIds, (ids) => supabase.from('task_comments').select('*').in('task_id', ids).is('deleted_at', null), 'task_comments'),
    fetchSubEntityInChunks<ExtensionLogRow>(taskIds, (ids) => supabase.from('task_extension_logs').select('*').in('task_id', ids), 'task_extension_logs'),
    fetchSubEntityInChunks<ChecklistRow>(taskIds, (ids) => supabase.from('task_checklists').select('*').in('task_id', ids), 'task_checklists'),
    fetchSubEntityInChunks<ActivityRow>(taskIds, (ids) => supabase.from('task_activities').select('*').in('task_id', ids), 'task_activities'),
    fetchSubEntityInChunks<WatcherRow>(taskIds, (ids) => supabase.from('task_watchers').select('task_id, user_id').in('task_id', ids), 'task_watchers'),
  ]);

  return rows.map((d) => ({
    ...mapTaskCore(d),
    extensionHistory: logData.filter((l) => l.task_id === d.id).map(mapLog),
    checklists: checkData.filter((ck) => ck.task_id === d.id).map(mapChecklist),
    comments: commData.filter((c) => c.task_id === d.id).map(mapComment),
    attachments: attData.filter((a) => a.task_id === d.id).map(mapAttachment),
    activities: actData.filter((act) => act.task_id === d.id).map(mapActivity),
    watcherIds: watchData.filter((w) => w.task_id === d.id).map((w) => w.user_id),
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
    attachments: ((attRes.data || []) as AttachmentRow[]).map(mapAttachment),
    comments: ((commRes.data || []) as CommentRow[]).map(mapComment),
    extensionHistory: ((logRes.data || []) as ExtensionLogRow[]).map(mapLog),
    checklists: ((checkRes.data || []) as ChecklistRow[]).map(mapChecklist),
    activities: ((actRes.data || []) as ActivityRow[]).map(mapActivity),
    watcherIds: ((watchRes.data || []) as WatcherRow[]).map((w) => w.user_id),
  } as Partial<Task>;
}
